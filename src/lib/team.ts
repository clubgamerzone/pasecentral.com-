import type { Tx } from "./db";
import { admin, audit, fail, one, permit, type Actor } from "./service";
import type { Command } from "./validation";
export async function updateTeam(
  tx: Tx,
  actor: Actor,
  c: Extract<Command, { action: "team_update" }>,
) {
  const person = await one(
    tx,
    "SELECT id,name FROM profiles WHERE id=$1 AND deleted_at IS NULL FOR KEY SHARE",
    [c.user_id],
  );
  if (c.platform_admin !== undefined)
    await tx.query("LOCK TABLE platform_admins IN SHARE ROW EXCLUSIVE MODE");
  const global = await admin(tx, actor);
  if (!global && !c.assignments.length)
    fail("Selecciona un evento que administras", 403);
  if (!global && (c.platform_admin !== undefined || c.name !== undefined))
    fail(
      "Solo administrador global puede editar nombre o permisos globales",
      403,
    );
  if (
    new Set(c.assignments.map((e) => e.event_id)).size !== c.assignments.length
  )
    fail("No repitas el evento");
  if (!global && (await admin(tx, { id: c.user_id, name: "" })))
    fail(
      "Un administrador de evento no puede editar un administrador global",
      403,
    );
  const assignments = [...c.assignments].sort((a, b) =>
    a.event_id.localeCompare(b.event_id),
  );
  for (const entry of assignments) {
    await one(tx, "SELECT id FROM events WHERE id=$1 FOR UPDATE", [
      entry.event_id,
    ]);
    await permit(tx, actor, entry.event_id, "manage");
  }
  if (
    c.platform_admin === false &&
    (await admin(tx, { id: c.user_id, name: "" }))
  ) {
    if (
      (await one(tx, "SELECT count(*)::int AS count FROM platform_admins"))
        .count <= 1
    )
      fail("No puedes retirar al último administrador global", 409);
    await tx.query("DELETE FROM platform_admins WHERE user_id=$1", [c.user_id]);
  } else if (c.platform_admin === true) {
    await tx.query(
      "INSERT INTO platform_admins(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [c.user_id],
    );
  }
  if (c.name !== undefined)
    await tx.query("UPDATE profiles SET name=$2,updated_at=now() WHERE id=$1", [
      c.user_id,
      c.name,
    ]);
  for (const entry of assignments) {
    const roles = [...new Set(entry.roles)];
    await tx.query(
      "UPDATE event_staff SET active=false WHERE event_id=$1 AND user_id=$2",
      [entry.event_id, c.user_id],
    );
    for (const role of roles)
      await tx.query(
        "INSERT INTO event_staff(event_id,user_id,role,active) VALUES($1,$2,$3,true) ON CONFLICT(event_id,user_id,role) DO UPDATE SET active=true",
        [entry.event_id, c.user_id, role],
      );
  }
  await audit(tx, actor, "team_permissions_updated", "profile", c.user_id, {
    assignments: c.assignments,
    ...(c.platform_admin !== undefined
      ? { platform_admin: c.platform_admin }
      : {}),
    name_changed: c.name !== undefined && c.name !== person.name,
  });
  return {};
}
