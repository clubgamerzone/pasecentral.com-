import { z } from "zod";
import { requireActor, supabase } from "@/lib/auth";
import { database } from "@/lib/db";
import { closeAccount } from "@/lib/transfers";
import { demoMode } from "@/lib/config";
import { fail, one, rateLimit } from "@/lib/service";
import { originCheck, jsonBody, errorResponse } from "@/lib/http";
import { cookies } from "next/headers";
export async function DELETE(req: Request) {
  try {
    originCheck(req);
    const a = await requireActor();
    const b = z
      .object({
        confirmation: z.literal("ELIMINAR"),
        password: z.string().max(128).optional(),
      })
      .parse(await jsonBody(req));
    const db = await database();
    await rateLimit(db, `delete:${a.id}`, 3);
    if (
      (await db.query("SELECT 1 FROM platform_admins WHERE user_id=$1", [a.id]))
        .rows.length &&
      (await one(db, "SELECT count(*)::int AS n FROM platform_admins")).n <= 1
    )
      fail(
        "No puedes eliminar el último administrador. Asigna primero otro administrador.",
      );
    if (
      (
        await db.query(
          "SELECT 1 FROM cash_sessions WHERE operator_id=$1 AND closed_at IS NULL",
          [a.id],
        )
      ).rows.length
    )
      fail("Cierra tus cajas antes de eliminar la cuenta");
    if (!demoMode()) {
      if (!b.password || !a.email) fail("Confirma con tu contraseña actual");
      const s = await supabase();
      const result = await s.auth.signInWithPassword({
        email: a.email,
        password: b.password,
      });
      if (result.error || result.data.user?.id !== a.id)
        fail("La contraseña actual no coincide", 401);
      const owned = (
        await db.query(
          "SELECT 1 FROM storage.objects WHERE owner_id=$1 AND bucket_id<>'avatars' LIMIT 1",
          [a.id],
        )
      ).rows;
      if (owned.length)
        fail(
          "Hay imágenes de eventos bajo tu propiedad. Otro administrador debe reemplazarlas antes de eliminar tu cuenta.",
        );
      const avatars = (
        await db.query(
          "SELECT name FROM storage.objects WHERE owner_id=$1 AND bucket_id='avatars'",
          [a.id],
        )
      ).rows.map((row) => row.name as string);
      if (avatars.some((path) => !path.startsWith(`${a.id}/`)))
        fail("Un archivo de tu cuenta requiere revisión del administrador");
      if (avatars.length) {
        const removed = await s.storage.from("avatars").remove(avatars);
        if (removed.error)
          fail("No se pudo retirar tu foto. Inténtalo nuevamente.");
      }
    }
    await closeAccount(db, a);
    if (demoMode()) (await cookies()).delete("pc-demo");
    else await (await supabase()).auth.signOut();
    return Response.json(
      {
        ok: true,
        message:
          "Cuenta eliminada. Tus entradas propias sin usar fueron anuladas. No se realiza un reembolso automático.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
