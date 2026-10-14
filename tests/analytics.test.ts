import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { memoryDb, type DB } from "../src/lib/db";
import { seed, USERS } from "../src/lib/seed";
import { execute, one, settle } from "../src/lib/service";
import { state } from "../src/lib/state";
import {
  analytics,
  buildAnalytics,
  parseAnalyticsFilters,
  type AnalyticsDataset,
} from "../src/lib/analytics";
import { csv } from "../src/lib/csv";
const e1 = "00000000-0000-4000-8000-000000000002",
  e2 = "00000000-0000-4000-8000-000000000003";
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
async function item(event = e1) {
  return (
    await one(
      db,
      "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
      [event],
    )
  ).id;
}
describe("Audiencia individual, consentimiento y permisos", () => {
  it("vincula tres asistentes diferentes, no duplica en reintentos y entrega solo agregados", async () => {
    const command = {
      action: "sell",
      event_id: e1,
      items: [
        {
          ticket_type_id: await item(),
          quantity: 3,
          attendees: [
            { gender: "female", age_band: "25_34" },
            { gender: "male", age_band: "6_12" },
            { gender: null, age_band: null },
          ],
        },
      ],
      demographics_consent: true,
      method: "transfer",
      verified: true,
      reference: "TEST",
      idempotency_key: randomUUID(),
    };
    const order = await execute(db, USERS[2], command);
    await execute(db, USERS[2], command);
    const tickets = (
      await db.query(
        "SELECT t.attendee_id,a.gender,a.age_band FROM tickets t JOIN order_attendees a ON a.id=t.attendee_id",
      )
    ).rows;
    expect(tickets).toHaveLength(3);
    expect(new Set(tickets.map((t) => t.attendee_id)).size).toBe(3);
    const r = await analytics(db, USERS[0]);
    expect(r.summary.sold_tickets).toBe(3);
    expect(r.summary.children).toBe(1);
    expect(r.summary.gender_provided).toBe(2);
    expect(r.gender.find((g) => g.key === "unknown")?.count).toBe(1);
    expect(r.phases[0].quantity).toBe(3);
    expect(r.operators[0].label).toBe(USERS[2].name);
    const wire = JSON.stringify(r);
    expect(wire).not.toContain("attendee_id");
    expect(wire).not.toContain("credential");
    expect(wire).not.toContain("@");
    const s = await state(db, USERS[0]);
    expect(s.tickets[0]).not.toHaveProperty("gender");
    expect(s.tickets[0]).not.toHaveProperty("attendee_id");
    expect(
      (
        await one(db, "SELECT confirmed_at FROM orders WHERE id=$1", [
          order.order_id,
        ])
      ).confirmed_at,
    ).toBeTruthy();
  });
  it("rechaza datos sin consentimiento, cantidades inconsistentes y rangos no admitidos sin crear ventas", async () => {
    const command = {
      action: "sell",
      event_id: e1,
      items: [
        {
          ticket_type_id: await item(),
          quantity: 1,
          attendees: [{ gender: "female" }],
        },
      ],
      method: "transfer",
      verified: true,
      reference: "TEST",
      idempotency_key: randomUUID(),
    };
    await expect(execute(db, USERS[2], command)).rejects.toThrow(
      "autorización",
    );
    await expect(
      execute(db, USERS[2], {
        ...command,
        demographics_consent: true,
        items: [
          {
            ticket_type_id: await item(),
            quantity: 2,
            attendees: [{ gender: "female" }],
          },
        ],
      }),
    ).rejects.toThrow("por cada entrada");
    await expect(
      execute(db, USERS[2], {
        ...command,
        demographics_consent: true,
        items: [
          {
            ticket_type_id: await item(),
            quantity: 1,
            attendees: [{ age_band: "99" }],
          },
        ],
      }),
    ).rejects.toThrow();
    expect((await db.query("SELECT id FROM orders")).rows).toHaveLength(0);
  });
  it("preserva datos al confirmar web repetido y admite omitirlos completamente", async () => {
    const reserve = await execute(db, USERS[4], {
      action: "reserve",
      event_id: e1,
      items: [
        {
          ticket_type_id: await item(),
          quantity: 1,
          attendees: [{ gender: "prefer_not_to_say", age_band: "18_24" }],
        },
      ],
      demographics_consent: true,
      buyer_name: "Ficticio",
      buyer_email: "test@example.test",
      idempotency_key: randomUUID(),
    });
    const pay = {
      orderId: reserve.order_id,
      transactionId: "TEST-APPROVED",
      amount:
        (
          await one(db, "SELECT total_cop FROM orders WHERE id=$1", [
            reserve.order_id,
          ])
        ).total_cop * 100,
      currency: "COP",
      status: "APPROVED",
    };
    await db.transaction((tx) => settle(tx, pay));
    await db.transaction((tx) => settle(tx, pay));
    await execute(db, USERS[2], {
      action: "sell",
      event_id: e1,
      items: [{ ticket_type_id: await item(), quantity: 1 }],
      method: "transfer",
      verified: true,
      reference: "TEST",
      idempotency_key: randomUUID(),
    });
    const r = await analytics(db, USERS[0]);
    expect(r.summary.sold_tickets).toBe(2);
    expect(r.summary.age_provided).toBe(1);
    expect(r.gender.find((g) => g.key === "prefer_not_to_say")?.count).toBe(1);
    expect(r.gender.find((g) => g.key === "unknown")?.count).toBe(1);
    expect(
      (await db.query("SELECT id FROM order_attendees")).rows,
    ).toHaveLength(2);
    expect(r.operators.find((o) => o.key === "online")?.label).toBe(
      "Venta online",
    );
  });
  it("deniega caja, acceso y comprador; limita organizador por evento", async () => {
    for (const actor of USERS.slice(2))
      await expect(analytics(db, actor)).rejects.toThrow("permiso");
    await db.query(
      "UPDATE event_staff SET role='organizer' WHERE user_id=$1 AND event_id=$2",
      [USERS[2].id, e1],
    );
    expect(
      (await analytics(db, USERS[2])).events.map((e) => e.event_id),
    ).toEqual([e1]);
    await expect(analytics(db, USERS[2], { event_ids: [e2] })).rejects.toThrow(
      "permiso",
    );
    expect((await analytics(db, USERS[1])).events).toHaveLength(2);
  });
  it("RLS impide acceso directo a demografía individual incluso como administrador autenticado", async () => {
    for (const role of ["anon", "authenticated"])
      await expect(
        db.transaction(async (tx) => {
          await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
            USERS[0].id,
          ]);
          await tx.query(`SET LOCAL ROLE ${role}`);
          await tx.query("SELECT * FROM order_attendees");
        }),
      ).rejects.toThrow("permission denied");
  });
});
function fixture(): AnalyticsDataset {
  const confirmed_at = "2026-01-02T05:30:00Z",
    old = "2025-12-31T22:00:00Z";
  return {
    events: [
      { id: e1, title: "A", starts_at: "2026-01-01T03:00:00Z", capacity: 20 },
      { id: e2, title: "B", starts_at: "2026-01-02T12:00:00Z", capacity: 10 },
    ],
    orders: [
      {
        id: "a",
        event_id: e1,
        status: "partially_refunded",
        channel: "web",
        total_cop: 30000,
        created_at: old,
        confirmed_at,
        buyer_user_id: "buyer",
      },
      {
        id: "b",
        event_id: e2,
        status: "confirmed",
        channel: "box_office",
        total_cop: 50000,
        created_at: old,
        confirmed_at,
      },
      {
        id: "c",
        event_id: e2,
        status: "confirmed",
        channel: "complimentary",
        total_cop: 0,
        created_at: old,
        confirmed_at,
      },
      {
        id: "d",
        event_id: e2,
        status: "needs_review",
        channel: "web",
        total_cop: 90000,
        created_at: confirmed_at,
        confirmed_at: null,
      },
      {
        id: "pending",
        event_id: e1,
        status: "pending_payment",
        channel: "web",
        created_at: confirmed_at,
        reservation_expires_at: "2026-01-04T10:00:00Z",
      },
    ],
    items: [
      {
        id: "ia",
        order_id: "a",
        event_id: e1,
        quantity: 2,
        line_total_cop: 30000,
        phase_name: "Preventa",
        type_name: "General",
        pricing_phase_id: "pa",
        ticket_type_id: "ta",
      },
      {
        id: "ib",
        order_id: "b",
        event_id: e2,
        quantity: 1,
        line_total_cop: 50000,
        phase_name: "Preventa",
        type_name: "General",
        pricing_phase_id: "pb",
        ticket_type_id: "tb",
      },
      { id: "ic", order_id: "c", event_id: e2, quantity: 1, line_total_cop: 0 },
      { id: "ip", order_id: "pending", event_id: e1, quantity: 3 },
    ],
    tickets: [
      {
        id: "1",
        order_id: "a",
        event_id: e1,
        order_item_id: "ia",
        status: "used",
        used_at: confirmed_at,
        gender: "female",
        age_band: "25_34",
      },
      {
        id: "2",
        order_id: "a",
        event_id: e1,
        order_item_id: "ia",
        status: "cancelled",
        used_at: confirmed_at,
        gender: "male",
        age_band: "6_12",
      },
      {
        id: "3",
        order_id: "b",
        event_id: e2,
        order_item_id: "ib",
        status: "valid",
      },
      {
        id: "4",
        order_id: "c",
        event_id: e2,
        order_item_id: "ic",
        status: "valid",
        gender: "other",
        age_band: "13_17",
      },
    ],
    payments: [
      {
        order_id: "a",
        status: "approved",
        method: "checkout",
        amount_cop: 30000,
        verified_at: confirmed_at,
      },
      {
        order_id: "b",
        status: "approved",
        method: "transfer",
        amount_cop: 50000,
        verified_at: confirmed_at,
      },
      {
        order_id: "d",
        status: "approved",
        method: "checkout",
        amount_cop: 90000,
        verified_at: confirmed_at,
      },
    ],
    refunds: [{ order_id: "a", amount_cop: 15000, status: "completed" }],
    people: [],
    attempts: [],
    cash: [],
  };
}
describe("Cálculos históricos, filtros y audiencia sin inferencias", () => {
  it("separa ventas, cortesías, devoluciones y cobros sin entradas; usa confirmación en Bogotá", () => {
    const r = buildAnalytics(
      fixture(),
      { from: "2026-01-02", to: "2026-01-02" },
      new Date("2026-01-03"),
    );
    expect(r.summary).toMatchObject({
      gross_cop: 80000,
      net_cop: 65000,
      approved_cop: 170000,
      sold_tickets: 3,
      complimentary_tickets: 1,
      used: 2,
      attendance_percent: 50,
      available: 23,
      pending_tickets: 3,
    });
    expect(r.timeline[0].label).toBe("2026-01-02");
    expect(r.events[0].label).toBe("A");
    expect(r.years.map((y) => y.label)).toEqual(["2025", "2026"]);
    expect(r.years[1].change_percent).toBe(233.3);
    expect(r.phases).toHaveLength(2);
    expect(r.global_types[0].quantity).toBe(3);
    expect(r.global_phases).toHaveLength(2);
    expect(
      buildAnalytics(fixture(), { from: "2025-12-31", to: "2025-12-31" })
        .summary.sold_tickets,
    ).toBe(0);
  });
  it("no aplica género del comprador al grupo, excluye anulados salvo ingresos históricos", () => {
    const active = buildAnalytics(fixture());
    expect(active.summary).toMatchObject({
      population: 3,
      children: 0,
      teenagers: 1,
      gender_provided: 2,
      age_provided: 2,
    });
    expect(active.gender.find((g) => g.key === "unknown")?.count).toBe(1);
    const used = buildAnalytics(fixture(), { audience: "used" });
    expect(used.summary).toMatchObject({
      population: 2,
      children: 1,
      teenagers: 0,
      age_provided: 2,
    });
  });
  it("filtra año del evento con zona horaria y permite comparación de dos eventos", () => {
    expect(
      buildAnalytics(fixture(), { year: 2025 }).events.map((e) => e.label),
    ).toEqual(["A"]);
    expect(
      buildAnalytics(fixture(), { event_ids: [e2] }).summary.sold_tickets,
    ).toBe(1);
    expect(
      parseAnalyticsFilters(
        new URL(
          `https://example.test/api/analytics?events=${e1},${e2}&year=2026`,
        ),
      ).event_ids,
    ).toEqual([e1, e2]);
    expect(() =>
      buildAnalytics(fixture(), { from: "2026-02-02", to: "2026-01-01" }),
    ).toThrow();
  });
  it("vacío muestra ceros y porcentajes cero; CSV mantiene encabezados y previene fórmulas", () => {
    const empty = buildAnalytics({
      ...fixture(),
      orders: [],
      tickets: [],
      items: [],
      payments: [],
      refunds: [],
    });
    expect(empty.summary.sold_tickets).toBe(0);
    expect(empty.summary.attendance_percent).toBe(0);
    expect(empty.summary.available).toBe(30);
    expect(csv([], { label: "Nombre", quantity: "Entradas" })).toContain(
      '"Nombre","Entradas"',
    );
    expect(
      csv([{ label: "=cmd", quantity: 1 }], {
        label: "Nombre",
        quantity: "Entradas",
      }),
    ).toContain("'=cmd");
  });
});
