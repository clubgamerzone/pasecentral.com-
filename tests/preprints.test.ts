import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { memoryDb, type DB } from "../src/lib/db";
import { seed, USERS } from "../src/lib/seed";
import { execute, one, ticketDocument } from "../src/lib/service";
import { preprintDocument, preprintInventory } from "../src/lib/preprints";
import { state } from "../src/lib/state";
import { analytics } from "../src/lib/analytics";
const e1 = "00000000-0000-4000-8000-000000000002",
  e2 = "00000000-0000-4000-8000-000000000003";
const admin = USERS[0],
  box = USERS[2],
  access = USERS[3],
  customer = USERS[4];
let db: DB;
beforeAll(async () => {
  db = await memoryDb();
});
beforeEach(async () => {
  await db.query("TRUNCATE organizations,profiles CASCADE");
  await seed(db);
});
afterAll(async () => {
  await (db as DB & { close(): Promise<void> }).close();
});
async function batch(quantity = 2, extra: Record<string, unknown> = {}) {
  const t = await one(
    db,
    "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
    [e1],
  );
  const p = await one(
    db,
    "SELECT id FROM pricing_phases WHERE ticket_type_id=$1 AND channel='box_office' AND active",
    [t.id],
  );
  const c = {
    action: "preprint_create",
    event_id: e1,
    ticket_type_id: t.id,
    phase_id: p.id,
    quantity,
    name: "Lote prueba",
    idempotency_key: randomUUID(),
    ...extra,
  };
  const r = await execute(db, admin, c);
  return {
    batch_id: r.batch_id,
    c,
    doc: await preprintDocument(db, admin, r.batch_id),
  };
}
const activate = (credential: string, extra: Record<string, unknown> = {}) =>
  execute(db, box, {
    action: "preprint_activate",
    credential,
    method: "transfer",
    verified: true,
    reference: "VERIFICADA",
    idempotency_key: randomUUID(),
    ...extra,
  });
const scan = (
  credential: string,
  extra: Record<string, unknown> = {},
  actor = access,
) =>
  execute(db, actor, {
    action: "scan_auto",
    credential,
    request_id: randomUUID(),
    device_id: "EDA prueba",
    gate_label: "Puerta",
    ...extra,
  });
