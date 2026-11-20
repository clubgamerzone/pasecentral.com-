import sharp from "sharp";
import type { DB } from "./db";
import { normalizeEventImage } from "./event-images";
import { audit, permit, one, type Actor } from "./service";

export async function normalizeTicketArt(bytes: Buffer) {
  const safe = await normalizeEventImage(bytes);
  return sharp(safe)
    .flatten({ background: "white" })
    .resize(480, 120, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .threshold(170)
    .png()
    .toBuffer();
}
export async function setTicketArt(
  db: DB,
  actor: Actor,
  eventId: string,
  bytes: Buffer | null,
  caption = "VIVE EL MOMENTO",
) {
  // Check before processing and again under the event lock.
  await permit(db, actor, eventId, "manage");
  const png = bytes ? await normalizeTicketArt(bytes) : null;
  await db.transaction(async (tx) => {
    await permit(tx, actor, eventId, "manage");
    await one(tx, "SELECT id FROM events WHERE id=$1 FOR UPDATE", [eventId]);
    if (png)
      await tx.query(
        "INSERT INTO event_ticket_art(event_id,image_png,updated_by,caption) VALUES($1,$2,$3,$4) ON CONFLICT(event_id) DO UPDATE SET image_png=excluded.image_png,caption=excluded.caption,updated_by=excluded.updated_by,updated_at=now()",
        [eventId, png, actor.id, caption],
      );
    else
      await tx.query("DELETE FROM event_ticket_art WHERE event_id=$1", [
        eventId,
      ]);
    await audit(
      tx,
      actor,
      png ? "ticket_art_updated" : "ticket_art_removed",
      "event",
      eventId,
    );
  });
}
export async function setTicketArtCaption(
  db: DB,
  actor: Actor,
  eventId: string,
  caption: string,
) {
  await db.transaction(async (tx) => {
    await permit(tx, actor, eventId, "manage");
    await one(tx, "SELECT id FROM events WHERE id=$1 FOR UPDATE", [eventId]);
    await one(
      tx,
      "UPDATE event_ticket_art SET caption=$2,updated_by=$3,updated_at=now() WHERE event_id=$1 RETURNING event_id",
      [eventId, caption, actor.id],
    );
    await audit(tx, actor, "ticket_art_updated", "event", eventId);
  });
}
