import type { DB, Tx, Row } from "./db";
import { audit, fail } from "./service";
export const resetTables = [
  "print_jobs",
  "check_in_attempts",
  "tickets",
  "refunds",
  "cash_movements",
  "delivery_jobs",
  "payments",
  "order_items",
  "orders",
  "cash_sessions",
  "pricing_phases",
  "ticket_types",
  "event_staff",
  "event_images",
  "events",
  "payment_webhook_events",
] as const;
export const preservedTables = [
  "profiles",
  "platform_admins",
  "organization_members",
  "organizations",
  "team_invitations",
] as const;
export async function resetSnapshot(tx: Tx, expectedIds: string[]) {
  const events = (await tx.query("SELECT * FROM events ORDER BY id")).rows;
  if (
    !events.length ||
    events.some((e) => !e.title.endsWith(" · DEMO")) ||
    events
      .map((e) => e.id)
      .sort()
      .join(",") !== [...expectedIds].sort().join(",")
  )
    fail(
      "La limpieza exige la lista exacta de todos los eventos DEMO; hay datos diferentes o nuevos.",
    );
  const invitations = (
    await tx.query(
      "SELECT id FROM team_invitations WHERE status='pending' AND event_ids && $1::uuid[]",
      [expectedIds],
    )
  ).rows;
  if (invitations.length)
    fail(
      "Hay invitaciones pendientes vinculadas a estos eventos; resuelve su asignación antes de limpiar.",
    );
  const data: Record<string, Row[]> = {};
  for (const table of [...resetTables, ...preservedTables, "audit_logs"])
    data[table] = (await tx.query(`SELECT * FROM ${table}`)).rows;
  return data;
}
export async function resetTestData(
  db: DB,
  expectedIds: string[],
  backup: (data: Record<string, Row[]>) => Promise<void>,
) {
  return db.transaction(async (tx) => {
    await tx.query("SET LOCAL lock_timeout='10s'");
    await tx.query(
      `LOCK TABLE ${[...resetTables, ...preservedTables, "audit_logs"].join(",")} IN ACCESS EXCLUSIVE MODE`,
    );
    const data = await resetSnapshot(tx, expectedIds);
    await backup(data); // A successful durable private backup is required before any deletion.
    const removed = Object.fromEntries(
      resetTables.map((t) => [t, data[t].length]),
    );
    for (const table of resetTables) await tx.query(`DELETE FROM ${table}`);
    await tx.query(
      "DELETE FROM audit_logs WHERE entity_type IN ('event','order','ticket','ticket_type','pricing_phase','cash_session','refund','print_job','checkin','payment')",
    );
    await tx.query(
      "UPDATE organizations SET name='Pase Central' WHERE name='Pase Central · pruebas'",
    );
    for (const table of preservedTables.filter((t) => t !== "organizations")) {
      const now = (await tx.query(`SELECT * FROM ${table}`)).rows;
      const serialize = (rows: Row[]) =>
        JSON.stringify(rows.map((r) => JSON.stringify(r)).sort());
      if (serialize(now) !== serialize(data[table]))
        fail(
          "Una cuenta, permiso o invitación cambió durante la limpieza; operación revertida.",
          409,
        );
    }
    await audit(tx, null, "test_data_reset", "system", crypto.randomUUID(), {
      removed,
      accounts_preserved: data.profiles.length,
      invitations_preserved: data.team_invitations.length,
    });
    return {
      removed,
      accountsPreserved: data.profiles.length,
      invitationsPreserved: data.team_invitations.length,
    };
  });
}
