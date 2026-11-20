import { it, expect } from "vitest";
import { memoryDb } from "../src/lib/db";
import { seed, USERS } from "../src/lib/seed";
import { state } from "../src/lib/state";
import { can } from "../src/lib/service";
it("permisos del estado por lotes coinciden con autorización del servidor para todos los roles", async () => {
  const db = await memoryDb();
  try {
    await seed(db);
    const events = (await db.query("SELECT id FROM events ORDER BY id")).rows;
    // Include revoked access and a cashier with scanner access on only one event.
    await db.query(
      "UPDATE event_staff SET active=false WHERE user_id=$1 AND event_id=$2",
      [USERS[3].id, events[1].id],
    );
    await db.query(
      "INSERT INTO event_staff(event_id,user_id,role) VALUES($1,$2,'access_staff') ON CONFLICT DO NOTHING",
      [events[0].id, USERS[2].id],
    );
    for (const actor of USERS) {
      const snapshot = await state(db, actor);
      for (const event of events)
        for (const [key, permission] of [
          ["manage", "manage"],
          ["sell", "sell"],
          ["access", "access"],
        ] as const)
          expect(snapshot.permissions[key].includes(event.id)).toBe(
            await can(db, actor, event.id, permission),
          );
    }
    const anonymous = await state(db, null);
    expect(anonymous.people).toEqual([]);
    expect(anonymous.orders).toEqual([]);
    expect(anonymous.permissions.sell).toEqual([]);
  } finally {
    await (db as typeof db & { close: () => Promise<void> }).close();
  }
});
