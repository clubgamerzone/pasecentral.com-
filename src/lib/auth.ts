import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { demoMode, required } from "./config";
import { sign, equal } from "./crypto";
import { database } from "./db";
import { USERS } from "./seed";
import { type Actor, fail, one } from "./service";
export async function supabase() {
  const store = await cookies();
  return createServerClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values) => {
          for (const v of values) store.set(v.name, v.value, v.options);
        },
      },
    },
  );
}
export async function currentActor(): Promise<Actor | null> {
  if (demoMode()) {
    const value = (await cookies()).get("pc-demo")?.value;
    if (!value) return null;
    const [id, expires, mac] = value.split(".");
    if (
      Number(expires) < Date.now() ||
      !mac ||
      !equal(sign(`${id}.${expires}`), mac)
    )
      return null;
    const u = USERS.find((u) => u.id === id);
    return u
      ? { id: u.id, name: u.name, email: `${u.role}@example.test` }
      : null;
  }
  const s = await supabase();
  const {
    data: { user },
    error,
  } = await s.auth.getUser();
  if (error || !user) return null;
  const db = await database();
  await db.query(
    "INSERT INTO profiles(id,name,email) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET email=excluded.email",
    [user.id, user.user_metadata?.name ?? "Comprador", user.email ?? null],
  );
  const p = await one(db, "SELECT name FROM profiles WHERE id=$1", [user.id]);
  return { id: user.id, name: p.name, email: user.email };
}
export async function requireActor() {
  return (await currentActor()) ?? fail("Inicia sesión para continuar", 401);
}
export async function demoLogin(id: string) {
  if (!demoMode()) fail("Demo deshabilitada", 403);
  if (!USERS.some((u) => u.id === id)) fail("Cuenta no válida");
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const value = `${id}.${exp}`;
  (await cookies()).set("pc-demo", `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}
