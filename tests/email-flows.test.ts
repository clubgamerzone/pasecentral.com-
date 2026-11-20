import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { memoryDb, type DB } from "../src/lib/db";
import { seed, USERS } from "../src/lib/seed";
import { execute, one, settle, ticketDocument } from "../src/lib/service";
import { deliver } from "../src/lib/delivery";
import { authEmailTemplates } from "../src/lib/auth-email-templates";

let db: DB;
const event = "00000000-0000-4000-8000-000000000002";
const buyer = USERS[4],
  recipient = USERS[0]; // A recipient can also be platform admin.
type Mail = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: string; content_type: string }[];
};
let mails: Mail[];
beforeAll(async () => {
  db = await memoryDb();
});
beforeEach(async () => {
  vi.stubEnv("APP_MODE", "staging");
  vi.stubEnv("APP_URL", "https://example.test");
  vi.stubEnv("TICKET_ENCRYPTION_KEY", "11".repeat(32));
  vi.stubEnv("EMAIL_API_KEY", "fake-test-only");
  vi.stubEnv("EMAIL_FROM", "Prueba <tickets@example.test>");
  mails = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      expect(_url).toBe("https://api.resend.com/emails");
      expect(
        (init.headers as Record<string, string>)["Idempotency-Key"],
      ).toBeTruthy();
      mails.push(JSON.parse(String(init.body)));
      return new Response('{"id":"mock-provider-id"}', { status: 200 });
    }),
  );
  await db.query("TRUNCATE organizations,profiles CASCADE");
  await seed(db);
  await db.query("UPDATE profiles SET gender='prefer_not_to_say'");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await (db as DB & { close(): Promise<void> }).close();
});

async function purchase(quantity = 2, gift = false) {
  const type = await one(
    db,
    "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
    [event],
  );
  const order = await execute(db, buyer, {
    action: "reserve",
    event_id: event,
    items: [{ ticket_type_id: type.id, quantity }],
    buyer_name: "Persona ficticia",
    buyer_email: buyer.email,
    is_gift: gift,
    ...(gift ? { gift_email: recipient.email } : {}),
    idempotency_key: randomUUID(),
    admission_age_confirmed: true,
  });
  await db.transaction((tx) =>
    settle(tx, {
      orderId: order.order_id,
      transactionId: randomUUID(),
      amount: quantity * 45000 * 100,
      currency: "COP",
      status: "APPROVED",
    }),
  );
  return order.order_id;
}

async function assertDoublePdfs(mail: Mail, count: number) {
  const pdfs =
    mail.attachments?.filter((a) => a.content_type === "application/pdf") ?? [];
  expect(pdfs).toHaveLength(count);
  for (const file of pdfs) {
    const pdf = await PDFDocument.load(Buffer.from(file.content, "base64"));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo((70 * 72) / 25.4, 3);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo((80 * 72) / 25.4, 3);
  }
  expect(
    mail.attachments?.filter((a) => a.content_type === "image/png"),
  ).toHaveLength(count);
}

it("compra aprobada envía un PDF doble y un QR individual por entrada, sin duplicar en el siguiente ciclo", async () => {
  await purchase();
  expect((await deliver(db)).processed).toBe(1);
  expect(mails).toHaveLength(1);
  expect(mails[0].to).toEqual([buyer.email]);
  await assertDoublePdfs(mails[0], 2);
  expect(mails[0].text).toContain("Adjuntamos 2 entradas");
  expect((await deliver(db)).processed).toBe(0);
  expect(mails).toHaveLength(1);
});

it("regalo avisa a ambas partes sin QR; al aceptar entrega PDF solo al destinatario", async () => {
  const order = await purchase(1, true);
  const result = await deliver(db);
  expect(result).toEqual({ processed: 0, invitations: 0, notifications: 2 });
  expect(new Set(mails.map((m) => m.to[0]))).toEqual(
    new Set([buyer.email, recipient.email]),
  );
  expect(mails.every((m) => !m.attachments && !m.text.includes("pc:"))).toBe(
    true,
  );
  expect(mails.find((m) => m.to[0] === recipient.email)?.text).toContain(
    "7 días",
  );
  expect(mails.find((m) => m.to[0] === recipient.email)?.text).toContain(
    "/login?register=1",
  );
  const gift = await one(db, "SELECT id FROM ticket_transfers");
  await execute(db, recipient, {
    action: "transfer_resolve",
    transfer_id: gift.id,
    accept: true,
  });
  mails = [];
  expect((await deliver(db)).processed).toBe(1);
  const pdfMail = mails.find((m) => m.attachments?.length)!;
  expect(pdfMail.to).toEqual([recipient.email]);
  await assertDoublePdfs(pdfMail, 1);
  expect(pdfMail.text).toContain("https://example.test/account/tickets");
  expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(1);
  expect((await ticketDocument(db, buyer, order)).tickets).toHaveLength(0);
});

it("transferencia parcial a un administrador no adjunta las otras entradas de la orden", async () => {
  const order = await purchase(2);
  await deliver(db);
  const doc = await ticketDocument(db, buyer, order);
  const selected = doc.tickets[0],
    retained = doc.tickets[1];
  const transfer = await execute(db, buyer, {
    action: "transfer_create",
    ticket_ids: [selected.id],
    recipient_email: recipient.email,
  });
  await execute(db, recipient, {
    action: "transfer_resolve",
    transfer_id: transfer.id,
    accept: true,
  });
  mails = [];
  await deliver(db);
  const pdfMail = mails.find((m) => m.attachments?.length)!;
  expect(pdfMail.to).toEqual([recipient.email]);
  await assertDoublePdfs(pdfMail, 1);
  expect(pdfMail.text).toContain(selected.visible_number);
  expect(pdfMail.text).not.toContain(retained.visible_number);
});

it("taquilla entrega al contacto solicitado; invitación de trabajo usa enlace de aceptación y no PDF", async () => {
  const type = await one(
    db,
    "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
    [event],
  );
  await execute(db, USERS[2], {
    action: "cash_open",
    event_id: event,
    opening_cash_cop: 0,
  });
  await execute(db, USERS[2], {
    action: "sell",
    event_id: event,
    items: [{ ticket_type_id: type.id, quantity: 1 }],
    buyer_name: "Persona ficticia",
    buyer_email: "contact@example.test",
    method: "cash",
    idempotency_key: randomUUID(),
  });
  await execute(db, USERS[0], {
    action: "invite_create",
    name: "Trabajador ficticio",
    email: "worker@example.test",
    role: "box_office",
    event_ids: [event],
    include_access: true,
  });
  expect(await deliver(db)).toEqual({
    processed: 1,
    invitations: 1,
    notifications: 0,
  });
  await assertDoublePdfs(
    mails.find((m) => m.to[0] === "contact@example.test")!,
    1,
  );
  const invitation = mails.find((m) => m.to[0] === "worker@example.test")!;
  expect(invitation.attachments).toBeUndefined();
  expect(invitation.text).toContain("/invite");
  expect(invitation.text).toContain("lector QR");
});

it("plantillas Auth están en español y utilizan callbacks propios para confirmar/recuperar", () => {
  for (const template of authEmailTemplates) {
    expect(template.html).toContain('lang="es"');
    expect(template.subject).toContain("Pase Central");
  }
  expect(
    authEmailTemplates.find((t) => t.id === "confirm-sign-up")?.html,
  ).toContain("type=signup");
  expect(
    authEmailTemplates.find((t) => t.id === "reset-password")?.html,
  ).toContain("type=recovery");
});
