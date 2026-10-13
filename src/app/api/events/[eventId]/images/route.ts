import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { permit, one, audit, fail, rateLimit } from "@/lib/service";
import { originCheck, errorResponse } from "@/lib/http";
import {
  normalizeEventImage,
  saveEventImage,
  removeEventImage,
} from "@/lib/event-images";
export const runtime = "nodejs";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    originCheck(req);
    const a = await requireActor(),
      db = await database(),
      eventId = z.uuid().parse((await params).eventId);
    await permit(db, a, eventId, "manage");
    await rateLimit(db, `event-image:${a.id}`, 20);
    const length = Number(req.headers.get("content-length"));
    if (!length || length > 4 * 1024 * 1024 + 65536)
      fail("Cada imagen debe pesar como máximo 4 MB", 413);
    const file = (await req.formData()).get("image");
    if (!(file instanceof File)) fail("Selecciona una imagen");
    const bytes = await normalizeEventImage(
      Buffer.from(await file.arrayBuffer()),
    );
    const id = randomUUID(),
      path = `${eventId}/${id}.webp`;
    await saveEventImage(path, bytes);
    try {
      await db.transaction(async (tx) => {
        await permit(tx, a, eventId, "manage");
        const e = await one(
          tx,
          "SELECT cover_path FROM events WHERE id=$1 FOR UPDATE",
          [eventId],
        );
        const count = await one(
          tx,
          "SELECT count(*)::int AS count FROM event_images WHERE event_id=$1",
          [eventId],
        );
        if (count.count >= 8)
          fail(
            "Puedes guardar hasta 8 imágenes; elimina una antes de agregar otra",
          );
        await tx.query(
          "INSERT INTO event_images(id,event_id,path,created_by) VALUES($1,$2,$3,$4)",
          [id, eventId, path, a.id],
        );
        if (!e.cover_path)
          await tx.query("UPDATE events SET cover_path=$2 WHERE id=$1", [
            eventId,
            path,
          ]);
        await audit(tx, a, "event_image_added", "event", eventId, {
          image_id: id,
        });
      });
    } catch (e) {
      await removeEventImage(path);
      throw e;
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
