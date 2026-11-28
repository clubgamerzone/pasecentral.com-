import type { DB, Row, Tx } from "./db";
import { admin, type Actor } from "./service";
import { demoMode, appEnvironment } from "./config";

// Batch independent SELECTs in one PostgreSQL round trip. All values stay bound
// parameters; authorization filters remain in the original SELECT statements.
async function readBatch(
  tx: Tx,
  selects: { sql: string; params: unknown[] }[],
): Promise<Row[][]> {
  const params: unknown[] = [];
  const columns = selects.map((select, index) => {
    const offset = params.length;
    const sql = select.sql.replace(
      /\$(\d+)/g,
      (_, n) => `$${Number(n) + offset}`,
    );
    params.push(...select.params);
    return `(SELECT COALESCE(json_agg(row_to_json(rows)), '[]'::json) FROM (${sql}) rows) AS batch_${index}`;
  });
  const result = (await tx.query(`SELECT ${columns.join(",")}`, params))
    .rows[0];
  return selects.map((_, index) => result[`batch_${index}`]);
}

export async function state(db: DB, a: Actor | null) {
  const { expireTransfers } = await import("./transfers");
  await expireTransfers(db);
  return db.transaction(async (tx) => {
    const all = (
      await tx.query(
        "SELECT e.*, a.event_id IS NOT NULL AS has_ticket_art,a.updated_at AS ticket_art_updated_at,a.caption AS ticket_art_caption FROM events e LEFT JOIN event_ticket_art a ON a.event_id=e.id ORDER BY e.starts_at",
      )
    ).rows;
    const isAdmin = a ? await admin(tx, a) : false;
    const manageable: string[] = [],
      sellable: string[] = [],
      accessible: string[] = [],
      visible: string[] = [];
    if (a) {
      const memberships = isAdmin
        ? []
        : (
            await tx.query(
              "SELECT organization_id FROM organization_members WHERE user_id=$1",
              [a.id],
            )
          ).rows;
      const assignments = isAdmin
        ? []
        : (
            await tx.query(
              "SELECT event_id,role FROM event_staff WHERE user_id=$1 AND active",
              [a.id],
            )
          ).rows;
      for (const e of all) {
        const manager =
          isAdmin ||
          memberships.some((m) => m.organization_id === e.organization_id) ||
          assignments.some(
            (s) => s.event_id === e.id && s.role === "organizer",
          );
        const roles = assignments
          .filter((s) => s.event_id === e.id)
          .map((s) => s.role);
        if (manager) manageable.push(e.id);
        if (manager || roles.includes("box_office")) sellable.push(e.id);
        if (manager || roles.includes("access_staff")) accessible.push(e.id);
        if (
          manager ||
          roles.some((r) => ["box_office", "access_staff"].includes(r))
        )
          visible.push(e.id);
      }
    }
    const events = all.filter(
      (e) => e.status === "published" || visible.includes(e.id),
    );
    const ids = events.map((e) => e.id);
    const [images, types, phases] = await readBatch(tx, [
      {
        sql: "SELECT id,event_id,path FROM event_images WHERE event_id=ANY($1::uuid[]) ORDER BY created_at,id",
        params: [ids],
      },
      {
        sql: `SELECT t.*,coalesce((SELECT sum(i.quantity) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.ticket_type_id=t.id AND (o.status IN ('confirmed','partially_refunded','refunded') OR (o.status='pending_payment' AND o.reservation_expires_at>now()))),0)::int AS committed FROM ticket_types t WHERE event_id=ANY($1::uuid[])`,
        params: [ids],
      },
      {
        sql: "SELECT p.*,p.ends_at IS NULL AS ends_with_event,COALESCE(p.ends_at,e.ends_at) AS effective_ends_at FROM pricing_phases p JOIN ticket_types t ON t.id=p.ticket_type_id JOIN events e ON e.id=t.event_id WHERE t.event_id=ANY($1::uuid[]) ORDER BY p.starts_at",
        params: [ids],
      },
    ]);
    const preprintHeld = (
      await tx.query(
        "SELECT ticket_type_id,count(*)::int AS n FROM preprinted_tickets WHERE event_id=ANY($1::uuid[]) AND status='stock' GROUP BY ticket_type_id",
        [ids],
      )
    ).rows;
    for (const t of types) {
      t.preprinted_reserved =
        preprintHeld.find((p) => p.ticket_type_id === t.id)?.n ?? 0;
      t.committed += t.preprinted_reserved;
    }
    for (const e of events) {
      e.images = images
        .filter((i) => i.event_id === e.id)
        .map((i) => ({
          id: i.id,
          url: `/api/event-images/${i.id}`,
          cover: i.path === e.cover_path,
        }));
      e.cover_url = e.images.find((i: Row) => i.cover)?.url ?? null;
      delete e.cover_path;
    }

    for (const e of events)
      e.available =
        e.capacity === null
          ? null
          : Math.max(
              0,
              e.capacity -
                types
                  .filter((t) => t.event_id === e.id)
                  .reduce((sum, t) => sum + t.committed, 0),
            );
    const orgs = a
      ? (
          await tx.query(
            "SELECT o.* FROM organizations o WHERE $1::boolean OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.user_id=$2)",
            [isAdmin, a.id],
          )
        ).rows
      : [];
    let orders: Row[] = [],
      tickets: Row[] = [],
      payments: Row[] = [],
      sessions: Row[] = [],
      movements: Row[] = [],
      attempts: Row[] = [],
      audit: Row[] = [],
      jobs: Row[] = [],
      invitations: Row[] = [],
      refunds: Row[] = [],
      people: Row[] = [],
      staff: Row[] = [],
      members: Row[] = [];
    if (a) {
      orders = (
        await tx.query(
          `SELECT id,event_id,buyer_user_id,gift_email IS NOT NULL AS is_gift,buyer_name,buyer_email,buyer_category,channel,status,total_cop,subtotal_cop,fees_cop,reservation_expires_at,created_at,confirmed_at,created_by FROM orders WHERE buyer_user_id=$1 OR event_id=ANY($2::uuid[]) ORDER BY created_at DESC`,
          [a.id, sellable],
        )
      ).rows;
      const orderIds = orders.map((o) => o.id);
      [tickets, payments, sessions, attempts, jobs, refunds] = await readBatch(
        tx,
        [
          {
            sql: `SELECT t.id,t.owner_user_id,t.event_id,t.ticket_type_id,t.event_sequence,t.visible_number,t.security_serial,t.status,t.used_at,t.issued_at,i.order_id,i.type_name,e.title AS event_title,e.starts_at AS event_starts_at,e.venue_name AS event_venue_name,EXISTS(SELECT 1 FROM ticket_transfer_items ti JOIN ticket_transfers r ON r.id=ti.transfer_id WHERE ti.ticket_id=t.id AND r.status='pending') AS transfer_pending FROM tickets t JOIN order_items i ON i.id=t.order_item_id JOIN events e ON e.id=t.event_id WHERE t.owner_user_id=$1 OR t.event_id=ANY($2::uuid[]) OR (i.order_id=ANY($3::uuid[]) AND t.owner_user_id IS NULL) ORDER BY t.event_sequence`,
            params: [a.id, [...sellable, ...accessible], orderIds],
          },
          {
            sql: "SELECT p.* FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.id=ANY($1::uuid[])",
            params: [orderIds],
          },
          {
            sql: "SELECT * FROM cash_sessions WHERE event_id=ANY($1::uuid[]) AND (operator_id=$2 OR event_id=ANY($3::uuid[])) ORDER BY opened_at DESC",
            params: [sellable, a.id, manageable],
          },
          {
            sql: "SELECT * FROM check_in_attempts WHERE event_id=ANY($1::uuid[]) ORDER BY attempted_at DESC",
            params: [visible],
          },
          {
            sql: "SELECT id,order_id,status,attempts,last_error,created_at FROM delivery_jobs WHERE order_id=ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 200",
            params: [orderIds],
          },
          {
            sql: "SELECT r.* FROM refunds r JOIN orders o ON o.id=r.order_id WHERE o.event_id=ANY($1::uuid[])",
            params: [manageable],
          },
        ],
      );
      movements = (
        await tx.query(
          "SELECT * FROM cash_movements WHERE cash_session_id=ANY($1::uuid[])",
          [sessions.map((s) => s.id)],
        )
      ).rows;

      if (manageable.length || isAdmin) {
        [people, staff, members, audit] = await readBatch(tx, [
          {
            sql: "SELECT id,name,email,EXISTS(SELECT 1 FROM platform_admins pa WHERE pa.user_id=profiles.id) AS platform_admin, ARRAY(SELECT m.organization_id FROM organization_members m WHERE m.user_id=profiles.id AND m.organization_id IN (SELECT organization_id FROM events WHERE id=ANY($3::uuid[]))) AS managing_organizations FROM profiles WHERE deleted_at IS NULL AND ($1::boolean OR id=$2 OR EXISTS(SELECT 1 FROM event_staff s WHERE s.user_id=profiles.id AND s.event_id=ANY($3::uuid[]))) ORDER BY name",
            params: [isAdmin, a.id, manageable],
          },
          {
            sql: "SELECT * FROM event_staff WHERE event_id=ANY($1::uuid[])",
            params: [manageable],
          },
          {
            sql: "SELECT * FROM organization_members WHERE organization_id=ANY($1::uuid[])",
            params: [orgs.map((o) => o.id)],
          },
          {
            sql: "SELECT l.* FROM audit_logs l WHERE $1::boolean OR actor_id=$2 ORDER BY created_at DESC LIMIT 200",
            params: [isAdmin, a.id],
          },
        ]);
      }
    }
    const items = a
      ? (
          await tx.query(
            "SELECT * FROM order_items WHERE order_id=ANY($1::uuid[])",
            [orders.map((o) => o.id)],
          )
        ).rows
      : [];
    const profile = a
      ? (
          await tx.query(
            "SELECT name,email,phone,bio,avatar_path,updated_at,gender,age_band,terms_accepted_at FROM profiles WHERE id=$1",
            [a.id],
          )
        ).rows[0]
      : null;
    if (profile) {
      profile.avatar_url = profile.avatar_path
        ? `/api/profile/avatar?v=${new Date(profile.updated_at).getTime()}`
        : null;
      delete profile.avatar_path;
    }
    if (isAdmin || manageable.length)
      invitations = (
        await tx.query(
          "SELECT id,email,name,role,event_ids,include_access,status,expires_at,email_status,email_attempts,last_error FROM team_invitations WHERE role<>'customer' AND ($1::boolean OR (role<>'platform_admin' AND cardinality(event_ids)>0 AND event_ids <@ $2::uuid[])) ORDER BY created_at DESC LIMIT 200",
          [isAdmin, manageable],
        )
      ).rows;
    return {
      transfers: a
        ? (
            await tx.query(
              "SELECT r.id,r.from_user_id,p.name AS from_name,r.to_user_id,r.recipient_email,r.kind,r.status,r.expires_at FROM ticket_transfers r JOIN profiles p ON p.id=r.from_user_id WHERE r.from_user_id=$1 OR lower(r.recipient_email)=lower($2) ORDER BY r.created_at DESC LIMIT 100",
              [a.id, a.email ?? ""],
            )
          ).rows
        : [],
      demo: demoMode(),
      environment: appEnvironment(),
      actor: a,
      profile,
      invitations,
      pending_invitation: await (
        await import("./invitations")
      ).pendingInvitation(tx, a),
      permissions: {
        admin: isAdmin,
        manage: manageable,
        sell: sellable,
        access: accessible,
      },
      organizations: orgs,
      events,
      types,
      phases,
      orders,
      items,
      tickets,
      payments,
      sessions,
      movements,
      attempts,
      audit,
      jobs,
      refunds,
      people,
      staff,
      members,
    };
  });
}
