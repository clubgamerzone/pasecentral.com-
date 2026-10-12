import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { demoMode, required } from "./config";
// PostgreSQL returns heterogeneous result shapes; validate inputs at the service boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export interface Tx {
  query<T extends Row = Row>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  exec?: (sql: string) => Promise<unknown>;
}
export interface DB extends Tx {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}
declare global {
  var paseDb: Promise<DB> | undefined;
}
export async function migrate(db: DB) {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text primary key, applied_at timestamptz default now())",
  );
  for (const name of readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (
      (
        await db.query("SELECT name FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rows.length
    )
      continue;
    await db.transaction(async (tx) => {
      const sql = readFileSync(
        join(process.cwd(), "supabase/migrations", name),
        "utf8",
      );
      if (tx.exec) await tx.exec(sql);
      else await tx.query(sql);
      await tx.query(
        "INSERT INTO schema_migrations(name) VALUES($1) ON CONFLICT DO NOTHING",
        [name],
      );
    });
  }
}
export async function memoryDb(): Promise<DB> {
  const p = new PGlite();
  await p.waitReady;
  const db = p as unknown as DB;
  await migrate(db);
  return db;
}
export async function database(): Promise<DB> {
  if (!globalThis.paseDb)
    globalThis.paseDb = (async () => {
      if (demoMode()) {
        mkdirSync(".local", { recursive: true });
        const directory = process.env.PASE_DATA_DIR ?? "postgres";
        if (!/^[a-zA-Z0-9_-]+$/.test(directory))
          throw new Error("PASE_DATA_DIR debe ser un nombre dentro de .local");
        const p = new PGlite(
          join(/* turbopackIgnore: true */ process.cwd(), ".local", directory),
        );
        await p.waitReady;
        const db = p as unknown as DB;
        await migrate(db);
        const { seed } = await import("./seed");
        await seed(db);
        return db;
      }
      const pool = new Pool({
        connectionString: required("DATABASE_URL"),
        max: 10,
        connectionTimeoutMillis: 10000,
      });
      return {
        query: async (sql, params) => pool.query(sql, params),
        transaction: async (fn) => {
          const c = await pool.connect();
          try {
            await c.query("BEGIN");
            const result = await fn(c);
            await c.query("COMMIT");
            return result;
          } catch (e) {
            await c.query("ROLLBACK");
            throw e;
          } finally {
            c.release();
          }
        },
      } as DB;
    })();
  return globalThis.paseDb;
}
