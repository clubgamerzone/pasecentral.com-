import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { supabase, demoLogin } from "@/lib/auth";
import { appUrl, demoMode } from "@/lib/config";
import { originCheck, jsonBody, errorResponse } from "@/lib/http";
import { database } from "@/lib/db";
import { fail, rateLimit } from "@/lib/service";
import {
  registration,
  TERMS_VERSION,
  gender,
  ageBand,
} from "@/lib/account-rules";
const schema = z.object({
  action: z.enum([
    "login",
    "signup",
    "logout",
    "demo",
    "forgot",
    "reset",
    "recovery",
  ]),
  id: z.string().uuid().optional(),
  email: z.email().optional(),
  password: z.string().min(10).max(128).optional(),
  name: z.string().min(1).max(150).optional(),
  gender: gender.optional(),
  age_band: ageBand.nullable().optional(),
  terms_accepted: z.boolean().optional(),
  access_token: z.string().min(20).max(8192).optional(),
  refresh_token: z.string().min(10).max(2048).optional(),
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
    if (b.action === "recovery") {
      if (!b.access_token || !b.refresh_token)
        fail("El enlace no es válido.", 401);
      const s = await supabase();
      const result = await s.auth.setSession({
        access_token: b.access_token,
        refresh_token: b.refresh_token,
      });
      if (result.error)
        fail("El enlace no es válido o venció. Solicita uno nuevo.", 401);
      const {
        data: { user },
        error,
      } = await s.auth.getUser();
      if (error || !user) {
        await s.auth.signOut();
        fail("El enlace no es válido o venció. Solicita uno nuevo.", 401);
      }
      await rateLimit(await database(), `recovery:${user.id}`, 10);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "reset") {
      const s = await supabase();
      const {
        data: { user },
        error,
      } = await s.auth.getUser();
      if (error || !user)
        fail("Abre un enlace de recuperación válido desde tu correo.", 401);
      if (!b.password) fail("Falta la nueva contraseña");
      await rateLimit(await database(), `password:${user.id}`, 5);
      const result = await s.auth.updateUser({ password: b.password });
      if (result.error)
        fail(
          "No se pudo guardar la contraseña. Usa una contraseña nueva de al menos 10 caracteres.",
        );
      await s.auth.signOut();
      return NextResponse.json({
        ok: true,
        message:
          "Contraseña actualizada. Inicia sesión con tu nueva contraseña.",
      });
    }
    if (!b.email) fail("Falta el correo");
    await rateLimit(await database(), `auth:${b.email}`, 10);
    const s = await supabase();
    if (b.action === "forgot") {
      const { error } = await s.auth.resetPasswordForEmail(b.email, {
        redirectTo: `${appUrl()}/auth/confirm?type=recovery`,
      });
      if (error)
        fail(
          "No se pudo solicitar el correo. Inténtalo más tarde o contacta al administrador.",
          503,
        );
      return NextResponse.json({
        ok: true,
        message:
          "Si existe una cuenta con ese correo, recibirás un enlace de recuperación. Revisa también spam. Abre el enlace más reciente.",
      });
    }
    if (!b.email || !b.password) fail("Faltan credenciales");
    const profile = b.action === "signup" ? registration.parse(b) : null;
    const res =
      b.action === "signup"
        ? await s.auth.signUp({
            email: b.email,
            password: b.password,
            options: {
              emailRedirectTo: `${appUrl()}/auth/confirm?type=signup`,
              data: {
                name: profile!.name,
                gender: profile!.gender,
                age_band: profile!.age_band,
                terms_version: TERMS_VERSION,
              },
            },
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
