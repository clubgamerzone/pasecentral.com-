import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { memoryDb, type DB } from "../src/lib/db";
import { seed, USERS } from "../src/lib/seed";
import {
  setTicketArt,
  normalizeTicketArt,
  setTicketArtCaption,
} from "../src/lib/ticket-art";
import { execute, ticketDocument, one } from "../src/lib/service";
import { ticketPdf } from "../src/lib/pdf";
import { state } from "../src/lib/state";
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
const artwork = () =>
  sharp({
    create: { width: 800, height: 250, channels: 3, background: "#345678" },
  })
    .png()
    .toBuffer();
it("solo un gestor cambia el arte, con RLS cerrado, normalización y sin publicar bytes en estado", async () => {
  await expect(
    setTicketArt(db, USERS[2], eventId, await artwork()),
  ).rejects.toThrow("permiso");
  await expect(
    normalizeTicketArt(Buffer.from("<svg><script/></svg>")),
  ).rejects.toThrow();
  await setTicketArt(db, USERS[0], eventId, await artwork(), "MI EVENTO");
  const art = await one(
    db,
    "SELECT image_png,caption FROM event_ticket_art WHERE event_id=$1",
    [eventId],
  );
  const pixels = await sharp(Buffer.from(art.image_png))
    .grayscale()
    .raw()
    .toBuffer();
  expect(pixels.every((v) => v === 0 || v === 255)).toBe(true);
  const meta = await sharp(Buffer.from(art.image_png)).metadata();
  expect(meta.width).toBeLessThanOrEqual(480);
  expect(meta.height).toBeLessThanOrEqual(120);
  const snapshot = await state(db, USERS[0]);
  expect(snapshot.events.find((e) => e.id === eventId)?.has_ticket_art).toBe(
    true,
  );
  expect(JSON.stringify(snapshot)).not.toContain("image_png");
  await expect(
    db.transaction(async (tx) => {
      await tx.query("SET LOCAL ROLE authenticated");
      await tx.query("SELECT * FROM event_ticket_art");
    }),
  ).rejects.toThrow();
  await setTicketArtCaption(db, USERS[0], eventId, "OTRA FRASE");
  expect(
    (
      await one(db, "SELECT caption FROM event_ticket_art WHERE event_id=$1", [
        eventId,
      ])
    ).caption,
  ).toBe("OTRA FRASE");
  await setTicketArt(db, USERS[0], eventId, null);
  expect((await db.query("SELECT * FROM event_ticket_art")).rows).toHaveLength(
    0,
  );
});
it("PDF de una página70x80 por persona y precio histórico incluso tras editar la fase, sin emitir dos tickets", async () => {
  await setTicketArt(db, USERS[0], eventId, await artwork());
  const type = await one(
    db,
    "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
    [eventId],
  );
  const sale = await execute(db, USERS[2], {
    action: "sell",
    event_id: eventId,
    method: "transfer",
    verified: true,
    reference: "PRUEBA",
    idempotency_key: randomUUID(),
    items: [{ ticket_type_id: type.id, quantity: 1 }],
  });
  const original = await ticketDocument(db, USERS[2], sale.order_id);
  const oldPrice = original.tickets[0].unit_price_cop;
  await db.query(
    "UPDATE pricing_phases SET price_cop=99000 WHERE ticket_type_id=$1",
    [type.id],
  );
  const doc = await ticketDocument(db, USERS[2], sale.order_id);
  expect(doc.tickets).toHaveLength(1);
  expect(doc.tickets[0].unit_price_cop).toBe(oldPrice);
  expect(doc.tickets[0].credential).toBe(original.tickets[0].credential);
  const pdf = await PDFDocument.load(await ticketPdf(doc));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo((70 * 72) / 25.4, 2);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo((80 * 72) / 25.4, 2);
  await expect(ticketDocument(db, USERS[4], sale.order_id)).rejects.toThrow(
    "permiso",
  );
});
