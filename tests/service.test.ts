import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { memoryDb, type DB } from "../src/lib/db";
import { seed, USERS } from "../src/lib/seed";
import { execute, one, ticketDocument, settle } from "../src/lib/service";
import { state } from "../src/lib/state";
import { hash } from "../src/lib/crypto";
import { csv } from "../src/lib/csv";
import { verifyWebhook } from "../src/lib/wompi";
import { deliver } from "../src/lib/delivery";
import { ticketPdf } from "../src/lib/pdf";
import { PDFDocument } from "pdf-lib";
let db: DB;
const admin = USERS[0],
  box = USERS[2],
  access = USERS[3],
  customer = USERS[4];
const e1 = "00000000-0000-4000-8000-000000000002",
  e2 = "00000000-0000-4000-8000-000000000003";
beforeAll(async () => {
  db = await memoryDb();
});
beforeEach(async () => {
  await db.query("TRUNCATE organizations,profiles CASCADE");
  await seed(db);
});
afterAll(async () => {
  await (db as DB & { close(): Promise<void> }).close();
});
async function type(event = e1) {
  return (
    await one(db, "SELECT id FROM ticket_types WHERE event_id=$1 AND name=$2", [
      event,
      "General",
    ])
  ).id as string;
}
async function sell(qty = 1, event = e1, method = "transfer") {
  return execute(db, box, {
    action: "sell",
    event_id: event,
    items: [{ ticket_type_id: await type(event), quantity: qty }],
    method,
    verified: true,
    reference: "VERIFICADA-DEMO",
    idempotency_key: randomUUID(),
  });
}
async function reserve(qty = 1, event = e1) {
  return execute(db, customer, {
    action: "reserve",
    event_id: event,
    items: [{ ticket_type_id: await type(event), quantity: qty }],
    buyer_name: "Comprador ficticio",
    buyer_email: "buyer@example.test",
    idempotency_key: randomUUID(),
  });
}
async function paid(orderId: string, status = "APPROVED") {
  const o = await one(db, "SELECT total_cop FROM orders WHERE id=$1", [
    orderId,
  ]);
  return db.transaction((tx) =>
    settle(tx, {
      orderId,
      transactionId: `TEST-${orderId}`,
      amount: o.total_cop * 100,
      currency: "COP",
      status,
    }),
  );
}
async function scan(
  credential: string,
  event = e1,
  request = randomUUID(),
  actor = access,
) {
  return execute(db, actor, {
    action: "checkin",
    event_id: event,
    credential,
    request_id: request,
    device_id: "TEST",
    gate_label: "Puerta test",
  });
}
describe("Inventario, precios y emisión transaccional", () => {
  it("separa cupos y órdenes entre dos eventos", async () => {
    await db.query("UPDATE events SET capacity=1 WHERE id=$1", [e1]);
    await sell();
    await expect(sell()).rejects.toThrow("cupo");
    expect(await sell(1, e2)).toHaveProperty("order_id");
  });
  it("no permite mezclar localidades de otro evento", async () => {
    await expect(
      execute(db, box, {
        action: "sell",
        event_id: e1,
        items: [{ ticket_type_id: await type(e2), quantity: 1 }],
        method: "transfer",
        verified: true,
        reference: "REF",
        idempotency_key: randomUUID(),
      }),
    ).rejects.toThrow();
  });
  it("conserva precios anteriores y distingue canales", async () => {
    const r = await reserve();
    await db.query(
      "UPDATE pricing_phases SET price_cop=60000 WHERE ticket_type_id=$1 AND channel=$2",
      [await type(), "web"],
    );
    const second = await reserve();
    expect(
      (await one(db, "SELECT total_cop FROM orders WHERE id=$1", [r.order_id]))
        .total_cop,
    ).toBe(45000);
    expect(
      (
        await one(db, "SELECT total_cop FROM orders WHERE id=$1", [
          second.order_id,
        ])
      ).total_cop,
    ).toBe(60000);
    const s = await sell();
    expect(
      (await one(db, "SELECT total_cop FROM orders WHERE id=$1", [s.order_id]))
        .total_cop,
    ).toBe(55000);
  });
  it("rechaza fases activas superpuestas", async () => {
    await expect(
      execute(db, admin, {
        action: "add_phase",
        event_id: e1,
        ticket_type_id: await type(),
        name: "Otra",
        channel: "web",
        price_cop: 1,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 60000).toISOString(),
      }),
    ).rejects.toThrow("superpuestas");
  });
  it("ventas concurrentes no exceden el aforo", async () => {
    await db.query("UPDATE events SET capacity=2 WHERE id=$1", [e1]);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => sell()),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(
      (
        await one(
          db,
          "SELECT count(*)::int AS n FROM tickets WHERE event_id=$1",
          [e1],
        )
      ).n,
    ).toBe(2);
  });
  it("reservas concurrentes no exceden cupo de localidad", async () => {
    await db.query("UPDATE ticket_types SET capacity=1 WHERE id=$1", [
      await type(),
    ]);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => reserve()),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("coordina confirmación y vencimiento sin sobreventa", async () => {
    await db.query("UPDATE events SET capacity=1 WHERE id=$1", [e1]);
    const r = await reserve();
    await db.query(
      "UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=$1",
      [r.order_id],
    );
    await Promise.allSettled([paid(r.order_id), sell()]);
    expect(
      (
        await one(
          db,
          "SELECT count(*)::int AS n FROM tickets WHERE event_id=$1",
          [e1],
        )
      ).n,
    ).toBe(1);
  });
  it("marca pago tardío sin inventario para revisión", async () => {
    await db.query("UPDATE events SET capacity=1 WHERE id=$1", [e1]);
    const r = await reserve();
    await db.query(
      "UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=$1",
      [r.order_id],
    );
    await sell();
    expect(await paid(r.order_id)).toEqual({ status: "needs_review" });
    expect(
      (
        await db.query(
          "SELECT * FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=$1",
          [r.order_id],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("confirma pago tardío con inventario una sola vez", async () => {
    const r = await reserve(3);
    await db.query(
      "UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=$1",
      [r.order_id],
    );
    await Promise.all([paid(r.order_id), paid(r.order_id)]);
    const doc = await ticketDocument(db, customer, r.order_id);
    expect(doc.tickets).toHaveLength(3);
    expect(new Set(doc.tickets.map((t) => t.credential)).size).toBe(3);
    expect(new Set(doc.tickets.map((t) => t.security_serial)).size).toBe(3);
  });
  it("reintenta venta idempotente sin duplicar ni recobrar", async () => {
    const command = {
      action: "sell",
      event_id: e1,
      items: [{ ticket_type_id: await type(), quantity: 2 }],
      method: "transfer",
      verified: true,
      reference: "REF",
      idempotency_key: randomUUID(),
    };
    const [a, b] = await Promise.all([
      execute(db, box, command),
      execute(db, box, command),
    ]);
    expect(a.order_id).toBe(b.order_id);
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(2);
  });
  it("cortesías consumen cupo y requieren organizador", async () => {
    await db.query("UPDATE events SET capacity=1 WHERE id=$1", [e1]);
    const command = {
      action: "sell",
      event_id: e1,
      items: [{ ticket_type_id: await type(), quantity: 1 }],
      method: "complimentary",
      reason: "Invitado autorizado",
      idempotency_key: randomUUID(),
    };
    await expect(execute(db, box, command)).rejects.toThrow("permiso");
    const r = await execute(db, admin, command);
    expect(
      (await one(db, "SELECT total_cop FROM orders WHERE id=$1", [r.order_id]))
        .total_cop,
    ).toBe(0);
    await expect(sell()).rejects.toThrow("cupo");
  });
});
describe("Permisos y RLS", () => {
  it("deniega ventas a compradores y personal de acceso", async () => {
    const command = {
      action: "sell",
      event_id: e1,
      items: [{ ticket_type_id: await type(), quantity: 1 }],
      method: "cash",
      idempotency_key: randomUUID(),
    };
    await expect(execute(db, customer, command)).rejects.toThrow("permiso");
    await expect(execute(db, access, command)).rejects.toThrow("permiso");
  });
  it("taquilla solo trabaja eventos asignados", async () => {
    await db.query(
      "UPDATE event_staff SET active=false WHERE event_id=$1 AND user_id=$2",
      [e2, box.id],
    );
    await expect(sell(1, e2)).rejects.toThrow("permiso");
  });
  it("email escrito en taquilla no atribuye propiedad de cuenta", async () => {
    const r = await execute(db, box, {
      action: "sell",
      event_id: e1,
      items: [{ ticket_type_id: await type(), quantity: 1 }],
      method: "transfer",
      verified: true,
      reference: "REF",
      buyer_email: "customer@example.test",
      idempotency_key: randomUUID(),
    });
    await expect(ticketDocument(db, customer, r.order_id)).rejects.toThrow(
      "permiso",
    );
    expect((await state(db, customer)).orders).toHaveLength(0);
  });
  it("no filtra QR en estado administrativo", async () => {
    await sell();
    const data = JSON.stringify(await state(db, admin));
    expect(data).not.toContain("credential_");
    expect(data).not.toContain("share_encrypted");
  });
  it("RLS impide leer órdenes ajenas y escribir roles", async () => {
    await sell();
    await db.transaction(async (tx) => {
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
        customer.id,
      ]);
      await tx.query("SET LOCAL ROLE authenticated");
      expect((await tx.query("SELECT id FROM orders")).rows).toHaveLength(0);
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
          customer.id,
        ]);
        await tx.query("SET LOCAL ROLE authenticated");
        await tx.query("INSERT INTO platform_admins VALUES($1)", [customer.id]);
      }),
    ).rejects.toThrow("permission denied");
  });
  it("RLS permite comprador dueño y bloquea credenciales", async () => {
    const r = await reserve();
    await paid(r.order_id);
    await db.transaction(async (tx) => {
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
        customer.id,
      ]);
      await tx.query("SET LOCAL ROLE authenticated");
      expect((await tx.query("SELECT id FROM orders")).rows).toHaveLength(1);
      expect((await tx.query("SELECT id FROM tickets")).rows).toHaveLength(1);
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.query("SET LOCAL ROLE authenticated");
        await tx.query("SELECT credential_encrypted FROM tickets");
      }),
    ).rejects.toThrow("permission denied");
  });
  it("RLS oculta eventos borrador al público", async () => {
    await db.query("UPDATE events SET status='draft' WHERE id=$1", [e2]);
    await db.transaction(async (tx) => {
      await tx.query("SET LOCAL ROLE anon");
      expect((await tx.query("SELECT id FROM events")).rows).toHaveLength(1);
    });
  });
});
describe("Validación online y documentos", () => {
  it("QR identifica evento sin selección y conserva idempotencia", async () => {
    const sale = await sell(1, e2);
    const doc = await ticketDocument(db, box, sale.order_id);
    const c = {
      action: "scan_auto",
      credential: doc.tickets[0].credential,
      request_id: randomUUID(),
      device_id: "AUTO",
      gate_label: "Puerta",
    };
    const first = await execute(db, access, c);
    expect(first).toMatchObject({ result: "accepted", event_id: e2 });
    expect(first.event_title).toBeTruthy();
    expect(await execute(db, access, c)).toMatchObject({
      result: "accepted",
      event_id: e2,
    });
    expect(
      await execute(db, access, { ...c, request_id: randomUUID() }),
    ).toMatchObject({ result: "already_used" });
    expect(
      (
        await one(
          db,
          "SELECT count(*)::int AS n FROM check_in_attempts WHERE result='accepted'",
        )
      ).n,
    ).toBe(1);
  });
  it("detección automática no revela evento ni consume boleta sin permiso", async () => {
    const sale = await sell(1, e2);
    const doc = await ticketDocument(db, box, sale.order_id);
    await db.query("DELETE FROM event_staff WHERE user_id=$1 AND event_id=$2", [
      access.id,
      e2,
    ]);
    const c = {
      action: "scan_auto",
      credential: doc.tickets[0].credential,
      request_id: randomUUID(),
      device_id: "AUTO",
      gate_label: "Puerta",
    };
    expect(await execute(db, access, c)).toEqual({ result: "unauthorized" });
    expect(
      (
        await one(db, "SELECT status FROM tickets WHERE id=$1", [
          doc.tickets[0].id,
        ])
      ).status,
    ).toBe("valid");
    expect(
      await execute(db, access, {
        ...c,
        credential: "QR ajeno",
        request_id: randomUUID(),
      }),
    ).toEqual({ result: "unknown_ticket" });
  });
  it("dos lectores producen una sola aceptación", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    const results = await Promise.all([
      scan(doc.tickets[0].credential),
      scan(doc.tickets[0].credential),
    ]);
    expect(results.map((r) => r.result).sort()).toEqual([
      "accepted",
      "already_used",
    ]);
  });
  it("reintento por respuesta perdida conserva aceptación original", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id),
      id = randomUUID();
    expect((await scan(doc.tickets[0].credential, e1, id)).result).toBe(
      "accepted",
    );
    expect((await scan(doc.tickets[0].credential, e1, id)).result).toBe(
      "accepted",
    );
    expect(
      (await one(db, "SELECT count(*)::int AS n FROM check_in_attempts")).n,
    ).toBe(1);
  });
  it("rechaza otro evento y consecutivo como credencial", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    expect((await scan(doc.tickets[0].credential, e2)).result).toBe(
      "wrong_event",
    );
    expect((await scan(doc.tickets[0].visible_number)).result).toBe(
      "unknown_ticket",
    );
  });
  it("rechaza operador no autorizado y ventana cerrada", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    expect(
      (await scan(doc.tickets[0].credential, e1, randomUUID(), customer))
        .result,
    ).toBe("unauthorized");
    await db.query(
      "UPDATE events SET admission_ends_at=now()-interval '1 hour',admission_starts_at=now()-interval '2 hours' WHERE id=$1",
      [e1],
    );
    expect((await scan(doc.tickets[0].credential)).result).toBe(
      "outside_admission_window",
    );
  });
  it("anulación impide ingreso", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    await execute(db, admin, {
      action: "cancel_ticket",
      ticket_id: doc.tickets[0].id,
      reason: "Cancelación autorizada",
    });
    expect((await scan(doc.tickets[0].credential)).result).toBe("cancelled");
  });
  it("sustitución invalida QR anterior, conserva número y serial", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    await execute(db, admin, {
      action: "replace_ticket",
      ticket_id: doc.tickets[0].id,
      reason: "QR comprometido",
    });
    const updated = await ticketDocument(db, box, r.order_id);
    expect(updated.tickets[0].visible_number).toBe(
      doc.tickets[0].visible_number,
    );
    expect((await scan(doc.tickets[0].credential)).result).toBe(
      "unknown_ticket",
    );
    expect((await scan(updated.tickets[0].credential)).result).toBe("accepted");
  });
  it("reimpresión y reenvío no crean entradas nuevas", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    await execute(db, box, {
      action: "print_request",
      ticket_id: doc.tickets[0].id,
    });
    await execute(db, box, {
      action: "print_request",
      ticket_id: doc.tickets[0].id,
    });
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(1);
    expect(
      (
        await one(
          db,
          "SELECT is_reprint FROM print_jobs ORDER BY created_at DESC LIMIT 1",
        )
      ).is_reprint,
    ).toBe(true);
    expect(
      (await ticketDocument(db, box, r.order_id)).tickets[0].credential,
    ).toBe(doc.tickets[0].credential);
  });
  it("documento PDF válido y enlace compartido revocable", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    expect((await ticketPdf(doc)).subarray(0, 4).toString()).toBe("%PDF");
    expect(
      (await ticketDocument(db, null, r.order_id, doc.share)).tickets,
    ).toHaveLength(1);
    await execute(db, box, { action: "revoke_share", order_id: r.order_id });
    await expect(
      ticketDocument(db, null, r.order_id, doc.share),
    ).rejects.toThrow("sesión");
  });
});
describe("Pagos, entrega y caja", () => {
  it("correo contiene QR y PDF individual por entrada, reintento congela adjuntos", async () => {
    const r = await reserve(2);
    await paid(r.order_id);
    let firstPayload = "";
    await deliver(db, {
      send: async (message) => {
        const pdfs = message.attachments.filter(
          (a) => a.content_type === "application/pdf",
        );
        const images = message.attachments.filter(
          (a) => a.content_type === "image/png",
        );
        expect(pdfs).toHaveLength(2);
        expect(images).toHaveLength(2);
        expect(images[0].content).not.toBe(images[1].content);
        expect(message.html).toContain('src="cid:entrada-0"');
        expect(message.html).not.toContain("pc:");
        for (const file of pdfs)
          expect(
            (
              await PDFDocument.load(Buffer.from(file.content, "base64"))
            ).getPageCount(),
          ).toBe(1);
        firstPayload = JSON.stringify(message.attachments);
        throw new Error("Fallo simulado");
      },
    });
    await db.query(
      "UPDATE events SET title='Título cambiado después del intento' WHERE id=$1",
      [e1],
    );
    await db.query("UPDATE delivery_jobs SET next_attempt_at=now()");
    await deliver(db, {
      send: async (message) => {
        expect(JSON.stringify(message.attachments)).toBe(firstPayload);
      },
    });
    expect((await one(db, "SELECT status FROM delivery_jobs")).status).toBe(
      "sent",
    );
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(2);
    expect(JSON.stringify(await state(db, admin))).not.toContain(
      "email_payload_encrypted",
    );
    await expect(
      db.transaction(async (tx) => {
        await tx.query("SET LOCAL ROLE authenticated");
        await tx.query("SELECT email_payload_encrypted FROM delivery_jobs");
      }),
    ).rejects.toThrow(/permission denied/);
  });
  it("fallo de email conserva la venta y se reintenta sin reemitir", async () => {
    const r = await reserve();
    await paid(r.order_id);
    await deliver(db, {
      send: async () => {
        throw new Error("Proveedor desconectado");
      },
    });
    expect((await one(db, "SELECT status FROM delivery_jobs")).status).toBe(
      "failed",
    );
    expect(
      (await one(db, "SELECT status FROM orders WHERE id=$1", [r.order_id]))
        .status,
    ).toBe("confirmed");
    await db.query("UPDATE delivery_jobs SET next_attempt_at=now()");
    await deliver(db, { send: async () => {} });
    expect((await one(db, "SELECT status FROM delivery_jobs")).status).toBe(
      "sent",
    );
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(1);
  });
  it("registra devolución de pago tardío sin boletas", async () => {
    await db.query("UPDATE events SET capacity=1 WHERE id=$1", [e1]);
    const r = await reserve();
    await db.query(
      "UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=$1",
      [r.order_id],
    );
    await sell();
    await paid(r.order_id);
    await execute(db, admin, {
      action: "refund",
      order_id: r.order_id,
      ticket_ids: [],
      amount_cop: 45000,
      reason: "Pago tardío sin cupo",
      external_reference: "REF-TEST",
    });
    expect(
      (await one(db, "SELECT status FROM orders WHERE id=$1", [r.order_id]))
        .status,
    ).toBe("refunded");
  });
  it("devolución en efectivo descuenta la caja abierta", async () => {
    await execute(db, box, {
      action: "cash_open",
      event_id: e1,
      opening_cash_cop: 10000,
    });
    const r = await sell(1, e1, "cash"),
      doc = await ticketDocument(db, box, r.order_id);
    await execute(db, admin, {
      action: "refund",
      order_id: r.order_id,
      ticket_ids: [doc.tickets[0].id],
      amount_cop: 55000,
      reason: "Devolución manual en efectivo",
      external_reference: "EF-TEST",
    });
    const s = await one(db, "SELECT id FROM cash_sessions");
    expect(
      await execute(db, box, {
        action: "cash_close",
        event_id: e1,
        session_id: s.id,
        declared_cash_cop: 10000,
        notes: "",
      }),
    ).toEqual({ expected: 10000, difference: 0 });
  });
  it("rechaza importe alterado y webhook inválido", async () => {
    const r = await reserve();
    await expect(
      db.transaction((tx) =>
        settle(tx, {
          orderId: r.order_id,
          transactionId: "X",
          amount: 1,
          currency: "COP",
          status: "APPROVED",
        }),
      ),
    ).rejects.toThrow("coincide");
    const body = {
      event: "transaction.updated",
      environment: "test",
      data: {
        transaction: {
          id: "T",
          status: "APPROVED",
          amount_in_cents: 4500000,
          reference: "R",
          currency: "COP",
        },
      },
      timestamp: 123,
      signature: {
        properties: [
          "transaction.id",
          "transaction.status",
          "transaction.amount_in_cents",
        ],
        checksum: "0".repeat(64),
      },
    };
    expect(() => verifyWebhook(body, "test-secret")).toThrow("Firma");
    body.signature.checksum = hash("TAPPROVED4500000123test-secret");
    expect(verifyWebhook(body, "test-secret").data.transaction.id).toBe("T");
  });
  it("ignora notificación duplicada y tardía de rechazo tras aprobación", async () => {
    const r = await reserve(2);
    await paid(r.order_id);
    await paid(r.order_id);
    await paid(r.order_id, "DECLINED");
    expect(
      (await one(db, "SELECT status FROM orders WHERE id=$1", [r.order_id]))
        .status,
    ).toBe("confirmed");
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(2);
  });
  it("email con outbox persistente no duplica entradas", async () => {
    const r = await reserve();
    await paid(r.order_id);
    expect((await one(db, "SELECT status FROM delivery_jobs")).status).toBe(
      "pending",
    );
    await deliver(db);
    expect((await one(db, "SELECT status FROM delivery_jobs")).status).toBe(
      "sent",
    );
    await execute(db, customer, { action: "resend", order_id: r.order_id });
    await deliver(db);
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(1);
  });
  it("cierre calcula solo efectivo y conserva diferencia", async () => {
    await execute(db, box, {
      action: "cash_open",
      event_id: e1,
      opening_cash_cop: 10000,
    });
    await sell(1, e1, "cash");
    await sell(1, e1, "transfer");
    const s = await one(db, "SELECT id FROM cash_sessions");
    await execute(db, box, {
      action: "cash_move",
      event_id: e1,
      session_id: s.id,
      type: "out",
      amount_cop: 5000,
      reason: "Gasto autorizado",
    });
    expect(
      await execute(db, box, {
        action: "cash_close",
        event_id: e1,
        session_id: s.id,
        declared_cash_cop: 59000,
        notes: "Diferencia real",
      }),
    ).toEqual({ expected: 60000, difference: -1000 });
  });
  it("reembolso parcial identifica entradas, respeta importe y anula acceso", async () => {
    const r = await sell(2),
      doc = await ticketDocument(db, box, r.order_id);
    await execute(db, admin, {
      action: "refund",
      order_id: r.order_id,
      ticket_ids: [doc.tickets[0].id],
      amount_cop: 55000,
      reason: "Devolución acordada",
      external_reference: "BANCO-TEST",
    });
    expect(
      (await one(db, "SELECT status FROM orders WHERE id=$1", [r.order_id]))
        .status,
    ).toBe("partially_refunded");
    expect((await scan(doc.tickets[0].credential)).result).toBe("cancelled");
    await expect(
      execute(db, admin, {
        action: "refund",
        order_id: r.order_id,
        ticket_ids: [doc.tickets[1].id],
        amount_cop: 90000,
        reason: "Test",
        external_reference: "X",
      }),
    ).rejects.toThrow("supera");
  });
  it("exportación CSV neutraliza fórmulas y comillas", () => {
    const result = csv([
      { name: '=HYPERLINK("x")', note: "+evil", extra: "@cmd" },
    ]);
    expect(result).toContain('"\'=HYPERLINK(""x"")"');
    expect(result).toContain('"\'+evil"');
    expect(result).toContain('"\'@cmd"');
  });
  it("deshabilita demo en producción", async () => {
    const previous = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    try {
      const r = await reserve();
      await expect(
        execute(db, customer, { action: "demo_payment", order_id: r.order_id }),
      ).rejects.toThrow("prohibido");
    } finally {
      vi.stubEnv("NODE_ENV", previous);
    }
  });
});
