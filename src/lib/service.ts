import { randomUUID } from "node:crypto";
import type { DB, Tx, Row } from "./db";
import { hash, token, encrypt, decrypt } from "./crypto";
import { demoMode } from "./config";
import { commands, type Command } from "./validation";
export type Actor = { id: string; name: string; email?: string };
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function fail(message: string, status = 400): never {
  throw new AppError(message, status);
}
export async function one(
  tx: Tx,
  sql: string,
  params: unknown[] = [],
): Promise<Row> {
  return (
    (await tx.query(sql, params)).rows[0] ?? fail("Registro no encontrado", 404)
  );
}
export async function admin(tx: Tx, a: Actor) {
  return (
    (await tx.query("SELECT 1 FROM platform_admins WHERE user_id=$1", [a.id]))
      .rows.length > 0
  );
}
export async function can(
  tx: Tx,
  a: Actor,
  eventId: string,
  permission: "manage" | "sell" | "access" | "view",
) {
  if (await admin(tx, a)) return true;
  const e = await one(tx, "SELECT organization_id FROM events WHERE id=$1", [
    eventId,
  ]);
  if (
    (
      await tx.query(
        "SELECT 1 FROM organization_members WHERE user_id=$1 AND organization_id=$2",
        [a.id, e.organization_id],
      )
    ).rows.length
  )
    return true;
  if (permission === "manage") return false;
  const roles =
    permission === "sell"
      ? ["box_office"]
      : permission === "access"
        ? ["access_staff"]
        : ["box_office", "access_staff"];
  return (
    (
      await tx.query(
        "SELECT 1 FROM event_staff WHERE user_id=$1 AND event_id=$2 AND active AND role=ANY($3::text[])",
        [a.id, eventId, roles],
      )
    ).rows.length > 0
  );
}
export async function permit(
  tx: Tx,
  a: Actor,
  eventId: string,
  p: "manage" | "sell" | "access" | "view",
) {
  if (!(await can(tx, a, eventId, p)))
    fail("No tienes permiso para esta operación", 403);
}
export async function audit(
  tx: Tx,
  a: Actor | null,
  action: string,
  type: string,
  id: string,
  metadata: Row = {},
) {
  await tx.query(
    "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,safe_metadata) VALUES($1,$2,$3,$4,$5)",
    [a?.id ?? null, action, type, id, JSON.stringify(metadata)],
  );
}
async function lockEvent(tx: Tx, id: string) {
  return one(tx, "SELECT * FROM events WHERE id=$1 FOR UPDATE", [id]);
}
async function expire(tx: Tx, eventId: string) {
  await tx.query(
    "UPDATE orders SET status='expired' WHERE event_id=$1 AND status='pending_payment' AND reservation_expires_at<=now()",
    [eventId],
  );
}
async function stock(tx: Tx, eventId: string, typeId?: string) {
  const p: unknown[] = [eventId];
  if (typeId) p.push(typeId);
  return Number(
    (
      await one(
        tx,
        `SELECT coalesce(sum(i.quantity),0)::int AS count FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.event_id=$1 ${typeId ? "AND i.ticket_type_id=$2" : ""} AND ((o.status='pending_payment' AND o.reservation_expires_at>now()) OR o.status IN ('confirmed','partially_refunded','refunded'))`,
        p,
      )
    ).count,
  );
}
// Capacity remains consumed after cancellation/refund; organizer cannot silently resell cancelled credentials.
async function enough(
  tx: Tx,
  e: Row,
  items: { ticket_type_id: string; quantity: number }[],
) {
  const total = items.reduce((sum, x) => sum + x.quantity, 0);
  if (new Set(items.map((x) => x.ticket_type_id)).size !== items.length)
    fail("Localidades repetidas");
  if ((await stock(tx, e.id)) + total > e.capacity)
    fail("No hay cupo disponible");
  for (const i of items) {
    const t = await one(
      tx,
      "SELECT * FROM ticket_types WHERE id=$1 AND event_id=$2 AND active",
      [i.ticket_type_id, e.id],
    );
    if ((await stock(tx, e.id, t.id)) + i.quantity > t.capacity)
      fail(`Sin cupo en ${t.name}`);
  }
}
async function orderPermit(tx: Tx, a: Actor, id: string, manage = false) {
  const o = await one(tx, "SELECT * FROM orders WHERE id=$1", [id]);
  if (!manage && o.buyer_user_id === a.id) return o;
  await permit(tx, a, o.event_id, manage ? "manage" : "sell");
  return o;
}
async function issue(tx: Tx, o: Row, e: Row) {
  if (
    (
      await tx.query(
        "SELECT 1 FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=$1 LIMIT 1",
        [o.id],
      )
    ).rows.length
  )
    return;
  const share = token();
  await tx.query(
    "UPDATE orders SET share_hash=$2,share_encrypted=$3 WHERE id=$1",
    [o.id, hash(share), encrypt(share)],
  );
  let seq = e.next_sequence;
  for (const i of (
    await tx.query("SELECT * FROM order_items WHERE order_id=$1 ORDER BY id", [
      o.id,
    ])
  ).rows)
    for (let n = 0; n < i.quantity; n++) {
      const credential = token();
      const num = `PC-${String(e.id).slice(0, 8).toUpperCase()}-${String(seq).padStart(6, "0")}`;
      await tx.query(
        "INSERT INTO tickets(event_id,ticket_type_id,order_item_id,owner_user_id,event_sequence,visible_number,security_serial,credential_hash,credential_encrypted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          e.id,
          i.ticket_type_id,
          i.id,
          o.buyer_user_id,
          seq++,
          num,
          token().slice(0, 16).toUpperCase(),
          hash(credential),
          encrypt(credential),
        ],
      );
    }
  await tx.query("UPDATE events SET next_sequence=$2 WHERE id=$1", [e.id, seq]);
  if (o.buyer_email)
    await tx.query("INSERT INTO delivery_jobs(order_id) VALUES($1)", [o.id]);
  await audit(tx, null, "tickets_issued", "order", o.id, {
    quantity: seq - e.next_sequence,
  });
}
async function createOrder(
  tx: Tx,
  a: Actor,
  c: Extract<Command, { action: "reserve" | "sell" }>,
) {
  const web = c.action === "reserve";
  const complimentary = !web && c.method === "complimentary";
  if (!web) await permit(tx, a, c.event_id, complimentary ? "manage" : "sell");
  const e = await lockEvent(tx, c.event_id);
  const prior = (
    await tx.query(
      "SELECT id,created_by,event_id FROM orders WHERE idempotency_key=$1",
      [c.idempotency_key],
    )
  ).rows[0];
  if (prior) {
    if (prior.created_by !== a.id || prior.event_id !== e.id)
      fail("Clave de solicitud ya utilizada", 409);
    return { order_id: prior.id };
  }
  if (e.status !== "published") fail("Este evento no tiene ventas abiertas");
  await expire(tx, e.id);
  await enough(tx, e, c.items);
  const channel = web ? "web" : complimentary ? "complimentary" : "box_office";
  if (
    c.action === "sell" &&
    c.method === "transfer" &&
    (!c.verified || !c.reference)
  )
    fail("Verifica la transferencia y registra su referencia");
  if (complimentary && (!("reason" in c) || !c.reason))
    fail("Registra el motivo de la cortesía");
  const lines: Row[] = [];
  let total = 0;
  for (const i of c.items) {
    const t = await one(
      tx,
      "SELECT * FROM ticket_types WHERE id=$1 AND event_id=$2",
      [i.ticket_type_id, e.id],
    );
    const phase = complimentary
      ? { id: null, price_cop: 0, name: "Cortesía" }
      : await one(
          tx,
          "SELECT * FROM pricing_phases WHERE ticket_type_id=$1 AND channel=$2 AND active AND starts_at<=now() AND ends_at>now()",
          [t.id, channel],
        );
    const line = phase.price_cop * i.quantity;
    total += line;
    lines.push({ ...i, type_name: t.name, phase, line });
  }
  if (!Number.isSafeInteger(total) || total > 100000000)
    fail("Importe fuera del límite");
  let cash: Row | undefined;
  if (!web && c.method === "cash")
    cash = await one(
      tx,
      "SELECT * FROM cash_sessions WHERE event_id=$1 AND operator_id=$2 AND closed_at IS NULL FOR UPDATE",
      [e.id, a.id],
    );
  const minutes = Math.min(
    60,
    Math.max(1, Number(process.env.RESERVATION_MINUTES ?? 10)),
  );
  const o = await one(
    tx,
    `INSERT INTO orders(event_id,buyer_user_id,buyer_name,buyer_email,buyer_phone,buyer_category,channel,status,reservation_expires_at,subtotal_cop,total_cop,created_by,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+($9::int*interval '1 minute'),$10,$10,$11,$12) RETURNING *`,
    [
      e.id,
      web ? a.id : null,
      c.buyer_name || null,
      c.buyer_email || null,
      c.buyer_phone || null,
      c.buyer_category || null,
      channel,
      web ? "pending_payment" : "confirmed",
      minutes,
      total,
      a.id,
      c.idempotency_key,
    ],
  );
  for (const l of lines)
    await tx.query(
      "INSERT INTO order_items(order_id,event_id,ticket_type_id,pricing_phase_id,quantity,unit_price_cop,line_total_cop,type_name,phase_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        o.id,
        e.id,
        l.ticket_type_id,
        l.phase.id,
        l.quantity,
        l.phase.price_cop,
        l.line,
        l.type_name,
        l.phase.name,
      ],
    );
  const payment = await one(
    tx,
    `INSERT INTO payments(order_id,provider,method,reference,amount_cop,status,verified_by,verified_at,cash_session_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      o.id,
      web ? "wompi" : "manual",
      web ? "checkout" : c.method,
      `PC-${o.id}`,
      total,
      web ? "pending" : "approved",
      web ? null : a.id,
      web ? null : new Date(),
      cash?.id ?? null,
    ],
  );
  if (cash)
    await tx.query(
      "INSERT INTO cash_movements(cash_session_id,payment_id,type,amount_cop,reason,created_by) VALUES($1,$2,'sale',$3,'Venta en efectivo',$4)",
      [cash.id, payment.id, total, a.id],
    );
  if (!web) {
    await issue(tx, o, e);
    await audit(
      tx,
      a,
      complimentary ? "complimentary_issued" : "box_office_sale",
      "order",
      o.id,
      {
        method: c.method,
        reference: c.reference ?? null,
        reason: c.reason ?? null,
      },
    );
  } else await audit(tx, a, "reservation_created", "order", o.id);
  return { order_id: o.id };
}
export async function settle(
  tx: Tx,
  input: {
    orderId: string;
    transactionId: string;
    amount: number;
    currency: string;
    status: string;
    provider?: string;
  },
) {
  const initial = await one(tx, "SELECT * FROM orders WHERE id=$1", [
    input.orderId,
  ]);
  const e = await lockEvent(tx, initial.event_id);
  const o = await one(tx, "SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
    initial.id,
  ]);
  const p = await one(
    tx,
    "SELECT * FROM payments WHERE order_id=$1 FOR UPDATE",
    [o.id],
  );
  if (
    input.currency !== "COP" ||
    input.amount !== o.total_cop * 100 ||
    o.channel !== "web"
  )
    fail("El pago no coincide con la orden", 409);
  if (
    p.provider_transaction_id &&
    p.provider_transaction_id !== input.transactionId
  )
    fail("Transacción distinta: requiere conciliación", 409);
  if (p.status === "approved") return { status: o.status };
  if (
    !["APPROVED", "DECLINED", "ERROR", "VOIDED", "PENDING"].includes(
      input.status,
    )
  )
    fail("Estado de pago desconocido");
  if (input.status === "PENDING") return { status: o.status };
  await tx.query(
    "UPDATE payments SET provider_transaction_id=$2,status=$3,verified_at=now() WHERE id=$1",
    [p.id, input.transactionId, input.status.toLowerCase()],
  );
  if (input.status !== "APPROVED") {
    await tx.query(
      "UPDATE orders SET status='cancelled' WHERE id=$1 AND status IN ('pending_payment','expired')",
      [o.id],
    );
    return { status: "cancelled" };
  }
  await expire(tx, e.id);
  const expired =
    o.status !== "pending_payment" ||
    new Date(o.reservation_expires_at).getTime() <= Date.now();
  if (expired) {
    await tx.query("UPDATE orders SET status='expired' WHERE id=$1", [o.id]);
    const items = (
      await tx.query(
        "SELECT ticket_type_id,quantity FROM order_items WHERE order_id=$1",
        [o.id],
      )
    ).rows as { ticket_type_id: string; quantity: number }[];
    try {
      await enough(tx, e, items);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      await tx.query("UPDATE orders SET status='needs_review' WHERE id=$1", [
        o.id,
      ]);
      await audit(tx, null, "late_payment_no_capacity", "order", o.id);
      return { status: "needs_review" };
    }
  }
  if (e.status === "cancelled" || e.status === "finished") {
    await tx.query("UPDATE orders SET status='needs_review' WHERE id=$1", [
      o.id,
    ]);
    return { status: "needs_review" };
  }
  await tx.query("UPDATE orders SET status='confirmed' WHERE id=$1", [o.id]);
  await issue(tx, o, e);
  await audit(tx, null, "payment_approved", "order", o.id, {
    transactionId: input.transactionId,
  });
  return { status: "confirmed" };
}
async function checkin(
  tx: Tx,
  a: Actor,
  c: Extract<Command, { action: "checkin" | "manual_checkin" }>,
) {
  const authorized = await can(tx, a, c.event_id, "access");
  // Event lock serializes expiry, capacity and access transitions across all app instances.
  const e = await lockEvent(tx, c.event_id);
  const prior = (
    await tx.query(
      "SELECT result,ticket_id,operator_id,event_id FROM check_in_attempts WHERE request_id=$1",
      [c.request_id],
    )
  ).rows[0];
  if (prior) {
    if (prior.operator_id !== a.id || prior.event_id !== c.event_id)
      fail("Intento ajeno", 403);
    return { result: prior.result, ticket_id: prior.ticket_id };
  }
  const t = (
    await tx.query(
      c.action === "manual_checkin"
        ? "SELECT * FROM tickets WHERE id=$1 FOR UPDATE"
        : "SELECT * FROM tickets WHERE credential_hash=$1 FOR UPDATE",
      [
        c.action === "manual_checkin"
          ? c.ticket_id
          : hash(c.credential.replace(/^pc:/, "")),
      ],
    )
  ).rows[0];
  const now = Date.now();
  const result = !authorized
    ? "unauthorized"
    : !t
      ? "unknown_ticket"
      : t.event_id !== e.id
        ? "wrong_event"
        : t.status === "cancelled" || e.status === "cancelled"
          ? "cancelled"
          : t.status === "used"
            ? "already_used"
            : now < new Date(e.admission_starts_at).getTime() ||
                now >= new Date(e.admission_ends_at).getTime() ||
                e.status === "finished"
              ? "outside_admission_window"
              : "accepted";
  if (result === "accepted")
    await tx.query(
      "UPDATE tickets SET status='used',used_at=now() WHERE id=$1",
      [t.id],
    );
  await tx.query(
    "INSERT INTO check_in_attempts(event_id,ticket_id,operator_id,device_id,gate_label,result,request_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      e.id,
      authorized ? (t?.id ?? null) : null,
      a.id,
      c.device_id,
      c.gate_label,
      result,
      c.request_id,
      c.action === "manual_checkin" ? c.reason : null,
    ],
  );
  if (c.action === "manual_checkin")
    await audit(tx, a, "manual_checkin", "event", e.id, {
      result,
      reason: c.reason,
    });
  return {
    result,
    ticket_id: authorized ? (t?.id ?? null) : null,
    visible_number: authorized ? (t?.visible_number ?? null) : null,
  };
}
export async function execute(db: DB, a: Actor, input: unknown): Promise<Row> {
  const c = commands.parse(input);
  return db.transaction(async (tx) => {
    switch (c.action) {
      case "create_event": {
        if (
          !(await admin(tx, a)) &&
          !(
            await tx.query(
              "SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2",
              [c.organization_id, a.id],
            )
          ).rows.length
        )
          fail("Organización no autorizada", 403);
        const { action: _action, ...data } = c;
        void _action;
        const keys = Object.keys(data);
        const e = await one(
          tx,
          `INSERT INTO events(${keys.join(",")},created_by) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")},$${keys.length + 1}) RETURNING id`,
          [...Object.values(data), a.id],
        );
        await audit(tx, a, "event_created", "event", e.id);
        return { event_id: e.id };
      }
      case "event_status": {
        await permit(tx, a, c.event_id, "manage");
        const e = await lockEvent(tx, c.event_id);
        const transitions: Record<string, string[]> = {
          draft: ["published", "cancelled"],
          published: ["sales_closed", "cancelled"],
          sales_closed: ["published", "finished", "cancelled"],
          finished: [],
          cancelled: [],
        };
        if (!transitions[e.status].includes(c.status))
          fail("Transición de evento no permitida");
        if (c.status === "published") {
          const types = (
            await tx.query(
              "SELECT id FROM ticket_types WHERE event_id=$1 AND active",
              [e.id],
            )
          ).rows;
          if (!types.length) fail("Crea al menos una localidad y sus precios");
          for (const t of types)
            for (const ch of ["web", "box_office"])
              if (
                !(
                  await tx.query(
                    "SELECT 1 FROM pricing_phases WHERE ticket_type_id=$1 AND channel=$2 AND active AND starts_at<=now() AND ends_at>now()",
                    [t.id, ch],
                  )
                ).rows.length
              )
                fail(
                  "Todas las localidades necesitan precios vigentes web y taquilla",
                );
        }
        await tx.query("UPDATE events SET status=$2 WHERE id=$1", [
          e.id,
          c.status,
        ]);
        if (c.status === "cancelled") {
          await tx.query(
            "UPDATE tickets SET status='cancelled' WHERE event_id=$1 AND status='valid'",
            [e.id],
          );
          await tx.query(
            "UPDATE orders SET status='cancelled' WHERE event_id=$1 AND status='pending_payment'",
            [e.id],
          );
        }
        await audit(tx, a, "event_status_changed", "event", e.id, {
          from: e.status,
          to: c.status,
        });
        return {};
      }
      case "add_type": {
        await permit(tx, a, c.event_id, "manage");
        const e = await lockEvent(tx, c.event_id);
        if (c.capacity > e.capacity) fail("Cupo de localidad mayor al aforo");
        const t = await one(
          tx,
          "INSERT INTO ticket_types(event_id,name,capacity) VALUES($1,$2,$3) RETURNING id",
          [e.id, c.name, c.capacity],
        );
        await audit(tx, a, "type_created", "ticket_type", t.id);
        return { ticket_type_id: t.id };
      }
      case "add_phase": {
        await permit(tx, a, c.event_id, "manage");
        await lockEvent(tx, c.event_id);
        await one(
          tx,
          "SELECT id FROM ticket_types WHERE id=$1 AND event_id=$2",
          [c.ticket_type_id, c.event_id],
        );
        const p = await one(
          tx,
          "INSERT INTO pricing_phases(ticket_type_id,channel,name,price_cop,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
          [
            c.ticket_type_id,
            c.channel,
            c.name,
            c.price_cop,
            c.starts_at,
            c.ends_at,
          ],
        );
        await audit(tx, a, "phase_created", "pricing_phase", p.id);
        return {};
      }
      case "phase_active": {
        await permit(tx, a, c.event_id, "manage");
        await lockEvent(tx, c.event_id);
        await one(
          tx,
          "SELECT p.id FROM pricing_phases p JOIN ticket_types t ON t.id=p.ticket_type_id WHERE p.id=$1 AND t.event_id=$2",
          [c.phase_id, c.event_id],
        );
        await tx.query("UPDATE pricing_phases SET active=$2 WHERE id=$1", [
          c.phase_id,
          c.active,
        ]);
        await audit(
          tx,
          a,
          "phase_active_changed",
          "pricing_phase",
          c.phase_id,
          { active: c.active },
        );
        return {};
      }
      case "staff": {
        await permit(tx, a, c.event_id, "manage");
        await tx.query(
          "INSERT INTO event_staff(event_id,user_id,role,active) VALUES($1,$2,$3,$4) ON CONFLICT(event_id,user_id,role) DO UPDATE SET active=excluded.active",
          [c.event_id, c.user_id, c.role, c.active],
        );
        await audit(tx, a, "staff_assigned", "event", c.event_id, {
          user_id: c.user_id,
          role: c.role,
          active: c.active,
        });
        return {};
      }
      case "member": {
        if (!(await admin(tx, a))) fail("Solo administrador global", 403);
        if (c.active)
          await tx.query(
            "INSERT INTO organization_members VALUES($1,$2,'organizer') ON CONFLICT DO NOTHING",
            [c.organization_id, c.user_id],
          );
        else
          await tx.query(
            "DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2",
            [c.organization_id, c.user_id],
          );
        await audit(
          tx,
          a,
          "organization_membership",
          "organization",
          c.organization_id,
          { user_id: c.user_id, active: c.active },
        );
        return {};
      }
      case "reserve":
      case "sell":
        return createOrder(tx, a, c);
      case "checkin":
      case "manual_checkin":
        return checkin(tx, a, c);
      case "demo_payment": {
        if (!demoMode()) fail("Pago simulado deshabilitado", 403);
        const o = await orderPermit(tx, a, c.order_id);
        return settle(tx, {
          orderId: o.id,
          transactionId: `DEMO-${o.id}`,
          amount: o.total_cop * 100,
          currency: "COP",
          status: "APPROVED",
        });
      }
      case "checkout": {
        const o = await orderPermit(tx, a, c.order_id);
        if (
          o.status !== "pending_payment" ||
          new Date(o.reservation_expires_at).getTime() <= Date.now()
        )
          fail("La reserva ya no está vigente");
        const { checkout } = await import("./wompi");
        return checkout(o);
      }
      case "reconcile": {
        const o = await orderPermit(tx, a, c.order_id, true);
        const { transaction } = await import("./wompi");
        const p = await transaction(c.transaction_id);
        if (p.reference !== `PC-${o.id}`) fail("Referencia incorrecta");
        const result = await settle(tx, {
          orderId: o.id,
          transactionId: p.id,
          amount: p.amount_in_cents,
          currency: p.currency,
          status: p.status,
        });
        await audit(tx, a, "payment_reconciled", "order", o.id);
        return result;
      }
      case "cash_open": {
        await permit(tx, a, c.event_id, "sell");
        await lockEvent(tx, c.event_id);
        const s = await one(
          tx,
          "INSERT INTO cash_sessions(event_id,operator_id,opening_cash_cop) VALUES($1,$2,$3) RETURNING id",
          [c.event_id, a.id, c.opening_cash_cop],
        );
        await audit(tx, a, "cash_opened", "cash_session", s.id);
        return {};
      }
      case "cash_move":
      case "cash_close": {
        await permit(tx, a, c.event_id, "sell");
        await lockEvent(tx, c.event_id);
        const s = await one(
          tx,
          "SELECT * FROM cash_sessions WHERE id=$1 AND event_id=$2 AND operator_id=$3 AND closed_at IS NULL FOR UPDATE",
          [c.session_id, c.event_id, a.id],
        );
        if (c.action === "cash_move") {
          await tx.query(
            "INSERT INTO cash_movements(cash_session_id,type,amount_cop,reason,created_by) VALUES($1,$2,$3,$4,$5)",
            [s.id, c.type, c.amount_cop, c.reason, a.id],
          );
          await audit(tx, a, "cash_movement", "cash_session", s.id, {
            type: c.type,
            amount: c.amount_cop,
          });
          return {};
        }
        const sums = await one(
          tx,
          "SELECT coalesce(sum(CASE WHEN type IN ('out','refund') THEN -amount_cop ELSE amount_cop END),0)::int AS amount FROM cash_movements WHERE cash_session_id=$1",
          [s.id],
        );
        const expected = s.opening_cash_cop + sums.amount;
        await tx.query(
          "UPDATE cash_sessions SET closed_at=now(),declared_cash_cop=$2,expected_cash_cop=$3,difference_cop=$2::int-$3::int,notes=$4 WHERE id=$1",
          [s.id, c.declared_cash_cop, expected, c.notes],
        );
        await audit(tx, a, "cash_closed", "cash_session", s.id, {
          expected,
          declared: c.declared_cash_cop,
        });
        return { expected, difference: c.declared_cash_cop - expected };
      }
      case "cancel_ticket":
      case "replace_ticket": {
        const initial = await one(tx, "SELECT * FROM tickets WHERE id=$1", [
          c.ticket_id,
        ]);
        await permit(tx, a, initial.event_id, "manage");
        await lockEvent(tx, initial.event_id);
        const t = await one(
          tx,
          "SELECT * FROM tickets WHERE id=$1 FOR UPDATE",
          [c.ticket_id],
        );
        if (t.status !== "valid") fail("Solo se modifica una entrada vigente");
        if (c.action === "cancel_ticket")
          await tx.query("UPDATE tickets SET status='cancelled' WHERE id=$1", [
            t.id,
          ]);
        else {
          const v = token();
          await tx.query(
            "UPDATE tickets SET credential_hash=$2,credential_encrypted=$3,credential_version=credential_version+1 WHERE id=$1",
            [t.id, hash(v), encrypt(v)],
          );
        }
        await audit(tx, a, c.action, "ticket", t.id, { reason: c.reason });
        return {};
      }
      case "refund": {
        const o = await orderPermit(tx, a, c.order_id, true);
        await lockEvent(tx, o.event_id);
        const locked = await one(
          tx,
          "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
          [o.id],
        );
        if (
          !["confirmed", "partially_refunded", "needs_review"].includes(
            locked.status,
          )
        )
          fail("Orden no reembolsable");
        const payment = await one(
          tx,
          "SELECT * FROM payments WHERE order_id=$1 AND status='approved'",
          [o.id],
        );
        const prev = await one(
          tx,
          "SELECT coalesce(sum(amount_cop),0)::int AS amount FROM refunds WHERE order_id=$1",
          [o.id],
        );
        if (c.amount_cop + prev.amount > o.total_cop)
          fail("Devolución supera el cobro");
        if (
          !c.ticket_ids.length &&
          !["needs_review", "partially_refunded"].includes(locked.status)
        )
          fail("Selecciona las entradas afectadas");
        if (
          !c.ticket_ids.length &&
          (
            await tx.query(
              "SELECT 1 FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=$1",
              [o.id],
            )
          ).rows.length
        )
          fail("Selecciona las entradas afectadas");
        const selected = (
          await tx.query(
            "SELECT t.* FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=$1 AND t.id=ANY($2::uuid[]) AND t.refund_id IS NULL FOR UPDATE OF t",
            [o.id, c.ticket_ids],
          )
        ).rows;
        if (selected.length !== new Set(c.ticket_ids).size)
          fail("Entradas ajenas o ya reembolsadas");
        if (selected.some((t) => t.status === "used"))
          fail("Entrada utilizada: resolver fuera del flujo básico");
        const r = await one(
          tx,
          "INSERT INTO refunds(order_id,payment_id,amount_cop,status,reason,external_reference,created_by) VALUES($1,$2,$3,'completed',$4,$5,$6) RETURNING id",
          [
            o.id,
            payment.id,
            c.amount_cop,
            c.reason,
            c.external_reference,
            a.id,
          ],
        );
        await tx.query(
          "UPDATE tickets SET status='cancelled',refund_id=$2 WHERE id=ANY($1::uuid[])",
          [c.ticket_ids, r.id],
        );
        if (payment.method === "cash" && c.amount_cop > 0) {
          const session = (
            await tx.query(
              "SELECT id FROM cash_sessions WHERE event_id=$1 AND closed_at IS NULL AND (id=$2 OR operator_id=$3) ORDER BY (id=$2) DESC LIMIT 1 FOR UPDATE",
              [o.event_id, payment.cash_session_id, a.id],
            )
          ).rows[0];
          if (!session)
            fail(
              "Abre una caja para registrar la salida de efectivo de la devolución",
            );
          await tx.query(
            "INSERT INTO cash_movements(cash_session_id,type,amount_cop,reason,created_by) VALUES($1,'refund',$2,$3,$4)",
            [session.id, c.amount_cop, `Devolución ${r.id}`, a.id],
          );
        }
        await tx.query("UPDATE orders SET status=$2 WHERE id=$1", [
          o.id,
          c.amount_cop + prev.amount === o.total_cop
            ? "refunded"
            : "partially_refunded",
        ]);
        await audit(tx, a, "manual_refund_recorded", "refund", r.id, {
          amount: c.amount_cop,
          ticket_ids: c.ticket_ids,
        });
        return {};
      }
      case "resend":
      case "revoke_share": {
        const o = await orderPermit(tx, a, c.order_id);
        if (!["confirmed", "partially_refunded", "refunded"].includes(o.status))
          fail("Orden sin entradas emitidas");
        if (c.action === "revoke_share") {
          const t = token();
          await tx.query(
            "UPDATE orders SET share_hash=$2,share_encrypted=$3 WHERE id=$1",
            [o.id, hash(t), encrypt(t)],
          );
        } else {
          if (!o.buyer_email) fail("La orden no tiene email");
          await tx.query("INSERT INTO delivery_jobs(order_id) VALUES($1)", [
            o.id,
          ]);
        }
        await audit(tx, a, c.action, "order", o.id);
        return {};
      }
      case "print_request": {
        const t = await one(tx, "SELECT * FROM tickets WHERE id=$1", [
          c.ticket_id,
        ]);
        await permit(tx, a, t.event_id, "sell");
        const prior =
          (
            await tx.query("SELECT 1 FROM print_jobs WHERE ticket_id=$1", [
              t.id,
            ])
          ).rows.length > 0;
        const j = await one(
          tx,
          "INSERT INTO print_jobs(ticket_id,operator_id,status,is_reprint) VALUES($1,$2,'requested',$3) RETURNING id",
          [t.id, a.id, prior],
        );
        await audit(
          tx,
          a,
          prior ? "ticket_reprint" : "ticket_print",
          "ticket",
          t.id,
        );
        return { job_id: j.id };
      }
      case "print_result": {
        const j = await one(
          tx,
          "SELECT * FROM print_jobs WHERE id=$1 AND operator_id=$2 FOR UPDATE",
          [c.job_id, a.id],
        );
        if (j.status === "confirmed" || j.status === "failed")
          fail("Trabajo terminado");
        await tx.query("UPDATE print_jobs SET status=$2 WHERE id=$1", [
          j.id,
          c.status,
        ]);
        await audit(tx, a, "print_result", "print_job", j.id, {
          status: c.status,
        });
        return {};
      }
    }
  });
}
export async function ticketDocument(
  db: DB,
  a: Actor | null,
  orderId: string,
  share?: string,
) {
  return db.transaction(async (tx) => {
    const o = await one(tx, "SELECT * FROM orders WHERE id=$1", [orderId]);
    if (!(share && o.share_hash && hash(share) === o.share_hash)) {
      if (!a) fail("Inicia sesión para ver tus entradas", 401);
      await orderPermit(tx, a, orderId);
    }
    const e = await one(tx, "SELECT * FROM events WHERE id=$1", [o.event_id]);
    const tickets = (
      await tx.query(
        "SELECT t.*,i.type_name FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=$1 ORDER BY t.event_sequence",
        [o.id],
      )
    ).rows.map((t) => ({
      id: t.id,
      visible_number: t.visible_number,
      security_serial: t.security_serial,
      status: t.status,
      type_name: t.type_name,
      credential: `pc:${decrypt(t.credential_encrypted)}`,
    }));
    return {
      order: {
        id: o.id,
        status: o.status,
        total_cop: o.total_cop,
        buyer_name: o.buyer_name,
      },
      event: e,
      tickets,
      share: decrypt(
        o.share_encrypted ?? fail("Las entradas aún no se han emitido", 409),
      ),
    };
  });
}
export async function rateLimit(db: DB, key: string, limit = 60) {
  const r = await one(
    db,
    `INSERT INTO rate_limits(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET requests=CASE WHEN rate_limits.window_start<now()-interval '1 minute' THEN 1 ELSE rate_limits.requests+1 END,window_start=CASE WHEN rate_limits.window_start<now()-interval '1 minute' THEN now() ELSE rate_limits.window_start END RETURNING requests`,
    [key],
  );
  if (r.requests > limit)
    fail("Demasiadas solicitudes. Espera un minuto.", 429);
}
export const newId = () => randomUUID();
