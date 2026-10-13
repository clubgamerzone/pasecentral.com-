import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { requireActor, supabase } from "@/lib/auth";
import { database } from "@/lib/db";
import { demoMode } from "@/lib/config";
import { audit, one, fail, rateLimit } from "@/lib/service";
import { originCheck, errorResponse } from "@/lib/http";
import { normalizeAvatar } from "@/lib/avatar";
export const runtime = "nodejs";
async function remove(path: string) {
  if (demoMode())
    await unlink(
      join(process.cwd(), ".local", "avatars", path.replace("/", "-")),
    ).catch(() => {});
  else await (await supabase()).storage.from("avatars").remove([path]);
}
export async function GET() {
  try {
    const a = await requireActor();
    const p = await one(
      await database(),
      "SELECT avatar_path FROM profiles WHERE id=$1",
      [a.id],
    );
    if (!p.avatar_path) fail("No hay foto de perfil", 404);
    const bytes = demoMode()
      ? await readFile(
          join(
            process.cwd(),
            ".local",
            "avatars",
            p.avatar_path.replace("/", "-"),
          ),
        )
      : await (async () => {
          const { data, error } = await (
            await supabase()
          ).storage
            .from("avatars")
            .download(p.avatar_path);
          if (error || !data) fail("No se pudo cargar la foto", 503);
          return Buffer.from(await data.arrayBuffer());
        })();
    return new Response(new Uint8Array(bytes), {
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
export async function POST(req: Request) {
  try {
    originCheck(req);
    const a = await requireActor(),
      db = await database();
    await rateLimit(db, `avatar:${a.id}`, 10);
    if (!req.headers.get("content-type")?.includes("multipart/form-data"))
      fail("Se requiere una imagen", 415);
    const length = Number(req.headers.get("content-length"));
    if (!length || length > 2 * 1024 * 1024 + 65536)
      fail("La imagen debe pesar como máximo 2 MB", 413);
    const form = await req.formData(),
      file = form.get("image");
    if (!(file instanceof File)) fail("Selecciona una imagen");
    const bytes = await normalizeAvatar(Buffer.from(await file.arrayBuffer()));
    const path = `${a.id}/${randomUUID()}.png`;
    if (demoMode()) {
      const folder = join(process.cwd(), ".local", "avatars");
      await mkdir(folder, { recursive: true });
      await writeFile(join(folder, path.replace("/", "-")), bytes, {
        mode: 0o600,
      });
    } else {
      const { error } = await (
        await supabase()
      ).storage
        .from("avatars")
        .upload(path, bytes, { contentType: "image/png", upsert: false });
      if (error)
        fail("No se pudo guardar la imagen. Inténtalo nuevamente.", 503);
    }
    let previous: string | null = null;
    try {
      await db.transaction(async (tx) => {
        const p = await one(
          tx,
          "SELECT avatar_path FROM profiles WHERE id=$1 FOR UPDATE",
          [a.id],
        );
        previous = p.avatar_path;
        await tx.query(
          "UPDATE profiles SET avatar_path=$2,updated_at=now() WHERE id=$1",
          [a.id, path],
        );
        await audit(tx, a, "profile_photo_updated", "profile", a.id);
      });
    } catch (e) {
      await remove(path);
      throw e;
    }
    if (previous) await remove(previous);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request) {
  try {
    originCheck(req);
    const a = await requireActor(),
      db = await database();
    await rateLimit(db, `avatar:${a.id}`, 10);
    let previous: string | null = null;
    await db.transaction(async (tx) => {
      previous = (
        await one(
          tx,
          "SELECT avatar_path FROM profiles WHERE id=$1 FOR UPDATE",
          [a.id],
        )
      ).avatar_path;
      await tx.query(
        "UPDATE profiles SET avatar_path=NULL,updated_at=now() WHERE id=$1",
        [a.id],
      );
      await audit(tx, a, "profile_photo_removed", "profile", a.id);
    });
    if (previous) await remove(previous);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
