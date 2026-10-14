import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { DB, Tx, Row } from "./db";
import { admin, audit, fail, one, permit, type Actor } from "./service";
import type { Command } from "./validation";
import { token, hash, encrypt, decrypt } from "./crypto";
import { appUrl, demoMode, required } from "./config";
type InvitationCommand = Extract<
  Command,
  {
    action:
      "invite_create" | "invite_resend" | "invite_revoke" | "invite_accept";
  }
>;
const labels: Record<string, string> = {
  platform_admin: "Administrador global",
  organizer: "Organizador",
  box_office: "Cajero / taquilla",
  access_staff: "Acceso",
};
function emailPayload(
  name: string,
  role: string,
  events: Row[],
  credential: string,
  includeAccess = false,
) {
  const link = `${appUrl()}/invite#${credential}`;
  return {
    subject: "Invitación a Pase Central",
    text: `Hola ${name}.\nTe invitaron al equipo como ${labels[role]}${includeAccess ? " con control de acceso y lector QR" : ""}.\n${events.length ? `Eventos: ${events.map((e) => e.title).join(", ")}` : "Acceso administrativo a toda la plataforma."}\nAbre ${link}\nCrea o inicia sesión con el mismo correo al que llegó esta invitación y confirma tu correo. La invitación vence en siete días; no la compartas. No necesitas enviar tu contraseña al administrador.`,
  };
}
export async function invitationCommand(
  tx: Tx,
  a: Actor,
  c: InvitationCommand,
): Promise<Row> {
  if (c.action === "invite_accept") {
    await tx.query("LOCK TABLE platform_admins IN SHARE ROW EXCLUSIVE MODE");
    const i = await one(
      tx,
      "SELECT * FROM team_invitations WHERE token_hash=$1 FOR UPDATE",
      [hash(c.token)],
    );
    if (!Object.hasOwn(labels, i.role))
      fail(
        "Las invitaciones son solo para el equipo. Para comprar, regístrate o inicia sesión normalmente.",
        409,
      );
    if (!a.email_verified || !a.email || a.email.toLowerCase() !== i.email)
      fail("Inicia sesión con la cuenta verificada del correo invitado", 403);
    if (i.status === "accepted" && i.accepted_by === a.id)
      return { accepted: true };
    if (
      i.status !== "pending" ||
      new Date(i.expires_at).getTime() <= Date.now()
    )
      fail("La invitación no está vigente. Solicita una nueva.", 409);
    const events = (
      await tx.query(
        "SELECT id FROM events WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
        [i.event_ids],
      )
    ).rows;
    if (events.length !== i.event_ids.length)
      fail("Los eventos de la invitación ya no están disponibles", 409);
    if (
      !(
        await one(
          tx,
          "SELECT app_private.inviter_authorized($1,$2,$3) AS allowed",
          [i.created_by, i.event_ids, i.role],
        )
      ).allowed
    )
      fail("La invitación ya no está autorizada", 403);
    if (i.role === "platform_admin")
      await tx.query(
        "INSERT INTO platform_admins(user_id) VALUES($1) ON CONFLICT DO NOTHING",
        [a.id],
      );
    else
      for (const e of events)
        for (const role of i.include_access
          ? [i.role, "access_staff"]
          : [i.role])
          await tx.query(
            "INSERT INTO event_staff(event_id,user_id,role,active) VALUES($1,$2,$3,true) ON CONFLICT(event_id,user_id,role) DO UPDATE SET active=true",
            [e.id, a.id, role],
          );
    await tx.query(
      "UPDATE team_invitations SET status='accepted',accepted_by=$2,accepted_at=now() WHERE id=$1",
      [i.id, a.id],
    );
    await audit(tx, a, "invitation_accepted", "invitation", i.id, {
      role: i.role,
      event_ids: i.event_ids,
      include_access: i.include_access,
    });
    return { accepted: true };
  }
  const global = await admin(tx, a);
  if (c.action === "invite_create") {
    const ids = [...new Set(c.event_ids)];
    if (c.include_access && c.role !== "box_office")
      fail("Incluir acceso solo aplica a cajero / taquilla");
    if (c.role === "platform_admin" && !global)
      fail("Solo administrador global puede invitar administradores", 403);
    if (c.role === "platform_admin" ? ids.length > 0 : ids.length === 0)
      fail(
        "Selecciona eventos para el rol operativo; administrador global no lleva asignación de eventos",
      );
    const events = (
      await tx.query(
        "SELECT id,title FROM events WHERE id=ANY($1::uuid[]) ORDER BY id",
        [ids],
      )
    ).rows;
    if (events.length !== ids.length) fail("Uno de los eventos no existe");
    for (const event of events) await permit(tx, a, event.id, "manage");
    const email = c.email.toLowerCase();
    await tx.query(
      "UPDATE team_invitations SET status='expired' WHERE email=$1 AND status='pending' AND expires_at<=now()",
      [email],
    );
    if (
      (
        await tx.query(
          "SELECT 1 FROM team_invitations WHERE email=$1 AND status='pending'",
          [email],
        )
      ).rows.length
    )
      fail(
        "Ya existe una invitación pendiente para ese correo. Reenvíala o revócala.",
        409,
      );
    const credential = token(),
      id = randomUUID();
    await tx.query(
      "INSERT INTO team_invitations(id,email,name,role,event_ids,token_hash,token_encrypted,created_by,email_payload_encrypted,include_access) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        id,
        email,
        c.name,
        c.role,
        ids,
        hash(credential),
        encrypt(credential),
        a.id,
        encrypt(
          JSON.stringify(
            emailPayload(c.name, c.role, events, credential, c.include_access),
          ),
        ),
        c.include_access,
      ],
    );
    await audit(tx, a, "invitation_created", "invitation", id, {
      role: c.role,
      event_ids: ids,
      include_access: c.include_access,
    });
    return { invitation_id: id };
  }
  const i = await one(
    tx,
    "SELECT * FROM team_invitations WHERE id=$1 FOR UPDATE",
    [c.invitation_id],
  );
  if (!global) {
    if (i.role === "platform_admin" || !i.event_ids.length)
      fail("Solo administrador global", 403);
    for (const eventId of i.event_ids) await permit(tx, a, eventId, "manage");
  }
  if (i.status !== "pending") fail("La invitación ya no está pendiente", 409);
  if (c.action === "invite_revoke")
    await tx.query("UPDATE team_invitations SET status='revoked' WHERE id=$1", [
      i.id,
    ]);
  else {
    if (new Date(i.expires_at).getTime() <= Date.now())
      fail("La invitación venció. Crea una nueva.", 409);
    await tx.query(
      "UPDATE team_invitations SET email_status='pending',email_attempts=0,email_generation=email_generation+1,next_attempt_at=now(),locked_at=NULL,last_error=NULL WHERE id=$1",
      [i.id],
    );
  }
  await audit(tx, a, c.action, "invitation", i.id);
  return {};
}
export async function deliverInvitations(db: DB) {
  let processed = 0;
  for (let n = 0; n < 20; n++) {
    const i = await db.transaction(async (tx) => {
      const row = (
        await tx.query(
          "SELECT * FROM team_invitations WHERE status='pending' AND expires_at>now() AND app_private.inviter_authorized(created_by,event_ids,role) AND ((email_status IN ('pending','failed') AND next_attempt_at<=now() AND email_attempts<6) OR (email_status='processing' AND locked_at<now()-interval '10 minutes')) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (!row) return null;
      await tx.query(
        "UPDATE team_invitations SET email_status='processing',email_attempts=email_attempts+1,locked_at=now() WHERE id=$1",
        [row.id],
      );
      return row;
    });
    if (!i) break;
    const generation = i.email_generation;
    try {
      const payload = JSON.parse(decrypt(i.email_payload_encrypted));
      if (demoMode()) {
        mkdirSync(".local/outbox", { recursive: true });
        writeFileSync(
          `.local/outbox/invite-${i.id}-${generation}.json`,
          JSON.stringify({ to: i.email, ...payload }),
          { mode: 0o600 },
        );
      } else {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${required("EMAIL_API_KEY")}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `invite-${i.id}-${generation}`,
          },
          body: JSON.stringify({
            from: required("EMAIL_FROM"),
            to: [i.email],
            ...payload,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("No se pudo enviar la invitación");
      }
      await db.query(
        "UPDATE team_invitations SET email_status='sent',locked_at=NULL,last_error=NULL WHERE id=$1 AND email_generation=$2",
        [i.id, generation],
      );
      processed++;
    } catch {
      await db.query(
        "UPDATE team_invitations SET email_status='failed',locked_at=NULL,last_error='Revisar proveedor de correo',next_attempt_at=now()+($3::int*interval '1 minute') WHERE id=$1 AND email_generation=$2",
        [i.id, generation, Math.min(60, 2 ** (i.email_attempts + 1))],
      );
    }
  }
  return processed;
}
