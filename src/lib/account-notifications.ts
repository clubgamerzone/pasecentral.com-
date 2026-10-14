import type { DB } from "./db";
import { mkdirSync, writeFileSync } from "node:fs";
import { appUrl, demoMode, required } from "./config";
export async function deliverAccountNotifications(db: DB) {
  let sent = 0;
  for (let n = 0; n < 20; n++) {
    const job = await db.transaction(async (tx) => {
      const r = (
        await tx.query(
          "SELECT * FROM account_notifications WHERE (status IN ('pending','failed') AND attempts<6 AND next_attempt_at<=now()) OR (status='processing' AND locked_at<now()-interval '10 minutes') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (r)
        await tx.query(
          "UPDATE account_notifications SET status='processing',attempts=attempts+1,locked_at=now() WHERE id=$1",
          [r.id],
        );
      return r;
    });
    if (!job) break;
    try {
      const body = {
        from: process.env.EMAIL_FROM,
        to: [job.recipient_email],
        subject: job.subject,
        text: `${job.message}\n\nAbre ${appUrl()}/account/tickets\nSi necesitas crear una cuenta: ${appUrl()}/login\nPase Central`,
      };
      if (demoMode()) {
        mkdirSync(".local/outbox", { recursive: true });
        writeFileSync(
          `.local/outbox/notice-${job.id}.json`,
          JSON.stringify(body),
          { mode: 0o600 },
        );
      } else {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${required("EMAIL_API_KEY")}`,
            "Content-Type": "application/json",
            "Idempotency-Key": job.id,
          },
          body: JSON.stringify({ ...body, from: required("EMAIL_FROM") }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error("Email failed");
      }
      await db.query(
        "UPDATE account_notifications SET status='sent',locked_at=NULL,last_error=NULL WHERE id=$1",
        [job.id],
      );
      sent++;
    } catch {
      await db.query(
        "UPDATE account_notifications SET status='failed',locked_at=NULL,last_error='Entrega fallida: revisar proveedor',next_attempt_at=now()+($2::int*interval '1 minute') WHERE id=$1",
        [job.id, Math.min(60, 2 ** (job.attempts + 1))],
      );
    }
  }
  return sent;
}
