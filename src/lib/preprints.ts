import { randomUUID } from "node:crypto";
import type { DB, Tx, Row } from "./db";
import {
  audit,
  can,
  permit,
  one,
  fail,
  lockEvent,
  enough,
  createOrder,
  type Actor,
} from "./service";
import { token, hash, encrypt, decrypt } from "./crypto";
import { commands, type Command } from "./validation";

type PreprintCommand = Extract<Command, { action: `preprint_${string}` }>;
const lookupSql = `SELECT p.*,b.name AS batch_name,b.type_name,b.phase_name,b.pricing_phase_id,b.unit_price_cop,b.assigned_to
 FROM preprinted_tickets p JOIN preprint_batches b ON b.id=p.batch_id`;
async function allowed(tx: Tx, a: Actor, p: Row) {
  await permit(tx, a, p.event_id, "sell");
  if (
    p.assigned_to &&
    p.assigned_to !== a.id &&
    !(await can(tx, a, p.event_id, "manage"))
  )
    fail("Este lote está asignado a otro vendedor", 403);
}
async function assignee(tx: Tx, userId: string | null, eventId: string) {
  if (
    userId &&
    !(await can(tx, { id: userId, name: "Responsable" }, eventId, "sell"))
  )
    fail("El responsable debe tener permiso de taquilla en este evento");
  if (
    userId &&
    (await one(tx, "SELECT deleted_at FROM profiles WHERE id=$1", [userId]))
      .deleted_at
  )
    fail("La cuenta del responsable fue eliminada");
}
function safe(p: Row) {
  return {
    id: p.id,
    batch_id: p.batch_id,
    event_id: p.event_id,
    batch_name: p.batch_name,
    type_name: p.type_name,
    phase_name: p.phase_name,
    unit_price_cop: p.unit_price_cop,
    visible_number: p.visible_number,
    event_sequence: p.event_sequence,
    status: p.status,
  };
}
export async function preprintCommand(
  tx: Tx,
  a: Actor,
  c: PreprintCommand,
): Promise<Row> {
  if (c.action === "preprint_create") {
    await permit(tx, a, c.event_id, "manage");
    const e = await lockEvent(tx, c.event_id);
    if (
      (
        await tx.query(
          "SELECT 1 FROM preprint_batch_deletions WHERE request_key=$1",
          [c.idempotency_key],
        )
      ).rows.length
    )
      fail(
        "Este lote fue eliminado. Prepara un lote nuevo con una solicitud nueva",
        410,
      );
    const prior = (
      await tx.query(
        "SELECT id,created_by,event_id FROM preprint_batches WHERE request_key=$1",
        [c.idempotency_key],
      )
    ).rows[0];
    if (prior) {
      if (prior.created_by !== a.id || prior.event_id !== c.event_id)
        fail("Solicitud ya utilizada", 409);
      return { batch_id: prior.id };
    }
    if (!["draft", "published"].includes(e.status))
      fail("El evento no admite nuevos lotes");
    await assignee(tx, c.assigned_to, e.id);
    await enough(tx, e, [
      { ticket_type_id: c.ticket_type_id, quantity: c.quantity },
    ]);
    const t = await one(
      tx,
      "SELECT * FROM ticket_types WHERE id=$1 AND event_id=$2 AND active",
      [c.ticket_type_id, e.id],
    );
    const phase = await one(
      tx,
      "SELECT * FROM pricing_phases WHERE id=$1 AND ticket_type_id=$2 AND channel IN ('box_office','both') AND active",
      [c.phase_id, t.id],
    );
    const batch = await one(
      tx,
      `INSERT INTO preprint_batches(event_id,ticket_type_id,name,type_name,phase_name,pricing_phase_id,unit_price_cop,quantity,assigned_to,created_by,request_key)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        e.id,
        t.id,
        c.name,
        t.name,
        phase.name,
        phase.id,
        phase.price_cop,
        c.quantity,
        c.assigned_to,
        a.id,
        c.idempotency_key,
      ],
    );
    const rows = Array.from({ length: c.quantity }, (_, i) => {
      const secret = token(),
        seq = e.next_sequence + i;
      return {
        id: randomUUID(),
        event_sequence: seq,
        visible_number: `PC-${String(e.id).slice(0, 8).toUpperCase()}-${String(seq).padStart(6, "0")}`,
        security_serial: token().slice(0, 16).toUpperCase(),
        credential_hash: hash(secret),
        credential_encrypted: encrypt(secret),
      };
    });
    await tx.query(
      `INSERT INTO preprinted_tickets(id,batch_id,event_id,ticket_type_id,event_sequence,visible_number,security_serial,credential_hash,credential_encrypted)
      SELECT x.id,$1,$2,$3,x.event_sequence,x.visible_number,x.security_serial,x.credential_hash,x.credential_encrypted
      FROM jsonb_to_recordset($4::jsonb) AS x(id uuid,event_sequence integer,visible_number text,security_serial text,credential_hash text,credential_encrypted text)`,
      [batch.id, e.id, t.id, JSON.stringify(rows)],
    );
    await tx.query(
      "UPDATE events SET next_sequence=next_sequence+$2 WHERE id=$1",
      [e.id, c.quantity],
    );
    await audit(tx, a, "preprint_batch_created", "preprint_batch", batch.id, {
      quantity: c.quantity,
      unit_price_cop: phase.price_cop,
      assigned_to: c.assigned_to,
    });
    return { batch_id: batch.id };
  }
  if (c.action === "preprint_lookup" || c.action === "preprint_activate") {
    const initial = await one(tx, `${lookupSql} WHERE p.credential_hash=$1`, [
      hash(c.credential.replace(/^pc:/, "")),
    ]);
    await lockEvent(tx, initial.event_id);
    const p = await one(tx, `${lookupSql} WHERE p.id=$1 FOR UPDATE OF p,b`, [
      initial.id,
    ]);
    await allowed(tx, a, p);
    if (c.action === "preprint_lookup") return safe(p);
    const metadata = {
      event_id: p.event_id,
      visible_number: p.visible_number,
      event_sequence: p.event_sequence,
      unit_price_cop: p.unit_price_cop,
      type_name: p.type_name,
    };
    if (p.status === "activated") {
      const original = await one(
        tx,
        "SELECT o.id,o.created_by,o.idempotency_key FROM tickets t JOIN order_items i ON i.id=t.order_item_id JOIN orders o ON o.id=i.order_id WHERE t.id=$1",
        [p.activated_ticket_id],
      );
      if (
        original.created_by === a.id &&
        original.idempotency_key === c.idempotency_key
      )
        return { order_id: original.id, already_processed: true, ...metadata };
      fail("Esta boleta ya fue vendida y activada. No vuelvas a cobrarla", 409);
    }
    if (p.status !== "stock")
      fail("La boleta está bloqueada y no se puede activar", 409);
    // A different sale may never be mistaken for an activation by reusing its key.
    if (
      (
        await tx.query("SELECT 1 FROM orders WHERE idempotency_key=$1", [
          c.idempotency_key,
        ])
      ).rows.length
    )
      fail("Solicitud de venta ya utilizada", 409);
    const sale = commands.parse({
      ...c,
      action: "sell",
      event_id: p.event_id,
      items: [{ ticket_type_id: p.ticket_type_id, quantity: 1 }],
      demographics_consent: false,
    });
    if (sale.action !== "sell") fail("Solicitud inválida");
    await tx.query("SELECT set_config('app.preprint_activation',$1,true)", [
      p.id,
    ]);
    const result = await createOrder(tx, a, sale, p);
    const ticket = await one(
      tx,
      "SELECT t.id FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=$1",
      [result.order_id],
    );
    await tx.query(
      "UPDATE preprinted_tickets SET status='activated',activated_ticket_id=$2,activated_by=$3,activated_at=now() WHERE id=$1",
      [p.id, ticket.id, a.id],
    );
    await audit(tx, a, "preprint_activated", "preprinted_ticket", p.id, {
      order_id: result.order_id,
    });
    return { ...result, ...metadata };
  }
  if (
    c.action === "preprint_block" ||
    c.action === "preprint_assign" ||
    c.action === "preprint_delete"
  ) {
    await permit(tx, a, c.event_id, "manage");
    await lockEvent(tx, c.event_id);
    const batch = await one(
      tx,
      "SELECT * FROM preprint_batches WHERE id=$1 AND event_id=$2 FOR UPDATE",
      [c.batch_id, c.event_id],
    );
    if (c.action === "preprint_delete") {
      const rows = (
        await tx.query(
          "SELECT id,status,visible_number,event_sequence FROM preprinted_tickets WHERE batch_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY id FOR UPDATE",
          [batch.id, c.ticket_id ?? null],
        )
      ).rows;
      if (!rows.length) fail("No hay boletas para eliminar", 404);
      if (rows.some((p) => p.status === "activated"))
        fail(
          "Hay boletas vendidas en esta selección. No se pueden eliminar: anúlalas desde Ventas y entradas",
          409,
        );
      // Copy only public identifiers into immutable audit; never retain their secret credential here.
      await audit(tx, a, "preprint_deleted", "preprint_batch", batch.id, {
        quantity: rows.length,
        ticket_id: c.ticket_id ?? null,
        numbers: rows.map((p) => p.visible_number),
        reason: c.reason,
      });
      await tx.query(
        "DELETE FROM preprinted_tickets WHERE id=ANY($1::uuid[])",
        [rows.map((p) => p.id)],
      );
      const remains = (
        await tx.query(
          "SELECT 1 FROM preprinted_tickets WHERE batch_id=$1 LIMIT 1",
          [batch.id],
        )
      ).rows.length;
      if (!remains) {
        await tx.query(
          "INSERT INTO preprint_batch_deletions(batch_id,request_key,event_id,created_by,deleted_by,reason) VALUES($1,$2,$3,$4,$5,$6)",
          [
            batch.id,
            batch.request_key,
            batch.event_id,
            batch.created_by,
            a.id,
            c.reason,
          ],
        );
        await tx.query("DELETE FROM preprint_batches WHERE id=$1", [batch.id]);
      }
      return { deleted: rows.length, batch_deleted: !remains };
    }
    if (c.action === "preprint_assign") {
      await assignee(tx, c.assigned_to, c.event_id);
      await tx.query("UPDATE preprint_batches SET assigned_to=$2 WHERE id=$1", [
        c.batch_id,
        c.assigned_to,
      ]);
      await audit(tx, a, "preprint_assigned", "preprint_batch", c.batch_id, {
        assigned_to: c.assigned_to,
      });
      return {};
    }
    const blocked = (
      await tx.query(
        `UPDATE preprinted_tickets SET status='blocked',blocked_by=$3,blocked_at=now(),block_reason=$4
      WHERE batch_id=$1 AND status='stock' AND ($2::uuid IS NULL OR id=$2) RETURNING id`,
        [c.batch_id, c.ticket_id ?? null, a.id, c.reason],
      )
    ).rows;
    if (!blocked.length)
      fail(
        "No hay boletas sin activar para bloquear. Las vendidas se anulan desde Ventas y entradas",
      );
    await audit(tx, a, "preprint_blocked", "preprint_batch", c.batch_id, {
      quantity: blocked.length,
      reason: c.reason,
      ticket_id: c.ticket_id ?? null,
    });
    return { blocked: blocked.length };
  }
  if (c.action === "preprint_print_request") {
    const rows = (
      await tx.query(
        `${lookupSql} WHERE p.id=ANY($1::uuid[]) ORDER BY p.event_id,p.id`,
        [c.ticket_ids],
      )
    ).rows;
    if (rows.length !== c.ticket_ids.length)
      fail("Boletas no encontradas", 404);
    for (const event of [...new Set(rows.map((p) => p.event_id))].sort())
      await lockEvent(tx, event);
    for (const row of rows) {
      const p = await one(tx, `${lookupSql} WHERE p.id=$1 FOR UPDATE OF p,b`, [
        row.id,
      ]);
      await allowed(tx, a, p);
      if (p.status !== "stock")
        fail(
          "Solo puedes imprimir boletas sin activar. Las vendidas se reimprimen desde su orden",
        );
    }
    const jobs = (
      await tx.query(
        `INSERT INTO preprint_print_jobs(preprinted_ticket_id,operator_id,status,is_reprint,visible_number)
      SELECT p.id,$2,'requested',EXISTS(SELECT 1 FROM preprint_print_jobs j WHERE j.preprinted_ticket_id=p.id),p.visible_number
      FROM preprinted_tickets p WHERE p.id=ANY($1::uuid[]) RETURNING id AS job_id,preprinted_ticket_id`,
        [c.ticket_ids, a.id],
      )
    ).rows;
    await audit(
      tx,
      a,
      "preprint_print_requested",
      "preprint_batch",
      rows[0].batch_id,
      { quantity: jobs.length },
    );
    return { jobs };
  }
  if (c.action === "preprint_print_result") {
    const j = await one(
      tx,
      "SELECT * FROM preprint_print_jobs WHERE id=$1 AND operator_id=$2 FOR UPDATE",
      [c.job_id, a.id],
    );
    if (["confirmed", "failed"].includes(j.status)) fail("Trabajo terminado");
    await tx.query("UPDATE preprint_print_jobs SET status=$2 WHERE id=$1", [
      j.id,
      c.status,
    ]);
    await audit(tx, a, "preprint_print_result", "preprint_print_job", j.id, {
      status: c.status,
    });
    return {};
  }
  return fail("Operación de preimpresión desconocida");
}

export async function preprintInventory(db: DB, a: Actor, eventId: string) {
  return db.transaction(async (tx) => {
    await permit(tx, a, eventId, "sell");
    const manager = await can(tx, a, eventId, "manage");
    const batches = (
      await tx.query(
        `SELECT b.id,b.name,b.type_name,b.phase_name,b.unit_price_cop,b.quantity,b.assigned_to,b.created_at,r.name AS assigned_name,
      count(*) FILTER(WHERE p.status='stock')::int AS stock,count(*) FILTER(WHERE p.status='blocked')::int AS blocked,
      count(*) FILTER(WHERE p.status='activated')::int AS activated,count(*) FILTER(WHERE t.status='used')::int AS used,
      min(p.event_sequence)::int AS first_sequence,max(p.event_sequence)::int AS last_sequence,(b.quantity-count(*))::int AS deleted_count
      FROM preprint_batches b JOIN preprinted_tickets p ON p.batch_id=b.id LEFT JOIN profiles r ON r.id=b.assigned_to LEFT JOIN tickets t ON t.id=p.activated_ticket_id
      WHERE b.event_id=$1 AND ($2::boolean OR b.assigned_to IS NULL OR b.assigned_to=$3)
      GROUP BY b.id,r.name ORDER BY b.created_at DESC`,
        [eventId, manager, a.id],
      )
    ).rows;
    const tickets = (
      await tx.query(
        `SELECT p.id,p.batch_id,p.event_sequence,p.visible_number,p.status,p.activated_at,p.blocked_at,
      t.status AS ticket_status,r.name AS activated_name FROM preprinted_tickets p JOIN preprint_batches b ON b.id=p.batch_id
      LEFT JOIN tickets t ON t.id=p.activated_ticket_id LEFT JOIN profiles r ON r.id=p.activated_by
      WHERE b.event_id=$1 AND ($2::boolean OR b.assigned_to IS NULL OR b.assigned_to=$3) ORDER BY p.event_sequence DESC LIMIT 1000`,
        [eventId, manager, a.id],
      )
    ).rows;
    const sellers = manager
      ? (
          await tx.query(
            `SELECT p.id,p.name FROM profiles p WHERE p.deleted_at IS NULL AND
      (EXISTS(SELECT 1 FROM platform_admins g WHERE g.user_id=p.id) OR EXISTS(SELECT 1 FROM events e JOIN organization_members m ON m.organization_id=e.organization_id WHERE e.id=$1 AND m.user_id=p.id)
       OR EXISTS(SELECT 1 FROM event_staff s WHERE s.event_id=$1 AND s.user_id=p.id AND s.active AND s.role IN ('box_office','organizer'))) ORDER BY p.name`,
            [eventId],
          )
        ).rows
      : [];
    return { batches, tickets, sellers, manager };
  });
}
export async function preprintDocument(db: DB, a: Actor, batchId: string) {
  return db.transaction(async (tx) => {
    const b = await one(tx, "SELECT * FROM preprint_batches WHERE id=$1", [
      batchId,
    ]);
    await allowed(tx, a, b);
    const event = await one(tx, "SELECT * FROM events WHERE id=$1", [
      b.event_id,
    ]);
    const art = (
      await tx.query(
        "SELECT image_png,caption FROM event_ticket_art WHERE event_id=$1",
        [event.id],
      )
    ).rows[0];
    if (art) {
      event.ticket_art_data_url = `data:image/png;base64,${Buffer.from(art.image_png).toString("base64")}`;
      event.ticket_art_caption = art.caption;
    }
    const tickets = (
      await tx.query(
        "SELECT * FROM preprinted_tickets WHERE batch_id=$1 AND status='stock' ORDER BY event_sequence",
        [b.id],
      )
    ).rows.map((p) => ({
      ...safe({
        ...p,
        ...{
          type_name: b.type_name,
          phase_name: b.phase_name,
          unit_price_cop: b.unit_price_cop,
        },
      }),
      preprinted: true,
      security_serial: p.security_serial,
      credential: `pc:${decrypt(p.credential_encrypted)}`,
    }));
    return {
      event,
      tickets,
      order: { id: b.id, status: "preprinted", total_cop: 0, buyer_name: null },
      share: "",
      batch_name: b.name,
      preprinted: true,
      can_delete_batch: !(
        await tx.query(
          "SELECT 1 FROM preprinted_tickets WHERE batch_id=$1 AND status='activated' LIMIT 1",
          [b.id],
        )
      ).rows.length,
    };
  });
}
