import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { memoryDb, type DB } from "../src/lib/db";
import { seed, USERS, DEMO_ORG } from "../src/lib/seed";
import { execute, one, ticketDocument } from "../src/lib/service";
import { state } from "../src/lib/state";
import { analytics } from "../src/lib/analytics";
const eventId = "00000000-0000-4000-8000-000000000002";
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
async function edit(overrides: Record<string, unknown> = {}) {
  const e = await one(db, "SELECT * FROM events WHERE id=$1", [eventId]);
  return execute(db, USERS[0], {
    action: "update_event",
    event_id: eventId,
    title: e.title,
    description: e.description,
    venue_name: e.venue_name,
    address: e.address,
    starts_at: new Date(e.starts_at).toISOString(),
    admission_starts_at: new Date(e.admission_starts_at).toISOString(),
    capacity: null,
    ends_at: null,
    admission_ends_at: null,
    ...overrides,
  });
}
async function sell(quantity: number) {
  const type = await one(
    db,
    "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
    [eventId],
  );
  return execute(db, USERS[2], {
    action: "sell",
    event_id: eventId,
    method: "transfer",
    verified: true,
    reference: "PRUEBA",
    idempotency_key: randomUUID(),
    items: [{ ticket_type_id: type.id, quantity }],
  });
}
it("crea evento sin aforo ni fechas finales y mantiene fechas finitas inválidas rechazadas", async () => {
  const starts_at = new Date(Date.now() + 3600000).toISOString();
  const input = {
    action: "create_event",
    organization_id: DEMO_ORG,
    title: "Opciones · DEMO",
    slug: "opciones-demo",
    description: "Ficticio",
    venue_name: "Recinto",
    address: "Dirección ficticia",
    starts_at,
    admission_starts_at: starts_at,
    capacity: null,
  };
  const result = await execute(db, USERS[0], input);
  expect(
    await one(
      db,
      "SELECT capacity,ends_at,admission_ends_at FROM events WHERE id=$1",
      [result.event_id],
    ),
  ).toEqual({ capacity: null, ends_at: null, admission_ends_at: null });
  await expect(
    execute(db, USERS[0], {
      ...input,
      slug: "invalido",
      ends_at: new Date(Date.now()).toISOString(),
    }),
  ).rejects.toThrow("posteriores");
  await expect(
    execute(db, USERS[0], {
      ...input,
      slug: "cierre-invalido",
      admission_ends_at: new Date(Date.now()).toISOString(),
    }),
  ).rejects.toThrow("posteriores");
});
it("permite vender y leer QR sin límites globales/finales, conservando el cupo de localidad", async () => {
  await edit();
  const type = await one(
    db,
    "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
    [eventId],
  );
  await execute(db, USERS[0], {
    action: "update_type",
    event_id: eventId,
    ticket_type_id: type.id,
    name: "General",
    capacity: 2,
  });
  const sale = await sell(2);
  await expect(sell(1)).rejects.toThrow("Sin cupo");
  await expect(edit({ capacity: 1 })).rejects.toThrow("comprometidas");
  await expect(edit({ capacity: 49 })).rejects.toThrow("localidades");
  const doc = await ticketDocument(db, USERS[2], sale.order_id);
  expect(
    await execute(db, USERS[3], {
      action: "scan_auto",
      credential: doc.tickets[0].credential,
      request_id: randomUUID(),
      device_id: "PRUEBA",
      gate_label: "Puerta",
    }),
  ).toMatchObject({ result: "accepted" });
  const data = await state(db, USERS[0]);
  expect(data.events.find((e) => e.id === eventId)?.available).toBeNull();
  const report = await analytics(db, USERS[0], {});
  expect(report.events.find((e) => e.event_id === eventId)).toMatchObject({
    capacity: null,
    available: null,
    occupancy: null,
  });
  expect(report.summary.available).toBeNull();
  await edit({ capacity: 200 });
  expect(
    (await one(db, "SELECT capacity FROM events WHERE id=$1", [eventId]))
      .capacity,
  ).toBe(200);
});
it("sin cierre explícito respeta el fin programado y, sin ambos, el estado finalizado", async () => {
  const sale = await sell(2);
  const doc = await ticketDocument(db, USERS[2], sale.order_id);
  const starts_at = new Date(Date.now() - 7200000).toISOString();
  await edit({
    starts_at,
    admission_starts_at: starts_at,
    ends_at: new Date(Date.now() - 3600000).toISOString(),
  });
  const scan = (index: number) =>
    execute(db, USERS[3], {
      action: "scan_auto",
      credential: doc.tickets[index].credential,
      request_id: randomUUID(),
      device_id: "PRUEBA",
      gate_label: "Puerta",
    });
  expect(await scan(0)).toMatchObject({ result: "outside_admission_window" });
  await edit();
  await execute(db, USERS[0], {
    action: "event_status",
    event_id: eventId,
    status: "sales_closed",
  });
  await execute(db, USERS[0], {
    action: "event_status",
    event_id: eventId,
    status: "finished",
  });
  expect(await scan(1)).toMatchObject({ result: "outside_admission_window" });
});
it("localidades ilimitadas requieren aforo ilimitado y bloquean reducirlo hasta definir todos los cupos", async () => {
  const type = await one(
    db,
    "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
    [eventId],
  );
  await expect(
    execute(db, USERS[0], {
      action: "update_type",
      event_id: eventId,
      ticket_type_id: type.id,
      name: "General",
      capacity: null,
    }),
  ).rejects.toThrow("aforo ilimitado");
  await expect(
    execute(db, USERS[0], {
      action: "add_type",
      event_id: eventId,
      name: "Sin límite",
      capacity: null,
    }),
  ).rejects.toThrow("aforo ilimitado");
  await edit();
  await execute(db, USERS[0], {
    action: "update_type",
    event_id: eventId,
    ticket_type_id: type.id,
    name: "General",
    capacity: null,
  });
  await sell(20);
  await sell(20);
  await expect(edit({ capacity: 200 })).rejects.toThrow(
    "localidades ilimitadas",
  );
  await expect(
    execute(db, USERS[0], {
      action: "update_type",
      event_id: eventId,
      ticket_type_id: type.id,
      name: "General",
      capacity: 39,
    }),
  ).rejects.toThrow("comprometidas");
  await execute(db, USERS[0], {
    action: "update_type",
    event_id: eventId,
    ticket_type_id: type.id,
    name: "General",
    capacity: 40,
  });
  await execute(db, USERS[0], {
    action: "add_type",
    event_id: eventId,
    name: "Sin límite",
    capacity: null,
  });
  const extra = await one(
    db,
    "SELECT id,capacity FROM ticket_types WHERE event_id=$1 AND name='Sin límite'",
    [eventId],
  );
  expect(extra.capacity).toBeNull();
  await execute(db, USERS[0], {
    action: "update_type",
    event_id: eventId,
    ticket_type_id: extra.id,
    name: "Sin límite",
    capacity: 1,
  });
  await edit({ capacity: 200 });
});

