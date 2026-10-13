import { randomUUID } from "node:crypto";
import { database } from "../src/lib/db";
import { execute, one, ticketDocument, type Actor } from "../src/lib/service";
import { demoMode } from "../src/lib/config";

// Persistent, clearly labelled test records are intentional; never run on the live commerce database.
if (
  demoMode() ||
  process.env.APP_ENVIRONMENT !== "staging" ||
  process.env.WOMPI_ENV !== "sandbox"
)
  throw new Error(
    "Solo se permite en la base staging conectada con Wompi sandbox.",
  );
const email = process.argv[2];
if (!email) throw new Error("Uso: npm run test:connected -- EMAIL_ADMIN");
const db = await database();
const account = await one(
  db,
  "SELECT p.id,p.name,u.email FROM profiles p JOIN platform_admins a ON a.user_id=p.id JOIN auth.users u ON u.id=p.id WHERE lower(u.email)=lower($1)",
  [email],
);
const actor: Actor = {
  id: account.id,
  name: account.name,
  email: account.email,
};
const org = await one(
  db,
  "SELECT id FROM organizations ORDER BY created_at LIMIT 1",
);
const since = new Date(Date.now() - 3600000).toISOString(),
  end = new Date(Date.now() + 7 * 86400000).toISOString();
async function event(title: string, capacity: number) {
  const e = await execute(db, actor, {
    action: "create_event",
    organization_id: org.id,
    title,
    slug: `ensayo-${randomUUID()}`,
    description:
      "Ensayo automatizado de staging: importes y aforo ficticios. No es un evento real.",
    venue_name: "Recinto ficticio de pruebas",
    address: "Dirección ficticia",
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    ends_at: end,
    admission_starts_at: since,
    admission_ends_at: end,
    capacity,
  });
  const t = await execute(db, actor, {
    action: "add_type",
    event_id: e.event_id,
    name: "General",
    capacity,
  });
  for (const channel of ["web", "box_office"])
    await execute(db, actor, {
      action: "add_phase",
      event_id: e.event_id,
      ticket_type_id: t.ticket_type_id,
      name: "Precio de ensayo · DEMO",
      channel,
      price_cop: 10000,
      starts_at: since,
      ends_at: end,
    });
  await execute(db, actor, {
    action: "event_status",
    event_id: e.event_id,
    status: "published",
  });
  return { id: e.event_id, type: t.ticket_type_id };
}
async function sell(e: { id: string; type: string }, quantity = 1) {
  return execute(db, actor, {
    action: "sell",
    event_id: e.id,
    items: [{ ticket_type_id: e.type, quantity }],
    method: "transfer",
    verified: true,
    reference: "ENSAYO-STAGING-SIN-DINERO",
    buyer_name: "Ensayo automatizado · DEMO",
    idempotency_key: randomUUID(),
  });
}
const single = await event("Ensayo de cupos · DEMO", 1),
  multiple = await event("Ensayo de varias entradas · DEMO", 3);
const sales = await Promise.allSettled(
  Array.from({ length: 6 }, () => sell(single)),
);
const accepted = sales.filter(
  (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof sell>>> =>
    r.status === "fulfilled",
);
if (accepted.length !== 1) throw new Error("Fallo: sobreventa concurrente");
const first = await ticketDocument(db, actor, accepted[0].value.order_id);
const credential = first.tickets[0].credential;
const attempt = () => ({
  action: "checkin",
  event_id: single.id,
  credential,
  request_id: randomUUID(),
  device_id: "TEST-SERVIDOR",
  gate_label: "Puerta de ensayo",
});
const reads = await Promise.all([
  execute(db, actor, attempt()),
  execute(db, actor, attempt()),
]);
if (
  reads.filter((r) => r.result === "accepted").length !== 1 ||
  reads.filter((r) => r.result === "already_used").length !== 1
)
  throw new Error("Fallo: ingreso doble");
const many = await sell(multiple, 3),
  doc = await ticketDocument(db, actor, many.order_id);
if (
  doc.tickets.length !== 3 ||
  new Set(doc.tickets.map((t) => t.credential)).size !== 3
)
  throw new Error("Fallo: emisión múltiple");
for (const e of [single, multiple])
  await execute(db, actor, {
    action: "event_status",
    event_id: e.id,
    status: "sales_closed",
  });
console.log(
  JSON.stringify({
    verified: true,
    independentEvents: 2,
    concurrentSales: 6,
    successfulSalesAtCapacityOne: accepted.length,
    checkinResults: reads.map((r) => r.result),
    individualTickets: doc.tickets.length,
    eventsStatus: "sales_closed",
    realMoneyMoved: false,
    emailsSent: false,
  }),
);
process.exit(0);
