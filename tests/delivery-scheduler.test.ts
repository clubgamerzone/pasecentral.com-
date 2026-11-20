import { beforeAll, afterAll, it, expect } from "vitest";
import { memoryDb, type DB } from "../src/lib/db";
import { pendingDeliverySql } from "../src/lib/delivery-scheduler";
let db: DB;
beforeAll(async () => {
  db = await memoryDb();
});
afterAll(async () => {
  await (db as DB & { close(): Promise<void> }).close();
});
const due = async () =>
  (await db.query(`SELECT (${pendingDeliverySql}) AS due`)).rows[0].due;
it("despierta al worker por un regalo pendiente aunque no haya boletas ni invitaciones por enviar", async () => {
  expect(await due()).toBe(false);
  const n = (
    await db.query(
      "INSERT INTO account_notifications(recipient_email,subject,message) VALUES('recipient@example.com','Regalo','Acepta en Mis entradas') RETURNING id",
    )
  ).rows[0];
  expect(await due()).toBe(true);
  await db.query("UPDATE account_notifications SET status='sent' WHERE id=$1", [
    n.id,
  ]);
  expect(await due()).toBe(false);
});
it("respeta backoff/intentos y recupera solo leases abandonados", async () => {
  await db.query("DELETE FROM account_notifications");
  const n = (
    await db.query(
      "INSERT INTO account_notifications(recipient_email,subject,message,status,next_attempt_at) VALUES('recipient@example.com','Aviso','Prueba','failed',now()+interval '1 hour') RETURNING id",
    )
  ).rows[0];
  expect(await due()).toBe(false);
  await db.query(
    "UPDATE account_notifications SET next_attempt_at=now()-interval '1 minute' WHERE id=$1",
    [n.id],
  );
  expect(await due()).toBe(true);
  await db.query("UPDATE account_notifications SET attempts=6 WHERE id=$1", [
    n.id,
  ]);
  expect(await due()).toBe(false);
  await db.query(
    "UPDATE account_notifications SET status='processing',locked_at=now() WHERE id=$1",
    [n.id],
  );
  expect(await due()).toBe(false);
  await db.query(
    "UPDATE account_notifications SET locked_at=now()-interval '11 minutes' WHERE id=$1",
    [n.id],
  );
  expect(await due()).toBe(true);
});
