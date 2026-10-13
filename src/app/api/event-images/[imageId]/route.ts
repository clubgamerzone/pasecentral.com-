import { z } from "zod";
import { currentActor, requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { permit, can, one, audit, fail, rateLimit } from "@/lib/service";
import { originCheck, errorResponse } from "@/lib/http";
import { readEventImage, removeEventImage } from "@/lib/event-images";
export const runtime = "nodejs";
type Context = { params: Promise<{ imageId: string }> };
export async function GET(_req: Request, { params }: Context) {
  try {
    const db = await database(),
      id = z.uuid().parse((await params).imageId);
    const image = await one(
      db,
      "SELECT i.path,i.event_id,e.status FROM event_images i JOIN events e ON e.id=i.event_id WHERE i.id=$1",
      [id],
    );
    if (image.status !== "published") {
      const a = await currentActor();
      if (!a || !(await can(db, a, image.event_id, "view")))
        fail("Imagen no disponible", 404);
    }
    return new Response(new Uint8Array(await readEventImage(image.path)), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request, { params }: Context) {
  try {
    originCheck(req);
    const a = await requireActor(),
      db = await database(),
      id = z.uuid().parse((await params).imageId);
    await rateLimit(db, `event-image:${a.id}`, 20);
    let path = "";
    await db.transaction(async (tx) => {
      const image = await one(tx, "SELECT * FROM event_images WHERE id=$1", [
        id,
      ]);
      await permit(tx, a, image.event_id, "manage");
      const e = await one(
        tx,
        "SELECT cover_path FROM events WHERE id=$1 FOR UPDATE",
        [image.event_id],
      );
      await tx.query("DELETE FROM event_images WHERE id=$1", [id]);
      if (e.cover_path === image.path) {
        const next = (
          await tx.query(
            "SELECT path FROM event_images WHERE event_id=$1 ORDER BY created_at,id LIMIT 1",
            [image.event_id],
          )
        ).rows[0];
        await tx.query("UPDATE events SET cover_path=$2 WHERE id=$1", [
          image.event_id,
          next?.path ?? null,
        ]);
      }
      path = image.path;
      await audit(tx, a, "event_image_removed", "event", image.event_id, {
        image_id: id,
      });
    });
    await removeEventImage(path);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
