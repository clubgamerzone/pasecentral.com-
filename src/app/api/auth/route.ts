import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { supabase, demoLogin } from "@/lib/auth";
import { demoMode } from "@/lib/config";
import { originCheck, jsonBody, errorResponse } from "@/lib/http";
import { database } from "@/lib/db";
import { fail, rateLimit } from "@/lib/service";
const schema = z.object({
  action: z.enum(["login", "signup", "logout", "demo"]),
  id: z.string().uuid().optional(),
  email: z.email().optional(),
  password: z.string().min(10).max(128).optional(),
  name: z.string().min(1).max(150).optional(),
});
export async function POST(req: Request) {
  try {
    originCheck(req);
    const b = schema.parse(await jsonBody(req));
    if (b.action === "logout") {
      (await cookies()).delete("pc-demo");
      if (!demoMode()) await (await supabase()).auth.signOut();
      return NextResponse.json({ ok: true });
    }
    if (b.action === "demo") {
      await demoLogin(b.id ?? fail("Elige una cuenta"));
      return NextResponse.json({ ok: true });
    }
    if (demoMode()) fail("Usa una cuenta de demostración");
    await rateLimit(await database(), `auth:${b.email}`, 10);
    const s = await supabase();
    if (!b.email || !b.password) fail("Faltan credenciales");
    const res =
      b.action === "signup"
        ? await s.auth.signUp({
            email: b.email,
            password: b.password,
            options: { data: { name: b.name ?? "Comprador" } },
          })
        : await s.auth.signInWithPassword({
            email: b.email,
            password: b.password,
          });
    if (res.error)
      fail(
        "No se pudo iniciar sesión o registrar. Verifica tus datos y tu correo.",
        400,
      );
    return NextResponse.json({
      ok: true,
      message:
        b.action === "signup"
          ? "Revisa tu correo para confirmar tu cuenta."
          : "Sesión iniciada",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
