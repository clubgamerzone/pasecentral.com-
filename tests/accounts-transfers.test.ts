import { beforeAll, beforeEach, afterAll, it, expect, describe } from "vitest";
import { randomUUID } from "node:crypto";
import { memoryDb, type DB } from "../src/lib/db";
import { seed, USERS } from "../src/lib/seed";
import { execute, one, settle, ticketDocument } from "../src/lib/service";
import { closeAccount, expireTransfers } from "../src/lib/transfers";
import { state } from "../src/lib/state";
import { registration, ageRangeCanMeetMinimum } from "../src/lib/account-rules";
import { decrypt } from "../src/lib/crypto";
let db: DB;
const e = "00000000-0000-4000-8000-000000000002",
  buyer = USERS[4],
  recipient = USERS[3];
beforeAll(async () => {
  db = await memoryDb();
});
beforeEach(async () => {
  await db.query("TRUNCATE organizations,profiles CASCADE");
  await seed(db);
  await db.query(
    "UPDATE profiles SET gender='female',age_band='25_34' WHERE id=$1",
    [buyer.id],
  );
  await db.query(
    "UPDATE profiles SET gender='male',age_band='35_44' WHERE id=$1",
    [recipient.id],
  );
});
afterAll(async () => {
  await (db as DB & { close(): Promise<void> }).close();
});
async function reserve(gift = false, qty = 1, email = recipient.email) {
  const id = (
    await one(
      db,
      "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
      [e],
    )
  ).id;
  const r = await execute(db, buyer, {
    action: "reserve",
    event_id: e,
    items: [{ ticket_type_id: id, quantity: qty }],
    buyer_name: "Ficticio",
    buyer_email: "tampered@example.test",
    is_gift: gift,
    ...(gift ? { gift_email: email } : {}),
    idempotency_key: randomUUID(),
    admission_age_confirmed: true,
  });
  await db.transaction((tx) =>
    settle(tx, {
      orderId: r.order_id,
      transactionId: randomUUID(),
      amount: 45000 * qty * 100,
      currency: "COP",
      status: "APPROVED",
    }),
  );
  return r.order_id;
}
async function rows(order: string) {
  return (
    await db.query(
      "SELECT t.*,i.order_id FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=$1 ORDER BY t.id",
      [order],
    )
  ).rows;
}
describe("Cuentas y titularidad de entradas", () => {
  it("comprueba mínimos configurables sin asumir edad exacta a partir de rangos", () => {
    expect(ageRangeCanMeetMinimum("25_34", 35)).toBe(false);
    expect(ageRangeCanMeetMinimum("18_24", 21)).toBe(true);
    expect(ageRangeCanMeetMinimum(null, 18)).toBe(true);
    expect(ageRangeCanMeetMinimum("13_17", 18)).toBe(false);
  });
  it("dos aceptaciones simultáneas resuelven una vez y cerrar destinatario pendiente devuelve al remitente", async () => {
    const order = await reserve(true);
    const gift = await one(db, "SELECT * FROM ticket_transfers");
    const outcomes = await Promise.allSettled([
      execute(db, recipient, {
        action: "transfer_resolve",
        transfer_id: gift.id,
        accept: true,
      }),
      execute(db, recipient, {
        action: "transfer_resolve",
        transfer_id: gift.id,
        accept: true,
      }),
    ]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await rows(order))[0].owner_user_id).toBe(recipient.id);
    const pendingOrder = await reserve(true);
    await closeAccount(db, recipient);
    expect((await rows(pendingOrder))[0].owner_user_id).toBe(buyer.id);
    expect(
      (await ticketDocument(db, buyer, pendingOrder)).tickets,
    ).toHaveLength(1);
    expect(
      (
        await one(
          db,
          "SELECT count(*)::int AS n FROM ticket_transfers WHERE status='pending'",
        )
      ).n,
    ).toBe(0);
  });
  it("registro exige género y condiciones, edad opcional; compra fuerza correo verificado y usa perfil sin clonar acompañantes", async () => {
    expect(() =>
      registration.parse({ name: "Test", terms_accepted: true }),
    ).toThrow();
    expect(() =>
      registration.parse({
        name: "Test",
        gender: "female",
        terms_accepted: false,
      }),
    ).toThrow();
    expect(
      registration.parse({
        name: "Test",
        gender: "prefer_not_to_say",
        terms_accepted: true,
      }).age_band,
    ).toBeNull();
    const order = await reserve(false, 2);
    expect(
      (await one(db, "SELECT buyer_email FROM orders WHERE id=$1", [order]))
        .buyer_email,
    ).toBe(buyer.email);
    const people = (
      await db.query(
        "SELECT a.gender FROM order_attendees a JOIN order_items i ON i.id=a.order_item_id WHERE i.order_id=$1 ORDER BY a.ordinal",
        [order],
      )
    ).rows;
    expect(people.map((p) => p.gender)).toEqual(["female", null]);
  });
  it("regalo exige aceptación verificada, oculta QR pendiente y cambia titular/QR una sola vez", async () => {
    const order = await reserve(true);
    const before = (await rows(order))[0];
    const gift = await one(db, "SELECT * FROM ticket_transfers");
    expect((await ticketDocument(db, buyer, order)).tickets).toHaveLength(0);
    await expect(
      execute(
        db,
        { ...recipient, email_verified: false },
        { action: "transfer_resolve", transfer_id: gift.id, accept: true },
      ),
    ).rejects.toThrow("cuenta");
    await execute(db, recipient, {
      action: "transfer_resolve",
      transfer_id: gift.id,
      accept: true,
      admission_age_confirmed: true,
    });
    const after = (await rows(order))[0];
    expect(after.owner_user_id).toBe(recipient.id);
    expect(after.credential_hash).not.toBe(before.credential_hash);
    await expect(
      execute(db, recipient, {
        action: "transfer_resolve",
        transfer_id: gift.id,
        accept: true,
      }),
    ).rejects.toThrow("resuelta");
    expect((await ticketDocument(db, buyer, order)).tickets).toHaveLength(0);
    expect((await ticketDocument(db, recipient, order)).tickets).toHaveLength(
      1,
    );
    const s = await state(db, recipient);
    expect(s.tickets.find((t) => t.id === after.id)).toBeTruthy();
    expect(s.orders.find((o) => o.id === order)?.buyer_email).toBeNull();
    expect(
      (
        await one(db, "SELECT gender FROM order_attendees WHERE id=$1", [
          after.attendee_id,
        ])
      ).gender,
    ).toBe("male");
    expect(
      (
        await db.query(
          "SELECT * FROM delivery_jobs WHERE recipient_user_id=$1",
          [recipient.id],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("acepta regalo dirigido a correo sin cuenta después de registrarse; no se puede aceptar con otro correo", async () => {
    await reserve(true, 1, "future@example.test");
    const gift = await one(db, "SELECT * FROM ticket_transfers");
    await expect(
      execute(db, recipient, {
        action: "transfer_resolve",
        transfer_id: gift.id,
        accept: true,
      }),
    ).rejects.toThrow("cuenta");
    const actor = {
      id: randomUUID(),
      name: "Ficticio",
      email: "future@example.test",
      email_verified: true,
    };
    await db.query(
      "INSERT INTO profiles(id,name,email,gender) VALUES($1,$2,$3,'prefer_not_to_say')",
      [actor.id, actor.name, actor.email],
    );
    await execute(db, actor, {
      action: "transfer_resolve",
      transfer_id: gift.id,
      accept: true,
    });
    expect(
      (await one(db, "SELECT to_user_id FROM ticket_transfers")).to_user_id,
    ).toBe(actor.id);
  });
  it("regalo vence en 7 días y regresa con credencial nueva; no cambia cupo ni emite tickets adicionales", async () => {
    const order = await reserve(true);
    const before = (await rows(order))[0];
    const gift = await one(db, "SELECT * FROM ticket_transfers");
    await db.query(
      "UPDATE ticket_transfers SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [gift.id],
    );
    await expireTransfers(db);
    const after = (await rows(order))[0];
    expect(after.owner_user_id).toBe(buyer.id);
    expect(after.credential_hash).not.toBe(before.credential_hash);
    expect((await one(db, "SELECT status FROM ticket_transfers")).status).toBe(
      "expired",
    );
    expect((await rows(order)).length).toBe(1);
    expect((await ticketDocument(db, buyer, order)).tickets).toHaveLength(1);
  });
  it("transferencia solo a cuenta existente, por propietario, vigente y sin usar; rechazo restaura datos/QR", async () => {
    const order = await reserve(false, 2);
    const tickets = await rows(order);
    await db.query(
      "UPDATE order_attendees SET gender='other',age_band='55_64',demographics_consent=true WHERE id=$1",
      [tickets[0].attendee_id],
    );
    await expect(
      execute(db, buyer, {
        action: "transfer_create",
        ticket_ids: [tickets[0].id],
        recipient_email: "missing@example.test",
      }),
    ).rejects.toThrow("existente");
    await expect(
      execute(db, recipient, {
        action: "transfer_create",
        ticket_ids: [tickets[0].id],
        recipient_email: buyer.email,
      }),
    ).rejects.toThrow("tus entradas");
    const transfer = await execute(db, buyer, {
      action: "transfer_create",
      ticket_ids: [tickets[0].id],
      recipient_email: recipient.email,
    });
    expect((await ticketDocument(db, buyer, order)).tickets).toHaveLength(1);
    await expect(
      execute(db, buyer, {
        action: "transfer_create",
        ticket_ids: [tickets[0].id],
        recipient_email: recipient.email,
      }),
    ).rejects.toThrow("pendiente");
    await execute(db, recipient, {
      action: "transfer_resolve",
      transfer_id: transfer.id,
      accept: false,
    });
    expect(
      (
        await one(db, "SELECT gender FROM order_attendees WHERE id=$1", [
          tickets[0].attendee_id,
        ])
      ).gender,
    ).toBe("other");
    expect((await ticketDocument(db, buyer, order)).tickets).toHaveLength(2);
    await db.query(
      "UPDATE tickets SET status='used',used_at=now() WHERE id=$1",
      [tickets[0].id],
    );
    await expect(
      execute(db, buyer, {
        action: "transfer_create",
        ticket_ids: [tickets[0].id],
        recipient_email: recipient.email,
      }),
    ).rejects.toThrow("sin usar");
  });
  it("un ingreso no admite QR anterior ni uno pendiente de transferencia", async () => {
    const order = await reserve();
    const old = (await rows(order))[0];
    await execute(db, buyer, {
      action: "transfer_create",
      ticket_ids: [old.id],
      recipient_email: recipient.email,
    });
    const current = (await rows(order))[0];
    const scan = (credential: string) =>
      execute(db, USERS[3], {
        action: "checkin",
        event_id: e,
        credential,
        device_id: "TEST",
        gate_label: "TEST",
        request_id: randomUUID(),
      });
    expect((await scan(`pc:${decrypt(old.credential_encrypted)}`)).result).toBe(
      "unknown_ticket",
    );
    expect(
      (await scan(`pc:${decrypt(current.credential_encrypted)}`)).result,
    ).toBe("pending_transfer");
  });
  it("elimina cuenta sin borrar venta, anula propios sin usar, mantiene regalos aceptados y niega sesión/RLS antiguos", async () => {
    const mine = await reserve(false),
      giftOrder = await reserve(true);
    const gift = await one(db, "SELECT * FROM ticket_transfers");
    await execute(db, recipient, {
      action: "transfer_resolve",
      transfer_id: gift.id,
      accept: true,
    });
    await closeAccount(db, buyer);
    expect((await rows(mine))[0].status).toBe("cancelled");
    expect((await rows(giftOrder))[0].owner_user_id).toBe(recipient.id);
    expect(
      (
        await one(
          db,
          "SELECT name,email,deleted_at FROM profiles WHERE id=$1",
          [buyer.id],
        )
      ).email,
    ).toBeNull();
    expect((await db.query("SELECT id FROM orders")).rows).toHaveLength(2);
    await expect(
      execute(db, buyer, { action: "profile_update", name: "Reactivate" }),
    ).rejects.toThrow("eliminada");
    const privateRows = await db.transaction(async (tx) => {
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
        buyer.id,
      ]);
      await tx.query("SET LOCAL ROLE authenticated");
      return (await tx.query("SELECT id FROM orders")).rows;
    });
    expect(privateRows).toHaveLength(0);
    await expect(closeAccount(db, USERS[0])).rejects.toThrow(
      "último administrador",
    );
  });
  it("edad mínima se declara para compra propia y aceptación, sin copiar género a acompañantes", async () => {
    await db.query("UPDATE events SET minimum_age=18 WHERE id=$1", [e]);
    await db.query("UPDATE profiles SET age_band='13_17' WHERE id=$1", [
      buyer.id,
    ]);
    await expect(reserve(false)).rejects.toThrow("edad mínima");
    const order = await reserve(true, 2);
    const gift = await one(db, "SELECT * FROM ticket_transfers");
    await expect(
      execute(db, recipient, {
        action: "transfer_resolve",
        transfer_id: gift.id,
        accept: true,
      }),
    ).rejects.toThrow("edad mínima");
    await execute(db, recipient, {
      action: "transfer_resolve",
      transfer_id: gift.id,
      accept: true,
      admission_age_confirmed: true,
    });
    const demographic = (
      await db.query(
        "SELECT gender FROM order_attendees a JOIN order_items i ON i.id=a.order_item_id WHERE i.order_id=$1",
        [order],
      )
    ).rows;
    expect(demographic.filter((p) => p.gender === "male")).toHaveLength(1);
  });
});
it("ambos canales comparten fase, rechaza solapamientos y edición conserva snapshot comprado; organizaciones solo admin", async () => {
  const type = (
    await one(
      db,
      "SELECT id FROM ticket_types WHERE event_id=$1 AND name='General'",
      [e],
    )
  ).id;
  await db.query(
    "UPDATE pricing_phases SET active=false WHERE ticket_type_id=$1",
    [type],
  );
  const c = {
    action: "add_phase",
    event_id: e,
    ticket_type_id: type,
    name: "Ambos",
    channel: "both",
    price_cop: 30000,
    starts_at: new Date(Date.now() - 86400000).toISOString(),
    ends_at: new Date(Date.now() + 86400000).toISOString(),
  };
  await execute(db, USERS[0], c);
  await expect(execute(db, USERS[0], { ...c, channel: "web" })).rejects.toThrow(
    "superpuestas",
  );
  const phase = await one(
    db,
    "SELECT * FROM pricing_phases WHERE ticket_type_id=$1 AND channel='both'",
    [type],
  );
  const order = await execute(db, buyer, {
    action: "reserve",
    event_id: e,
    items: [{ ticket_type_id: type, quantity: 1 }],
    buyer_name: "Test",
    buyer_email: buyer.email,
    idempotency_key: randomUUID(),
  });
  await execute(db, USERS[0], {
    ...c,
    action: "update_phase",
    phase_id: phase.id,
    price_cop: 50000,
  });
  expect(
    (
      await one(db, "SELECT total_cop FROM orders WHERE id=$1", [
        order.order_id,
      ])
    ).total_cop,
  ).toBe(30000);
  await expect(
    execute(db, recipient, {
      action: "organization_save",
      name: "Not allowed",
    }),
  ).rejects.toThrow("administrador");
  const org = await execute(db, USERS[0], {
    action: "organization_save",
    name: "Ficticia",
  });
  await execute(db, USERS[0], {
    action: "organization_save",
    organization_id: org.id,
    name: "Editada",
  });
  expect(
    (await one(db, "SELECT name FROM organizations WHERE id=$1", [org.id]))
      .name,
  ).toBe("Editada");
});
