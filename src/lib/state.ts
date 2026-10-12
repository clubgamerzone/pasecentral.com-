import type { DB, Row } from "./db";
import { admin, can, type Actor } from "./service";
import { demoMode } from "./config";
export async function state(db: DB, a: Actor | null) {
  return db.transaction(async (tx) => {
    const all = (await tx.query("SELECT * FROM events ORDER BY starts_at"))
      .rows;
    const isAdmin = a ? await admin(tx, a) : false;
    const manageable: string[] = [],
      sellable: string[] = [],
      accessible: string[] = [],
      visible: string[] = [];
    if (a)
      for (const e of all) {
        if (await can(tx, a, e.id, "manage")) manageable.push(e.id);
        if (await can(tx, a, e.id, "sell")) sellable.push(e.id);
        if (await can(tx, a, e.id, "access")) accessible.push(e.id);
        if (await can(tx, a, e.id, "view")) visible.push(e.id);
      }
    const events = all.filter(
      (e) => e.status === "published" || visible.includes(e.id),
    );
    const ids = events.map((e) => e.id);
    const types = (
      await tx.query(
        `SELECT t.*,coalesce((SELECT sum(i.quantity) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.ticket_type_id=t.id AND (o.status IN ('confirmed','partially_refunded','refunded') OR (o.status='pending_payment' AND o.reservation_expires_at>now()))),0)::int AS committed FROM ticket_types t WHERE event_id=ANY($1::uuid[])`,
        [ids],
      )
    ).rows;
    const phases = (
      await tx.query(
        "SELECT p.* FROM pricing_phases p JOIN ticket_types t ON t.id=p.ticket_type_id WHERE t.event_id=ANY($1::uuid[]) ORDER BY p.starts_at",
        [ids],
      )
    ).rows;
    for (const e of events)
      e.available = Math.max(
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
      refunds: Row[] = [],
      people: Row[] = [],
      staff: Row[] = [],
      members: Row[] = [];
    if (a) {
      orders = (
        await tx.query(
          `SELECT id,event_id,buyer_user_id,buyer_name,buyer_email,buyer_category,channel,status,total_cop,subtotal_cop,fees_cop,reservation_expires_at,created_at,created_by FROM orders WHERE buyer_user_id=$1 OR event_id=ANY($2::uuid[]) ORDER BY created_at DESC`,
          [a.id, sellable],
        )
      ).rows;
      const orderIds = orders.map((o) => o.id);
      tickets = (
        await tx.query(
          `SELECT t.id,t.event_id,t.ticket_type_id,t.event_sequence,t.visible_number,t.security_serial,t.status,t.used_at,t.issued_at,i.order_id,i.type_name FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=ANY($1::uuid[]) OR t.event_id=ANY($2::uuid[]) ORDER BY t.event_sequence`,
          [orderIds, accessible],
        )
      ).rows;
      payments = (
        await tx.query(
          "SELECT p.* FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.id=ANY($1::uuid[])",
          [orderIds],
        )
      ).rows;
      sessions = (
        await tx.query(
          "SELECT * FROM cash_sessions WHERE event_id=ANY($1::uuid[]) AND (operator_id=$2 OR event_id=ANY($3::uuid[])) ORDER BY opened_at DESC",
          [sellable, a.id, manageable],
        )
      ).rows;
      movements = (
        await tx.query(
          "SELECT * FROM cash_movements WHERE cash_session_id=ANY($1::uuid[])",
          [sessions.map((s) => s.id)],
        )
      ).rows;
      attempts = (
        await tx.query(
          "SELECT * FROM check_in_attempts WHERE event_id=ANY($1::uuid[]) ORDER BY attempted_at DESC",
          [visible],
        )
      ).rows;
      jobs = (
        await tx.query(
          "SELECT id,order_id,status,attempts,last_error,created_at FROM delivery_jobs WHERE order_id=ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 200",
          [orderIds],
        )
      ).rows;
      refunds = (
        await tx.query(
          "SELECT r.* FROM refunds r JOIN orders o ON o.id=r.order_id WHERE o.event_id=ANY($1::uuid[])",
          [manageable],
        )
      ).rows;
      if (manageable.length || isAdmin) {
        people = (
          await tx.query("SELECT id,name,email FROM profiles ORDER BY name")
        ).rows;
        staff = (
          await tx.query(
            "SELECT * FROM event_staff WHERE event_id=ANY($1::uuid[])",
            [manageable],
          )
        ).rows;
        members = (
          await tx.query(
            "SELECT * FROM organization_members WHERE organization_id=ANY($1::uuid[])",
            [orgs.map((o) => o.id)],
          )
        ).rows;
        audit = (
          await tx.query(
            "SELECT l.* FROM audit_logs l WHERE $1::boolean OR actor_id=$2 ORDER BY created_at DESC LIMIT 200",
            [isAdmin, a.id],
          )
        ).rows;
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
    return {
      demo: demoMode(),
      actor: a,
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
