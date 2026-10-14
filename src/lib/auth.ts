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
    if (!u) return null;
    const p = await one(
      await database(),
      "SELECT name,deleted_at FROM profiles WHERE id=$1",
      [u.id],
    );
    if (p.deleted_at) return null;
    return {
      id: u.id,
      name: p.name,
      email: `${u.role}@example.test`,
      email_verified: true,
    };
  }
  const s = await supabase();
  const {
    data: { user },
    error,
  } = await s.auth.getUser();
  if (error || !user) return null;
  const db = await database();
  await db.query(
    "INSERT INTO profiles(id,auth_user_id,name,email,gender,age_band,terms_accepted_at,terms_version) VALUES($1,$1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET email=excluded.email,auth_user_id=excluded.auth_user_id WHERE profiles.deleted_at IS NULL",
    [
      user.id,
      user.user_metadata?.name ?? "Comprador",
      user.email ?? null,
      ["female", "male", "other", "prefer_not_to_say"].includes(
        user.user_metadata?.gender,
      )
        ? user.user_metadata.gender
        : null,
      [
        "0_5",
        "6_12",
        "13_17",
        "18_24",
        "25_34",
        "35_44",
        "45_54",
        "55_64",
        "65_plus",
      ].includes(user.user_metadata?.age_band)
        ? user.user_metadata.age_band
        : null,
      user.user_metadata?.terms_version === "2026-10-14"
        ? user.created_at
        : null,
      user.user_metadata?.terms_version === "2026-10-14" ? "2026-10-14" : null,
    ],
  );
  const p = await one(db, "SELECT name,deleted_at FROM profiles WHERE id=$1", [
    user.id,
  ]);
  if (p.deleted_at) return null;
  return {
    id: user.id,
    name: p.name,
    email: user.email,
    email_verified: Boolean(user.email_confirmed_at),
  };
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