it("fase hasta fin de evento sigue cambios, bloquea solapamientos y deja de vender al finalizar", async () => {
  const t = await one(
    db,
    "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
    [eventId],
  );
  await db.query(
    "DELETE FROM pricing_phases WHERE ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id=$1)",
    [eventId],
  );
  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  const input = {
    action: "add_phase",
    event_id: eventId,
    ticket_type_id: t.id,
    name: "Hasta final",
    channel: "both",
    price_cop: 10000,
    starts_at: past,
    ends_at: null,
  };
  await execute(db, USERS[0], input);
  await expect(
    execute(db, USERS[0], { ...input, name: "Superpuesta", ends_at: future }),
  ).rejects.toThrow();
  await edit({ starts_at: past, admission_starts_at: past, ends_at: future });
  let s = await state(db, USERS[0]);
  let p = s.phases.find((p) => p.ticket_type_id === t.id)!;
  expect(p.ends_with_event).toBe(true);
  expect(new Date(p.effective_ends_at).toISOString()).toBe(future);
  await sell(1);
  await edit({
    starts_at: past,
    admission_starts_at: past,
    ends_at: new Date(Date.now() - 60000).toISOString(),
  });
  await expect(sell(1)).rejects.toThrow();
  await edit({ starts_at: past, admission_starts_at: past });
  s = await state(db, USERS[0]);
  p = s.phases.find((p) => p.ticket_type_id === t.id)!;
  expect(p.effective_ends_at).toBeNull();
  await sell(1);
  await expect(
    execute(db, USERS[0], {
      ...input,
      action: "update_phase",
      phase_id: p.id,
      ends_at: past,
    }),
  ).rejects.toThrow();
  await db.query("UPDATE events SET status='finished' WHERE id=$1", [eventId]);
  await expect(sell(1)).rejects.toThrow("ventas abiertas");
});