it("preparar lote aparta cupo y consecutivos, sin ventas/pagos/entradas; consultas no filtran QR", async () => {
  const before = (await state(db, admin)).events.find(
    (e) => e.id === e1,
  )!.available;
  const b = await batch(3);
  expect(b.doc.tickets.map((t) => t.event_sequence)).toEqual([1, 2, 3]);
  expect(
    (await one(db, "SELECT next_sequence FROM events WHERE id=$1", [e1]))
      .next_sequence,
  ).toBe(4);
  for (const table of ["orders", "payments", "tickets", "delivery_jobs"])
    expect((await one(db, `SELECT count(*)::int AS n FROM ${table}`)).n).toBe(
      0,
    );
  expect(
    (await state(db, admin)).events.find((e) => e.id === e1)!.available,
  ).toBe(before - 3);
  const inventory = await preprintInventory(db, box, e1);
  expect(inventory.batches[0].stock).toBe(3);
  expect(JSON.stringify(inventory)).not.toMatch(/credential|security_serial/);
  const retry = await execute(db, admin, b.c);
  expect(retry.batch_id).toBe(b.batch_id);
  expect(
    (await one(db, "SELECT count(*)::int AS n FROM preprinted_tickets")).n,
  ).toBe(3);
  const report = await analytics(db, admin, {});
  expect(
    report.events.find((e: { event_id: string }) => e.event_id === e1)!
      .quantity,
  ).toBe(0);
});
it("preimpresa no entra; pago activa exactamente el QR, serial y número y permite un solo ingreso", async () => {
  const b = await batch(1),
    paper = b.doc.tickets[0];
  const req = randomUUID();
  expect((await scan(paper.credential, { request_id: req })).result).toBe(
    "not_activated",
  );
  expect((await scan(paper.credential, {}, customer)).result).toBe(
    "unauthorized",
  );
  const key = randomUUID();
  const sale = await activate(paper.credential, { idempotency_key: key });
  const doc = await ticketDocument(db, box, sale.order_id);
  for (const field of [
    "credential",
    "security_serial",
    "visible_number",
    "event_sequence",
  ] as const)
    expect(doc.tickets[0][field]).toBe(paper[field]);
  expect(
    (
      await execute(db, box, {
        action: "preprint_lookup",
        credential: paper.credential,
      })
    ).status,
  ).toBe("activated");
  expect((await scan(paper.credential, { request_id: req })).result).toBe(
    "not_activated",
  );
  expect((await scan(paper.credential)).result).toBe("accepted");
  expect((await scan(paper.credential)).result).toBe("already_used");
  const retry = await activate(paper.credential, { idempotency_key: key });
  expect(retry.order_id).toBe(sale.order_id);
  await expect(activate(paper.credential)).rejects.toThrow("ya fue vendida");
  expect((await one(db, "SELECT count(*)::int AS n FROM payments")).n).toBe(1);
});
it("no acepta pago sin verificación/caja, no activa al consultar y el precio impreso permanece fijo", async () => {
  const b = await batch(1),
    p = b.doc.tickets[0];
  await execute(db, box, {
    action: "preprint_lookup",
    credential: p.credential,
  });
  await expect(activate(p.credential, { verified: false })).rejects.toThrow(
    "Verifica",
  );
  await expect(activate(p.credential, { method: "cash" })).rejects.toThrow();
  expect((await one(db, "SELECT count(*)::int AS n FROM orders")).n).toBe(0);
  expect(
    (await one(db, "SELECT status FROM preprinted_tickets WHERE id=$1", [p.id]))
      .status,
  ).toBe("stock");
  await db.query(
    "UPDATE pricing_phases SET price_cop=99000,active=false WHERE id=$1",
    [b.c.phase_id],
  );
  const sale = await activate(p.credential, {
    buyer_email: "comprador@example.com",
  });
  expect(
    (await one(db, "SELECT total_cop FROM orders WHERE id=$1", [sale.order_id]))
      .total_cop,
  ).toBe(p.unit_price_cop);
  expect(
    (await one(db, "SELECT count(*)::int AS n FROM delivery_jobs")).n,
  ).toBe(1);
});
it("reservas de papel compiten con venta normal sin sobreventa, activar no duplica cupo", async () => {
  await db.query("UPDATE events SET capacity=2 WHERE id=$1", [e1]);
  const b = await batch(2);
  const normal = {
    action: "sell",
    event_id: e1,
    items: [{ ticket_type_id: b.c.ticket_type_id, quantity: 1 }],
    method: "transfer",
    verified: true,
    reference: "TEST",
    idempotency_key: randomUUID(),
  };
  await expect(execute(db, box, normal)).rejects.toThrow("cupo");
  await expect(batch(1)).rejects.toThrow("cupo");
  await activate(b.doc.tickets[0].credential);
  expect(
    (await state(db, admin)).events.find((e) => e.id === e1)!.available,
  ).toBe(0);
  await activate(b.doc.tickets[1].credential);
  expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(2);
});
it("bloqueo definitivo individual/lote libera solo pendientes y no anula una venta", async () => {
  const b = await batch(3),
    [first, second, third] = b.doc.tickets;
  await activate(first.credential);
  await execute(db, admin, {
    action: "preprint_block",
    event_id: e1,
    batch_id: b.batch_id,
    ticket_id: second.id,
    reason: "Perdida",
  });
  expect((await scan(second.credential)).result).toBe("cancelled");
  await expect(activate(second.credential)).rejects.toThrow("bloqueada");
  const r = await execute(db, admin, {
    action: "preprint_block",
    event_id: e1,
    batch_id: b.batch_id,
    reason: "Robo del resto",
  });
  expect(r.blocked).toBe(1);
  expect((await scan(third.credential)).result).toBe("cancelled");
  expect((await scan(first.credential)).result).toBe("accepted");
  expect((await preprintDocument(db, admin, b.batch_id)).tickets).toHaveLength(
    0,
  );
});
it("permisos/asignación y RLS rechazan acceso directo, evento ajeno y cliente", async () => {
  const b = await batch(1, { assigned_to: admin.id }),
    p = b.doc.tickets[0];
  await expect(activate(p.credential)).rejects.toThrow("otro vendedor");
  await expect(preprintDocument(db, box, b.batch_id)).rejects.toThrow(
    "otro vendedor",
  );
  await expect(
    execute(db, box, { ...b.c, idempotency_key: randomUUID() }),
  ).rejects.toThrow();
  await expect(preprintInventory(db, customer, e1)).rejects.toThrow();
  await expect(
    execute(db, admin, {
      action: "preprint_block",
      event_id: e2,
      batch_id: b.batch_id,
      reason: "Incorrecto",
    }),
  ).rejects.toThrow();
  await execute(db, admin, {
    action: "preprint_assign",
    event_id: e1,
    batch_id: b.batch_id,
    assigned_to: box.id,
  });
  expect((await preprintDocument(db, box, b.batch_id)).tickets).toHaveLength(1);
  await expect(
    execute(db, admin, {
      action: "preprint_assign",
      event_id: e1,
      batch_id: b.batch_id,
      assigned_to: customer.id,
    }),
  ).rejects.toThrow();
  for (const table of [
    "preprint_batches",
    "preprinted_tickets",
    "preprint_print_jobs",
  ])
    await expect(
      db.transaction(async (tx) => {
        await tx.query("SET LOCAL ROLE authenticated");
        await tx.query(`SELECT * FROM ${table}`);
      }),
    ).rejects.toThrow();
});
it("dos activaciones producen un único cobro; impresiones auditadas no activan", async () => {
  const b = await batch(1),
    p = b.doc.tickets[0];
  const print = await execute(db, box, {
    action: "preprint_print_request",
    ticket_ids: [p.id],
  });
  await execute(db, box, {
    action: "preprint_print_result",
    job_id: print.jobs[0].job_id,
    status: "confirmed",
  });
  expect((await scan(p.credential)).result).toBe("not_activated");
  const results = await Promise.allSettled([
    activate(p.credential),
    activate(p.credential),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await one(db, "SELECT count(*)::int AS n FROM payments")).n).toBe(1);
  await expect(
    execute(db, box, { action: "preprint_print_request", ticket_ids: [p.id] }),
  ).rejects.toThrow("Solo puedes imprimir");
});
it("una clave de otra venta no sirve para activar y un QR reemplazado no revive", async () => {
  const b = await batch(2),
    [p, q] = b.doc.tickets,
    key = randomUUID();
  const sale = await activate(p.credential, { idempotency_key: key });
  await expect(
    activate(q.credential, { idempotency_key: key }),
  ).rejects.toThrow("ya utilizada");
  const doc = await ticketDocument(db, box, sale.order_id);
  await execute(db, admin, {
    action: "replace_ticket",
    ticket_id: doc.tickets[0].id,
    reason: "Sustitución",
  });
  expect((await scan(p.credential)).result).toBe("cancelled");
});
it("la base también protege cupo frente a una aplicación antigua y un pago tardío", async () => {
  await db.query("UPDATE events SET capacity=2 WHERE id=$1", [e1]);
  const b = await batch(2);
  const oldOrder = randomUUID();
  await db.query(
    "INSERT INTO orders(id,event_id,channel,status,subtotal_cop,total_cop,created_by,idempotency_key) VALUES($1,$2,'web','expired',1,1,$3,$4)",
    [oldOrder, e1, box.id, randomUUID()],
  );
  await db.query(
    "INSERT INTO order_items(order_id,event_id,ticket_type_id,quantity,unit_price_cop,line_total_cop,type_name,phase_name) VALUES($1,$2,$3,1,1,1,'General','Anterior')",
    [oldOrder, e1, b.c.ticket_type_id],
  );
  await expect(
    db.query("UPDATE orders SET status='confirmed' WHERE id=$1", [oldOrder]),
  ).rejects.toThrow("Cupo reservado");
  await expect(
    db.transaction(async (tx) => {
      const o = await one(
        tx,
        "INSERT INTO orders(event_id,channel,status,subtotal_cop,total_cop,created_by,idempotency_key) VALUES($1,'box_office','confirmed',1,1,$2,$3) RETURNING id",
        [e1, box.id, randomUUID()],
      );
      await tx.query(
        "INSERT INTO order_items(order_id,event_id,ticket_type_id,quantity,unit_price_cop,line_total_cop,type_name,phase_name) VALUES($1,$2,$3,1,1,1,'General','Anterior')",
        [o.id, e1, b.c.ticket_type_id],
      );
    }),
  ).rejects.toThrow("Cupo reservado");
  expect(
    (
      await one(
        db,
        "SELECT count(*)::int AS n FROM orders WHERE status='confirmed'",
      )
    ).n,
  ).toBe(0);
});
it("activar en efectivo exige caja y registra exactamente un movimiento", async () => {
  const b = await batch(1),
    p = b.doc.tickets[0];
  await execute(db, box, {
    action: "cash_open",
    event_id: e1,
    opening_cash_cop: 10000,
  });
  const sale = await activate(p.credential, { method: "cash" });
  const payment = await one(db, "SELECT * FROM payments WHERE order_id=$1", [
    sale.order_id,
  ]);
  expect(payment.status).toBe("approved");
  expect(payment.cash_session_id).toBeTruthy();
  expect(
    (
      await one(
        db,
        "SELECT amount_cop FROM cash_movements WHERE payment_id=$1",
        [payment.id],
      )
    ).amount_cop,
  ).toBe(p.unit_price_cop);
});
it("elimina una preimpresa y su secreto, libera cupo y conserva impresión y número sin reciclar", async () => {
  const b = await batch(2),
    p = b.doc.tickets[0];
  const before = (await state(db, admin)).events.find(
    (e) => e.id === e1,
  )!.available;
  const job = await execute(db, box, {
    action: "preprint_print_request",
    ticket_ids: [p.id],
  });
  await execute(db, box, {
    action: "preprint_print_result",
    job_id: job.jobs[0].job_id,
    status: "confirmed",
  });
  const result = await execute(db, admin, {
    action: "preprint_delete",
    event_id: e1,
    batch_id: b.batch_id,
    ticket_id: p.id,
    reason: "Papel dañado",
    confirmed: true,
  });
  expect(result.deleted).toBe(1);
  expect(result.batch_deleted).toBe(false);
  expect(
    (await db.query("SELECT * FROM preprinted_tickets WHERE id=$1", [p.id]))
      .rows,
  ).toHaveLength(0);
  const history = await one(
    db,
    "SELECT * FROM preprint_print_jobs WHERE id=$1",
    [job.jobs[0].job_id],
  );
  expect(history.preprinted_ticket_id).toBeNull();
  expect(history.visible_number).toBe(p.visible_number);
  expect(history.status).toBe("confirmed");
  expect(
    (await state(db, admin)).events.find((e) => e.id === e1)!.available,
  ).toBe(before + 1);
  await expect(activate(p.credential)).rejects.toThrow();
  expect((await scan(p.credential)).result).toBe("unknown_ticket");
  const next = await batch(1);
  expect(next.doc.tickets[0].event_sequence).toBe(3);
  const inv = await preprintInventory(db, admin, e1);
  expect(inv.batches.find((x) => x.id === b.batch_id)!.deleted_count).toBe(1);
});
it("elimina lotes pendientes/desactivados y una solicitud antigua no los recrea", async () => {
  const b = await batch(2);
  await execute(db, admin, {
    action: "preprint_block",
    event_id: e1,
    batch_id: b.batch_id,
    reason: "Lote retirado",
  });
  const result = await execute(db, admin, {
    action: "preprint_delete",
    event_id: e1,
    batch_id: b.batch_id,
    reason: "Eliminar prueba",
    confirmed: true,
  });
  expect(result.deleted).toBe(2);
  expect(result.batch_deleted).toBe(true);
  expect(
    (await db.query("SELECT * FROM preprint_batches WHERE id=$1", [b.batch_id]))
      .rows,
  ).toHaveLength(0);
  expect((await preprintInventory(db, admin, e1)).batches).toHaveLength(0);
  expect(
    (await one(db, "SELECT next_sequence FROM events WHERE id=$1", [e1]))
      .next_sequence,
  ).toBe(3);
  await expect(execute(db, admin, b.c)).rejects.toThrow("fue eliminado");
  await expect(
    db.transaction(async (tx) => {
      await tx.query("SET LOCAL ROLE authenticated");
      await tx.query("SELECT * FROM preprint_batch_deletions");
    }),
  ).rejects.toThrow();
  const auditRow = await one(
    db,
    "SELECT safe_metadata FROM audit_logs WHERE action='preprint_deleted'",
  );
  expect(JSON.stringify(auditRow)).not.toContain(b.doc.tickets[0].credential);
});
it("no borra ventas ni parte de un lote mixto, valida gestor/evento y confirmación", async () => {
  const b = await batch(2),
    [sold, pending] = b.doc.tickets;
  const sale = await activate(sold.credential);
  const remove = {
    action: "preprint_delete",
    event_id: e1,
    batch_id: b.batch_id,
    reason: "Retirar",
    confirmed: true,
  };
  await expect(execute(db, admin, remove)).rejects.toThrow("vendidas");
  await expect(
    execute(db, box, { ...remove, ticket_id: pending.id }),
  ).rejects.toThrow();
  await expect(
    execute(db, admin, { ...remove, event_id: e2, ticket_id: pending.id }),
  ).rejects.toThrow();
  await expect(
    execute(db, admin, { ...remove, ticket_id: pending.id, confirmed: false }),
  ).rejects.toThrow();
  expect(
    (await one(db, "SELECT count(*)::int AS n FROM preprinted_tickets")).n,
  ).toBe(2);
  await execute(db, admin, { ...remove, ticket_id: pending.id });
  expect(
    (await one(db, "SELECT status FROM orders WHERE id=$1", [sale.order_id]))
      .status,
  ).toBe("confirmed");
  expect((await one(db, "SELECT count(*)::int AS n FROM payments")).n).toBe(1);
  expect((await scan(sold.credential)).result).toBe("accepted");
  expect((await preprintDocument(db, admin, b.batch_id)).can_delete_batch).toBe(
    false,
  );
});
