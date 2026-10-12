import { database } from "../src/lib/db";
import { demoMode } from "../src/lib/config";
const id = process.argv[2],
  name = process.argv[3];
if (demoMode())
  throw new Error(
    "Bootstrap es para Supabase real; la demo ya tiene usuarios.",
  );
if (!id || !name || !/^[a-f0-9-]{36}$/i.test(id))
  throw new Error(
    'Uso: npm run bootstrap -- UUID_AUTH "Nombre de organización"',
  );
await (
  await database()
).transaction(async (tx) => {
  await tx.query(
    "INSERT INTO profiles(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [id, "Administrador inicial"],
  );
  if ((await tx.query("SELECT 1 FROM platform_admins")).rows.length)
    throw new Error("Ya hay un administrador. No se modifica.");
  await tx.query("INSERT INTO platform_admins VALUES($1)", [id]);
  await tx.query("INSERT INTO organizations(name) VALUES($1)", [name]);
  await tx.query(
    "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'admin_bootstrap','profile',$1)",
    [id],
  );
});
console.log("Administrador y organización inicial creados.");
process.exit(0);
