import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { database } from "../src/lib/db";
import { demoMode, required } from "../src/lib/config";
import { encrypt, decrypt, hash } from "../src/lib/crypto";
import { resetSnapshot, resetTestData } from "../src/lib/test-reset";
if (
  demoMode() ||
  process.env.APP_ENVIRONMENT !== "staging" ||
  process.env.WOMPI_ENV !== "sandbox"
)
  throw new Error(
    "Solo staging conectado con Wompi sandbox; prohibido en producción comercial.",
  );
const ids = (
  process.argv.find((a) => a.startsWith("--event-ids="))?.slice(12) ?? ""
).split(",");
if (
  !ids.length ||
  ids.some((id) => !/^[a-f0-9-]{36}$/.test(id)) ||
  new Set(ids).size !== ids.length
)
  throw new Error("Indica --event-ids=UUID,UUID con la lista exacta revisada.");
const apply = process.argv.includes("--apply"),
  prepare = process.argv.includes("--prepare");
if (apply === prepare) throw new Error("Selecciona --prepare o --apply.");
const db = await database();
const authBefore = (await db.query("SELECT id FROM auth.users ORDER BY id"))
  .rows;
const url = new URL(required("DATABASE_URL"));
const folder = join(
  process.cwd(),
  ".local",
  "backups",
  `test-reset-${new Date().toISOString().replaceAll(":", "-")}-${apply ? "apply" : "prepare"}`,
);
await mkdir(folder, { recursive: true });
async function backup(data: Awaited<ReturnType<typeof resetSnapshot>>) {
  const plain = JSON.stringify({
    version: 1,
    createdAt: new Date().toISOString(),
    databaseIdentity: hash(`${url.hostname}|${url.username}|${url.pathname}`),
    eventIds: ids,
    authIds: authBefore,
    data,
  });
  const encrypted = encrypt(plain),
    path = join(folder, "database.enc");
  await writeFile(path, encrypted, { flag: "wx", mode: 0o600 });
  if (decrypt(await readFile(path, "utf8")) !== plain)
    throw new Error("La copia cifrada no pudo verificarse.");
  console.log({
    backup: path,
    rows: Object.fromEntries(
      Object.entries(data).map(([t, rows]) => [t, rows.length]),
    ),
  });
}
if (prepare)
  await db.transaction(async (tx) => {
    await tx.query("SET LOCAL lock_timeout='10s'");
    const { resetTables, preservedTables } =
      await import("../src/lib/test-reset");
    await tx.query(
      `LOCK TABLE ${[...resetTables, ...preservedTables, "audit_logs"].join(",")} IN SHARE MODE`,
    );
    await backup(await resetSnapshot(tx, ids));
  });
else {
  const images = await db.query(
    "SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id='event-images'",
  );
  if (images.rows[0].count !== 0)
    throw new Error(
      "Respalda y retira primero los archivos de ensayo de event-images mediante Storage autorizado. No borrar metadata Storage por SQL.",
    );
  console.log(await resetTestData(db, ids, backup));
  const authAfter = (await db.query("SELECT id FROM auth.users ORDER BY id"))
    .rows;
  if (authBefore.some((u) => !authAfter.some((v) => u.id === v.id)))
    throw new Error("Falta una cuenta Auth; revisar inmediatamente.");
  console.log({ authAccountsPreserved: authBefore.length });
}
process.exit(0);
