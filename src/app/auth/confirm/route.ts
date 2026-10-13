import { NextResponse } from "next/server";
import { supabase } from "@/lib/auth";
import { appUrl, demoMode } from "@/lib/config";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const token = url.searchParams.get("token_hash");
  let valid = false;
  if (
    !demoMode() &&
    (code || (token && url.searchParams.get("type") === "recovery"))
  ) {
    try {
      const s = await supabase();
      const result = code
        ? await s.auth.exchangeCodeForSession(code)
        : await s.auth.verifyOtp({ token_hash: token!, type: "recovery" });
      valid = !result.error;
    } catch {
      // Never log recovery credentials or provider responses.
    }
  }
  const res = NextResponse.redirect(
    new URL(valid ? "/reset-password" : "/forgot-password?invalid=1", appUrl()),
  );
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
