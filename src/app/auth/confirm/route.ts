import { NextResponse } from "next/server";
import { supabase } from "@/lib/auth";
import { appUrl, demoMode } from "@/lib/config";
import type { EmailOtpType } from "@supabase/supabase-js";
import { database } from "@/lib/db";
import { pendingInvitation } from "@/lib/invitations";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const token = url.searchParams.get("token_hash");
  const requestedType =
    url.searchParams.get("type") ?? (code ? "recovery" : "");
  const allowedType = [
    "recovery",
    "signup",
    "invite",
    "email_change",
    "email",
    "magiclink",
  ].includes(requestedType);
  const type = (allowedType ? requestedType : "signup") as EmailOtpType;
  let valid = false;
  let resumeInvitation = false;
  if (!demoMode() && allowedType && (code || token)) {
    try {
      const s = await supabase();
      const result = code
        ? await s.auth.exchangeCodeForSession(code)
        : await s.auth.verifyOtp({ token_hash: token!, type });
      valid = !result.error;
      if (valid && type !== "recovery" && result.data?.user?.email) {
        try {
          resumeInvitation = !!(await pendingInvitation(await database(), {
            id: result.data.user.id,
            name: "",
            email: result.data.user.email,
            email_verified: true,
          }));
        } catch {
          /* Profile still offers resumption if the database is temporarily unavailable. */
        }
      }
    } catch {
      // Never log recovery credentials or provider responses.
    }
  }
  const res = NextResponse.redirect(
    new URL(
      valid
        ? type === "recovery"
          ? "/reset-password"
          : resumeInvitation
            ? "/invite?confirmed=1"
            : "/account/profile?confirmed=1"
        : type === "recovery"
          ? "/forgot-password?invalid=1"
          : "/login?confirmation=invalid",
      appUrl(),
    ),
  );
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
