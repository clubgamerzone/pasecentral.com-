import { mkdirSync, writeFileSync } from "node:fs";
import type { DB } from "./db";
import { decrypt, encrypt } from "./crypto";
import { appUrl, demoMode, required } from "./config";
import { one, ticketDocument } from "./service";
import { ticketEmail, type TicketEmail } from "./ticket-email";
export interface EmailAdapter {
  send(
    message: TicketEmail & { to: string; link: string; jobId: string },
  ): Promise<void>;
}
export async function deliver(db: DB, adapter?: EmailAdapter) {
  let processed = 0;
  for (let n = 0; n < 20; n++) {
    const job = await db.transaction(async (tx) => {
      const j = (
        await tx.query(
          `SELECT * FROM delivery_jobs WHERE ((status IN ('pending','failed') AND next_attempt_at<=now() AND attempts<6) OR (status='processing' AND locked_at<now()-interval '10 minutes')) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`,
        )
      ).rows[0];
      if (!j) return null;
      await tx.query(
        "UPDATE delivery_jobs SET status='processing',locked_at=now(),attempts=attempts+1 WHERE id=$1",
        [j.id],
      );
      return j;
    });
    if (!job) break;
    try {
      const o = await one(
        db,
        "SELECT buyer_email,share_encrypted FROM orders WHERE id=$1",
        [job.order_id],
      );
      const link = `${appUrl()}/tickets/${job.order_id}#${decrypt(o.share_encrypted)}`;
      const message: TicketEmail = job.email_payload_encrypted
        ? JSON.parse(decrypt(job.email_payload_encrypted))
        : await ticketEmail(
            await ticketDocument(
              db,
              null,
              job.order_id,
              decrypt(o.share_encrypted),
            ),
            link,
          );
      if (!job.email_payload_encrypted)
        await db.query(
          "UPDATE delivery_jobs SET email_payload_encrypted=$2 WHERE id=$1",
          [job.id, encrypt(JSON.stringify(message))],
        );
      if (adapter) {
        await adapter.send({
          ...message,
          to: o.buyer_email,
          link,
          jobId: job.id,
        });
      } else if (demoMode()) {
        mkdirSync(".local/outbox", { recursive: true });
        writeFileSync(
          `.local/outbox/${job.id}.json`,
          JSON.stringify(
            {
              to: o.buyer_email,
              link,
              ...message,
              subject: `${message.subject} (DEMO)`,
            },
            null,
            2,
          ),
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
          body: JSON.stringify({
            from: required("EMAIL_FROM"),
            to: [o.buyer_email],
            ...message,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error("Email provider failed");
      }
      await db.query(
        "UPDATE delivery_jobs SET status='sent',last_error=NULL,locked_at=NULL WHERE id=$1",
        [job.id],
      );
      processed++;
    } catch {
      await db.query(
        "UPDATE delivery_jobs SET status='failed',last_error='Entrega fallida: revisar proveedor/configuración',locked_at=NULL,next_attempt_at=now()+($2::int*interval '1 minute') WHERE id=$1",
        [job.id, Math.min(60, 2 ** (job.attempts + 1))],
      );
    }
  }
  return { processed };
}
