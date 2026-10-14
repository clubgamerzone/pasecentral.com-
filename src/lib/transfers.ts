import type { DB, Tx, Row } from "./db";
import { one, fail, audit, type Actor } from "./service";
import { token, hash, encrypt } from "./crypto";
import { ageRangeCanMeetMinimum } from "./account-rules";
export async function notifyAccount(
  tx: Tx,
  email: string,
  subject: string,
  message: string,
) {
  await tx.query(
    "INSERT INTO account_notifications(recipient_email,subject,message) VALUES($1,$2,$3)",
    [email, subject, message],
  );
}
async function rotate(tx: Tx, t: Row, owner: string | null = t.owner_user_id) {
  const credential = token();
  await tx.query(
    "UPDATE tickets SET owner_user_id=$2,credential_hash=$3,credential_encrypted=$4,credential_version=credential_version+1 WHERE id=$1",
    [t.id, owner, hash(credential), encrypt(credential)],
  );
}
async function revokeOrderLinks(tx: Tx, tickets: Row[]) {
  for (const id of new Set(tickets.map((t) => t.order_id))) {
    const share = token();
    await tx.query(
      "UPDATE orders SET share_hash=$2,share_encrypted=$3 WHERE id=$1",
      [id, hash(share), encrypt(share)],
    );
    await tx.query(
      "UPDATE delivery_jobs SET email_payload_encrypted=NULL WHERE order_id=$1 AND status IN ('pending','failed')",
      [id],
    );
  }
}
export async function transferTickets(
  tx: Tx,
  a: Actor,
  ids: string[],
  email: string,
  kind = "transfer",
) {
  if (!a.email_verified || !a.email)
    fail("Confirma tu correo antes de regalar o transferir entradas", 403);
  email = email.trim().toLowerCase();
  if (email === a.email.toLowerCase())
    fail("El destinatario debe ser otra persona");
  const recipient = (
    await tx.query(
      "SELECT id FROM profiles WHERE lower(email)=$1 AND deleted_at IS NULL FOR KEY SHARE",
      [email],
    )
  ).rows[0];
  if (kind === "transfer" && !recipient)
    fail("El destinatario debe tener una cuenta existente en Pase Central");
  await tx.query(
    "SELECT id FROM events WHERE id IN (SELECT event_id FROM tickets WHERE id=ANY($1::uuid[])) ORDER BY id FOR UPDATE",
    [ids],
  );
  const tickets = (
    await tx.query(
      "SELECT t.*,i.order_id,e.ends_at,a.gender,a.age_band,a.demographics_consent FROM tickets t JOIN order_items i ON i.id=t.order_item_id JOIN events e ON e.id=t.event_id LEFT JOIN order_attendees a ON a.id=t.attendee_id WHERE t.id=ANY($1::uuid[]) ORDER BY t.id FOR UPDATE OF t",
      [ids],
    )
  ).rows;
  if (tickets.length !== new Set(ids).size || !tickets.length)
    fail("Selección inválida");
  for (const t of tickets) {
    if (
      t.owner_user_id !== a.id ||
      t.status !== "valid" ||
      t.used_at ||
      new Date(t.ends_at) <= new Date()
    )
      fail(
        "Solo puedes transferir tus entradas vigentes, sin usar y de eventos pendientes",
        403,
      );
    if (
      (
        await tx.query(
          "SELECT 1 FROM ticket_transfer_items i JOIN ticket_transfers r ON r.id=i.transfer_id WHERE i.ticket_id=$1 AND r.status='pending'",
          [t.id],
        )
      ).rows.length
    )
      fail("Una entrada ya tiene una entrega pendiente");
  }
  const r = await one(
    tx,
    "INSERT INTO ticket_transfers(from_user_id,to_user_id,recipient_email,kind) VALUES($1,$2,$3,$4) RETURNING id",
    [a.id, recipient?.id ?? null, email, kind],
  );
  for (const t of tickets) {
    await rotate(tx, t);
    await tx.query(
      "INSERT INTO ticket_transfer_items(transfer_id,ticket_id,previous_gender,previous_age_band,previous_consent) VALUES($1,$2,$3,$4,$5)",
      [r.id, t.id, t.gender, t.age_band, t.demographics_consent ?? false],
    );
  }
  await revokeOrderLinks(tx, tickets);
  await notifyAccount(
    tx,
    email,
    kind === "gift"
      ? "Recibiste un regalo en Pase Central"
      : "Recibiste una transferencia de entradas",
    `Tienes ${tickets.length} entrada(s) pendientes de aceptación. Inicia sesión con este correo y abre Mis entradas. Si no tienes cuenta, créala y confirma tu correo. Dispones de 7 días para aceptar; después vuelven al remitente. Mientras esperan aceptación no autorizan ingreso.`,
  );
  await audit(
    tx,
    a,
    kind === "gift" ? "gift_created" : "transfer_created",
    "ticket_transfer",
    r.id,
    { quantity: tickets.length },
  );
  return r;
}
export async function resolveTransfer(
  tx: Tx,
  a: Actor,
  id: string,
  accept: boolean,
  cancel = false,
  ageConfirmed = false,
) {
  // Lock tickets before transfer to match check-in/expiry and prevent mixed ownership.
  await tx.query(
    "SELECT id FROM events WHERE id IN (SELECT t.event_id FROM tickets t JOIN ticket_transfer_items i ON i.ticket_id=t.id WHERE i.transfer_id=$1) ORDER BY id FOR UPDATE",
    [id],
  );
  const tickets = (
    await tx.query(
      "SELECT t.*,i.order_id,e.minimum_age,e.ends_at,ti.previous_gender,ti.previous_age_band,ti.previous_consent FROM tickets t JOIN order_items i ON i.id=t.order_item_id JOIN events e ON e.id=t.event_id JOIN ticket_transfer_items ti ON ti.ticket_id=t.id WHERE ti.transfer_id=$1 ORDER BY t.id FOR UPDATE OF t",
      [id],
    )
  ).rows;
  const r = await one(
    tx,
    "SELECT * FROM ticket_transfers WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (
    cancel
      ? r.from_user_id !== a.id
      : !a.email_verified ||
        r.recipient_email.toLowerCase() !== a.email?.toLowerCase()
  )
    fail("Esta entrega no corresponde a tu cuenta", 403);
  if (r.status !== "pending") fail("La entrega ya fue resuelta", 409);
  if (!cancel && r.to_user_id && r.to_user_id !== a.id)
    fail("La entrega fue dirigida a otra identidad de cuenta", 403);
  if (accept && tickets.some((t) => new Date(t.ends_at) <= new Date()))
    fail("El evento de alguna entrada ya terminó");
  if (accept && tickets.some((t) => t.minimum_age > 0) && !ageConfirmed)
    fail("Confirma que cumples la edad mínima de los eventos");
  const expired = new Date(r.expires_at) <= new Date();
  if (
    accept &&
    (expired ||
      tickets.some(
        (t) => t.status !== "valid" || t.owner_user_id !== r.from_user_id,
      ))
  )
    fail("El regalo venció o contiene entradas que ya no están vigentes", 409);
  const status = expired
    ? "expired"
    : cancel
      ? "cancelled"
      : accept
        ? "accepted"
        : "declined";
  await tx.query(
    "UPDATE ticket_transfers SET status=$2,to_user_id=CASE WHEN $3 THEN $4 ELSE to_user_id END,resolved_at=now() WHERE id=$1",
    [id, status, accept, a.id],
  );
  const p = await one(tx, "SELECT gender,age_band FROM profiles WHERE id=$1", [
    accept ? a.id : r.from_user_id,
  ]);
  if (accept && !p.gender)
    fail("Completa Género en Mi perfil; puedes elegir Prefiero no responder.");
  if (
    accept &&
    tickets.some((t) => !ageRangeCanMeetMinimum(p.age_band, t.minimum_age))
  )
    fail("La edad declarada no cumple la edad mínima del evento");
  for (const [index, t] of tickets.entries()) {
    await rotate(tx, t, accept ? a.id : r.from_user_id);
    if (t.attendee_id)
      await tx.query(
        "UPDATE order_attendees SET gender=$2,age_band=$3,demographics_consent=$4 WHERE id=$1",
        [
          t.attendee_id,
          !accept && r.kind === "transfer"
            ? t.previous_gender
            : index === 0
              ? p.gender
              : null,
          !accept && r.kind === "transfer"
            ? t.previous_age_band
            : index === 0
              ? p.age_band
              : null,
          !accept && r.kind === "transfer" ? t.previous_consent : true,
        ],
      );
  }
  await revokeOrderLinks(tx, tickets);
  if (accept) {
    for (const orderId of new Set(tickets.map((t) => t.order_id)))
      await tx.query(
        "INSERT INTO delivery_jobs(order_id,recipient_user_id,recipient_email) VALUES($1,$2,$3)",
        [orderId, a.id, a.email],
      );
  }
  const from = await one(tx, "SELECT email FROM profiles WHERE id=$1", [
    r.from_user_id,
  ]);
  if (from.email)
    await notifyAccount(
      tx,
      from.email,
      accept
        ? "Entrega de entradas aceptada"
        : "Entradas devueltas a tu cuenta",
      accept
        ? "El destinatario aceptó las entradas. Su QR anterior ya no permite ingresar."
        : "La entrega fue rechazada, cancelada o venció. Las entradas vigentes vuelven a estar disponibles en Mis entradas con un QR actualizado.",
    );
  await audit(tx, a, `transfer_${status}`, "ticket_transfer", id, {
    quantity: tickets.length,
  });
  return { status };
}
export async function expireTransfers(db: DB) {
  const due = (
    await db.query(
      "SELECT id,from_user_id FROM ticket_transfers WHERE status='pending' AND expires_at<=now() ORDER BY expires_at LIMIT 100",
    )
  ).rows;
  for (const r of due)
    await db.transaction(async (tx) => {
      const p = await one(
        tx,
        "SELECT id,name,email FROM profiles WHERE id=$1",
        [r.from_user_id],
      );
      try {
        await resolveTransfer(
          tx,
          { ...p, email_verified: true } as Actor,
          r.id,
          false,
          true,
        );
      } catch (e) {
        if ((e as { status?: number }).status !== 409) throw e;
      }
    });
  return due.length;
}
export async function closeAccount(db: DB, a: Actor) {
  return db.transaction(async (tx) => {
    // Serialize deletions with membership/admin changes and ownership operations.
    const p = await one(tx, "SELECT * FROM profiles WHERE id=$1 FOR UPDATE", [
      a.id,
    ]);
    await tx.query("LOCK TABLE platform_admins IN SHARE ROW EXCLUSIVE MODE");
    if (p.deleted_at) return {};
    if (
      (await tx.query("SELECT 1 FROM platform_admins WHERE user_id=$1", [a.id]))
        .rows.length &&
      (await one(tx, "SELECT count(*)::int AS n FROM platform_admins")).n <= 1
    )
      fail(
        "No puedes eliminar el último administrador. Asigna primero otro administrador.",
      );
    if (
      (
        await tx.query(
          "SELECT 1 FROM cash_sessions WHERE operator_id=$1 AND closed_at IS NULL",
          [a.id],
        )
      ).rows.length
    )
      fail("Cierra tus cajas antes de eliminar la cuenta");
    await tx.query(
      "SELECT id FROM events WHERE id IN (SELECT t.event_id FROM tickets t WHERE t.owner_user_id=$1 OR t.id IN (SELECT i.ticket_id FROM ticket_transfer_items i JOIN ticket_transfers r ON r.id=i.transfer_id WHERE r.status='pending' AND (r.from_user_id=$1 OR lower(r.recipient_email)=lower($2)))) ORDER BY id FOR UPDATE",
      [a.id, a.email ?? ""],
    );
    const owned = (
      await tx.query(
        "SELECT t.*,i.order_id FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE owner_user_id=$1 ORDER BY t.id FOR UPDATE OF t",
        [a.id],
      )
    ).rows;
    const pending = (
      await tx.query(
        "SELECT DISTINCT r.id FROM ticket_transfers r LEFT JOIN ticket_transfer_items i ON i.transfer_id=r.id LEFT JOIN tickets t ON t.id=i.ticket_id WHERE r.status='pending' AND (r.from_user_id=$1 OR lower(r.recipient_email)=lower($2))",
        [a.id, a.email],
      )
    ).rows;
    for (const r of pending) {
      const transfer = await one(
        tx,
        "SELECT * FROM ticket_transfers WHERE id=$1",
        [r.id],
      );
      await resolveTransfer(tx, a, r.id, false, transfer.from_user_id === a.id);
    }
    for (const t of owned) await rotate(tx, t, null);
    await tx.query(
      "UPDATE tickets SET status=CASE WHEN status='valid' THEN 'cancelled' ELSE status END,owner_user_id=NULL WHERE owner_user_id=$1 OR id=ANY($2::uuid[])",
      [a.id, owned.map((t) => t.id)],
    );
    await revokeOrderLinks(tx, owned);
    await tx.query("DELETE FROM platform_admins WHERE user_id=$1", [a.id]);
    await tx.query("DELETE FROM organization_members WHERE user_id=$1", [a.id]);
    await tx.query("DELETE FROM event_staff WHERE user_id=$1", [a.id]);
    await tx.query(
      "DELETE FROM account_notifications WHERE lower(recipient_email)=lower($1) AND status IN ('pending','failed')",
      [a.email ?? ""],
    );
    await tx.query(
      "UPDATE delivery_jobs SET status='failed',attempts=6,last_error='Cuenta destinataria eliminada' WHERE recipient_user_id=$1 OR (recipient_user_id IS NULL AND order_id IN (SELECT id FROM orders WHERE buyer_user_id=$1))",
      [a.id],
    );
    await tx.query(
      "UPDATE orders SET buyer_user_id=NULL WHERE buyer_user_id=$1",
      [a.id],
    );
    await tx.query(
      "UPDATE profiles SET deleted_at=now(),name='Cuenta eliminada',email=NULL,phone=NULL,bio='',gender=NULL,age_band=NULL,avatar_path=NULL,updated_at=now() WHERE id=$1",
      [a.id],
    );
    if (
      !(
        (await tx.query("SELECT to_regclass('auth.users') AS table_name"))
          .rows[0].table_name == null
      )
    )
      await tx.query("DELETE FROM auth.users WHERE id=$1", [a.id]);
    await audit(tx, a, "account_deleted", "profile", a.id, {
      cancelled_unused: owned.filter((t) => t.status === "valid").length,
    });
    return {};
  });
}
