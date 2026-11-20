import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { permit, one, fail, rateLimit } from "@/lib/service";
import { setTicketArt, setTicketArtCaption } from "@/lib/ticket-art";
import { errorResponse, originCheck, jsonBody } from "@/lib/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ eventId: string }> };
export async function PATCH(req: Request, { params }: Context) {
  try {
    originCheck(req);
    const eventId = z.uuid().parse((await params).eventId),
      actor = await requireActor(),
      db = await database();
    await rateLimit(db, `ticket-art:${actor.id}`, 20);
    const { caption } = z
      .object({ caption: z.string().trim().min(1).max(40) })
      .parse(await jsonBody(req));
    await setTicketArtCaption(db, actor, eventId, caption);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function GET(_req: Request, { params }: Context) {
  try {
    const eventId = z.uuid().parse((await params).eventId),
      actor = await requireActor(),
      db = await database();
    await permit(db, actor, eventId, "manage");
    const art = await one(
      db,
      "SELECT image_png FROM event_ticket_art WHERE event_id=$1",
      [eventId],
    );
    return new Response(new Uint8Array(art.image_png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request, { params }: Context) {
  try {
    originCheck(req);
    const eventId = z.uuid().parse((await params).eventId),
      actor = await requireActor(),
      db = await database();
    await permit(db, actor, eventId, "manage");
    await rateLimit(db, `ticket-art:${actor.id}`, 20);
    const length = Number(req.headers.get("content-length"));
    if (!length || length > 4 * 1024 * 1024 + 65536)
      fail("Usa una imagen de hasta 4 MB", 413);
    const form = await req.formData();
    const caption = z
      .string()
      .trim()
      .min(1)
      .max(40)
      .parse(form.get("caption") ?? "VIVE EL MOMENTO");
    const file = form.get("image");
    if (!(file instanceof File)) fail("Selecciona una imagen");
    await setTicketArt(
      db,
      actor,
      eventId,
      Buffer.from(await file.arrayBuffer()),
      caption,
    );
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request, { params }: Context) {
  try {
    originCheck(req);
    const eventId = z.uuid().parse((await params).eventId),
      actor = await requireActor(),
      db = await database();
    await rateLimit(db, `ticket-art:${actor.id}`, 20);
    await setTicketArt(db, actor, eventId, null);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
