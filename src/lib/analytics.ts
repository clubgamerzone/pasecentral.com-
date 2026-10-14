import { z } from "zod";
import type { DB, Row } from "./db";
import { admin, fail, type Actor } from "./service";
import { ageBands, genders } from "./demographics";
export const analyticsFilters = z
  .object({
    event_ids: z.array(z.uuid()).max(100).default([]),
    year: z.coerce.number().int().min(1980).max(2200).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    audience: z.enum(["active", "used"]).default("active"),
  })
  .refine((f) => !f.from || !f.to || f.from <= f.to, {
    message: "La fecha inicial no puede ser posterior a la final",
  });
export type AnalyticsFilters = z.infer<typeof analyticsFilters>;
export function parseAnalyticsFilters(url: URL) {
  return analyticsFilters.parse({
    event_ids: (
      url.searchParams.get("events") ??
      url.searchParams.get("event") ??
      ""
    )
      .split(",")
      .filter(Boolean),
    year: url.searchParams.get("year") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    audience: url.searchParams.get("audience") || "active",
  });
}
export function bogotaDay(value: string | Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export type AnalyticsDataset = {
  events: Row[];
  orders: Row[];
  items: Row[];
  tickets: Row[];
  payments: Row[];
  refunds: Row[];
  attempts: Row[];
  people: Row[];
  cash: Row[];
};
const confirmed = (o: Row) =>
  !!o.confirmed_at &&
  ["confirmed", "partially_refunded", "refunded"].includes(o.status);
const inPeriod = (value: string | Date | null, f: AnalyticsFilters) =>
  !!value &&
  (!f.from || bogotaDay(value) >= f.from) &&
  (!f.to || bogotaDay(value) <= f.to);
const sum = (rows: Row[], field: string) =>
  rows.reduce((n, r) => n + Number(r[field] ?? 0), 0);
const percent = (n: number, total: number) =>
  total ? Math.round((n / total) * 1000) / 10 : 0;
function newSalesRow(key: string, label: string) {
  return {
    key,
    label,
    orders: 0,
    quantity: 0,
    active_tickets: 0,
    complimentary: 0,
    gross_cop: 0,
    refunds_cop: 0,
    net_cop: 0,
    used: 0,
  };
}
export function buildAnalytics(
  d: AnalyticsDataset,
  input: unknown = {},
  now = new Date(),
) {
  const f = analyticsFilters.parse(input);
  const events = d.events.filter(
    (e) =>
      (!f.event_ids.length || f.event_ids.includes(e.id)) &&
      (!f.year || Number(bogotaDay(e.starts_at).slice(0, 4)) === f.year),
  );
  const eventById = new Map(events.map((e) => [e.id, e])),
    eventIds = new Set(eventById.keys());
  const allOrders = d.orders.filter((o) => eventIds.has(o.event_id)),
    orders = allOrders.filter((o) =>
      inPeriod(o.confirmed_at ?? o.created_at, f),
    );
  const orderById = new Map(orders.map((o) => [o.id, o])),
    confirmedOrders = orders.filter(confirmed),
    paidOrders = confirmedOrders.filter((o) => o.channel !== "complimentary");
  const allOrderIds = new Set(allOrders.map((o) => o.id));
  const paidIds = new Set(paidOrders.map((o) => o.id)),
    confirmedIds = new Set(confirmedOrders.map((o) => o.id));
  const tickets = d.tickets.filter((t) => confirmedIds.has(t.order_id)),
    paidTickets = tickets.filter((t) => paidIds.has(t.order_id));
  const active = tickets.filter((t) => ["valid", "used"].includes(t.status)),
    admitted = tickets.filter((t) => t.used_at || t.status === "used");
  const admissionDenominator = tickets.filter(
    (t) => ["valid", "used"].includes(t.status) || t.used_at,
  ).length;
  const refunds = d.refunds.filter((r) => paidIds.has(r.order_id));
  function byOrder(rows: Row[]) {
    const index = new Map<string, Row[]>();
    for (const row of rows) {
      const group = index.get(row.order_id) ?? [];
      group.push(row);
      index.set(row.order_id, group);
    }
    return index;
  }
  const ticketsByOrder = byOrder(tickets),
    refundsByOrder = byOrder(refunds);
  const activeByItem = new Map<string, number>();
  for (const t of paidTickets)
    if (["valid", "used"].includes(t.status))
      activeByItem.set(
        t.order_item_id,
        (activeByItem.get(t.order_item_id) ?? 0) + 1,
      );
  const approved = d.payments.filter(
    (p) =>
      p.status === "approved" &&
      allOrderIds.has(p.order_id) &&
      inPeriod(p.verified_at ?? p.created_at, f),
  );
  const pending = orders.filter(
    (o) =>
      o.status === "pending_payment" &&
      new Date(o.reservation_expires_at) > now,
  );
  const web = orders.filter((o) => o.channel === "web");
  const eventRows = events
    .map((e) => {
      const paid = paidOrders.filter((o) => o.event_id === e.id),
        ids = new Set(paid.map((o) => o.id)),
        ownTickets = tickets.filter((t) => t.event_id === e.id);
      const committedIds = new Set(
        allOrders
          .filter(
            (o) =>
              o.event_id === e.id &&
              (["confirmed", "partially_refunded", "refunded"].includes(
                o.status,
              ) ||
                (o.status === "pending_payment" &&
                  new Date(o.reservation_expires_at) > now)),
          )
          .map((o) => o.id),
      );
      const committed = sum(
        d.items.filter((i) => committedIds.has(i.order_id)),
        "quantity",
      );
      const gross = sum(paid, "total_cop"),
        ref = sum(
          refunds.filter((r) => ids.has(r.order_id)),
          "amount_cop",
        );
      return {
        ...newSalesRow(e.id, e.title),
        event_id: e.id,
        year: Number(bogotaDay(e.starts_at).slice(0, 4)),
        starts_at: e.starts_at,
        orders: paid.length,
        quantity: paidTickets.filter((t) => t.event_id === e.id).length,
        active_tickets: ownTickets.filter((t) =>
          ["valid", "used"].includes(t.status),
        ).length,
        complimentary: ownTickets.filter((t) => !paidIds.has(t.order_id))
          .length,
        gross_cop: gross,
        refunds_cop: ref,
        net_cop: gross - ref,
        used: ownTickets.filter((t) => t.used_at || t.status === "used").length,
        capacity: e.capacity,
        available: Math.max(0, e.capacity - committed),
        committed,
        occupancy: percent(committed, e.capacity),
      };
    })
    .sort(
      (a, b) =>
        b.quantity - a.quantity ||
        b.net_cop - a.net_cop ||
        a.label.localeCompare(b.label, "es"),
    );
  function orderGroups(key: (o: Row) => string, label: (o: Row) => string) {
    const groups = new Map<string, ReturnType<typeof newSalesRow>>();
    for (const o of confirmedOrders) {
      const k = key(o),
        r = groups.get(k) ?? newSalesRow(k, label(o));
      groups.set(k, r);
      const own = ticketsByOrder.get(o.id) ?? [];
      r.active_tickets += own.filter((t) =>
        ["valid", "used"].includes(t.status),
      ).length;
      r.used += own.filter((t) => t.used_at || t.status === "used").length;
      if (o.channel === "complimentary") r.complimentary += own.length;
      else {
        r.orders++;
        r.quantity += own.length;
        r.gross_cop += o.total_cop;
        r.refunds_cop += sum(refundsByOrder.get(o.id) ?? [], "amount_cop");
        r.net_cop = r.gross_cop - r.refunds_cop;
      }
    }
    return [...groups.values()].sort(
      (a, b) =>
        b.quantity - a.quantity ||
        b.gross_cop - a.gross_cop ||
        a.label.localeCompare(b.label, "es"),
    );
  }
  const channelLabels: Record<string, string> = {
    web: "Online",
    box_office: "Taquilla",
    complimentary: "Cortesías",
  };
  const channels = orderGroups(
    (o) => o.channel,
    (o) => channelLabels[o.channel] ?? o.channel,
  );
  const operators = orderGroups(
    (o) => (o.channel === "web" ? "online" : o.created_by),
    (o) =>
      o.channel === "web"
        ? "Venta online"
        : (d.people.find((p) => p.id === o.created_by)?.name ??
          "Operador sin nombre"),
  );
  const categories = orderGroups(
    (o) => o.buyer_category || "none",
    (o) => o.buyer_category || "Sin categoría",
  );
  const years = orderGroups(
    (o) =>
      String(
        eventById.get(o.event_id)!.starts_at
          ? bogotaDay(eventById.get(o.event_id)!.starts_at).slice(0, 4)
          : "",
      ),
    (o) => bogotaDay(eventById.get(o.event_id)!.starts_at).slice(0, 4),
  ).sort((a, b) => a.key.localeCompare(b.key));
  for (const e of events) {
    const year = bogotaDay(e.starts_at).slice(0, 4);
    if (!years.some((y) => y.key === year)) years.push(newSalesRow(year, year));
  }
  years.sort((a, b) => a.key.localeCompare(b.key));
  const annual = years.map((y) => {
    const previous = years.find((r) => Number(r.key) === Number(y.key) - 1);
    return {
      ...y,
      events: events.filter((e) => bogotaDay(e.starts_at).startsWith(y.key))
        .length,
      change_percent:
        previous && previous.net_cop > 0
          ? Math.round(
              ((y.net_cop - previous.net_cop) / previous.net_cop) * 1000,
            ) / 10
          : null,
    };
  });
  const timeline = orderGroups(
    (o) => bogotaDay(o.confirmed_at),
    (o) => bogotaDay(o.confirmed_at),
  ).sort((a, b) => a.key.localeCompare(b.key));
  function lineGroups(kind: "phases" | "types", global: boolean) {
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        event: string;
        channel: string;
        quantity: number;
        active_tickets: number;
        gross_cop: number;
      }
    >();
    for (const i of d.items.filter((i) => paidIds.has(i.order_id))) {
      const o = orderById.get(i.order_id)!,
        label = kind === "phases" ? i.phase_name : i.type_name;
      const k = global
        ? `${label}|${kind === "phases" ? o.channel : ""}`
        : `${i.event_id}|${kind === "phases" ? i.pricing_phase_id : i.ticket_type_id}|${label}`;
      const r = groups.get(k) ?? {
        key: k,
        label,
        event: global
          ? "Todos los eventos seleccionados"
          : eventById.get(i.event_id)!.title,
        channel: kind === "phases" ? channelLabels[o.channel] : "Todos",
        quantity: 0,
        active_tickets: 0,
        gross_cop: 0,
      };
      r.quantity += i.quantity;
      r.gross_cop += i.line_total_cop;
      r.active_tickets += activeByItem.get(i.id) ?? 0;
      groups.set(k, r);
    }
    return [...groups.values()].sort(
      (a, b) => b.quantity - a.quantity || b.gross_cop - a.gross_cop,
    );
  }
  const population = f.audience === "used" ? admitted : active;
  const gender = [...Object.entries(genders), ["unknown", "Sin dato"]].map(
    ([key, label]) => ({
      key,
      label,
      count: population.filter((t) => (t.gender ?? "unknown") === key).length,
      percent: percent(
        population.filter((t) => (t.gender ?? "unknown") === key).length,
        population.length,
      ),
    }),
  );
  const ages = [...Object.entries(ageBands), ["unknown", "Sin dato"]].map(
    ([key, label]) => ({
      key,
      label,
      count: population.filter((t) => (t.age_band ?? "unknown") === key).length,
      percent: percent(
        population.filter((t) => (t.age_band ?? "unknown") === key).length,
        population.length,
      ),
    }),
  );
  const methods = new Map<
    string,
    { key: string; label: string; payments: number; amount_cop: number }
  >();
  const methodLabels: Record<string, string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    checkout: "Online Wompi",
    complimentary: "Cortesía (sin cobro)",
  };
  for (const p of approved) {
    const r = methods.get(p.method) ?? {
      key: p.method,
      label: methodLabels[p.method] ?? p.method,
      payments: 0,
      amount_cop: 0,
    };
    r.payments++;
    r.amount_cop += p.amount_cop;
    methods.set(p.method, r);
  }
  const usedAttempts = d.attempts.filter(
    (a) => eventIds.has(a.event_id) && inPeriod(a.attempted_at, f),
  );
  const rejections = Object.entries(
    usedAttempts.reduce<Record<string, number>>((out, a) => {
      out[a.result] = (out[a.result] ?? 0) + 1;
      return out;
    }, {}),
  ).map(([key, count]) => ({ key, count }));
  const cash = d.cash.filter(
    (s) => eventIds.has(s.event_id) && s.closed_at && inPeriod(s.closed_at, f),
  );
  const gross = sum(paidOrders, "total_cop"),
    refunded = sum(refunds, "amount_cop");
  return {
    filters: f,
    events: eventRows,
    years: annual,
    timeline,
    channels,
    operators,
    categories,
    phases: lineGroups("phases", false),
    global_phases: lineGroups("phases", true),
    types: lineGroups("types", false),
    global_types: lineGroups("types", true),
    payments: [...methods.values()],
    gender,
    ages,
    rejections,
    summary: {
      events: events.length,
      paid_orders: paidOrders.length,
      sold_tickets: paidTickets.length,
      complimentary_tickets: tickets.length - paidTickets.length,
      active_tickets: active.length,
      cancelled_tickets: tickets.filter((t) => t.status === "cancelled").length,
      gross_cop: gross,
      refunds_cop: refunded,
      completed_refunds_cop: sum(
        refunds.filter((r) => r.status === "completed"),
        "amount_cop",
      ),
      net_cop: gross - refunded,
      approved_cop: sum(approved, "amount_cop"),
      average_order_cop: paidOrders.length
        ? Math.round(gross / paidOrders.length)
        : 0,
      tickets_per_order: paidOrders.length
        ? Math.round((paidTickets.length / paidOrders.length) * 10) / 10
        : 0,
      used: admitted.length,
      attendance_percent: percent(admitted.length, admissionDenominator),
      available: eventRows.reduce((n, e) => n + e.available, 0),
      pending_orders: pending.length,
      pending_tickets: sum(
        d.items.filter((i) => pending.some((o) => o.id === i.order_id)),
        "quantity",
      ),
      expired_orders: orders.filter((o) => o.status === "expired").length,
      cancelled_orders: orders.filter((o) => o.status === "cancelled").length,
      review_orders: orders.filter((o) => o.status === "needs_review").length,
      web_confirmation_percent: percent(
        web.filter(confirmed).length,
        web.length,
      ),
      registered_buyers: new Set(
        paidOrders.filter((o) => o.buyer_user_id).map((o) => o.buyer_user_id),
      ).size,
      unlinked_orders: paidOrders.filter((o) => !o.buyer_user_id).length,
      population: population.length,
      gender_provided: population.filter((t) =>
        ["female", "male", "other"].includes(t.gender),
      ).length,
      age_provided: population.filter((t) => t.age_band).length,
      children: population.filter((t) => ["0_5", "6_12"].includes(t.age_band))
        .length,
      teenagers: population.filter((t) => t.age_band === "13_17").length,
      cash_difference_cop: sum(cash, "difference_cop"),
      closed_cash_sessions: cash.length,
    },
    generated_at: now.toISOString(),
  };
}
export async function analytics(db: DB, a: Actor, input: unknown = {}) {
  const f = analyticsFilters.parse(input);
  return db.transaction(async (tx) => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
      a.id,
    ]);
    const managed = (
      await tx.query(
        "SELECT id,title,starts_at,capacity,status FROM events WHERE app_private.can_event(id,'manage') ORDER BY starts_at",
      )
    ).rows;
    if (
      !(await admin(tx, a)) &&
      !managed.length &&
      !(
        await tx.query("SELECT 1 FROM organization_members WHERE user_id=$1", [
          a.id,
        ])
      ).rows.length
    )
      fail("No tienes permiso para consultar análisis de ventas", 403);
    if (f.event_ids.some((id) => !managed.some((e) => e.id === id)))
      fail(
        "No tienes permiso para analizar alguno de los eventos seleccionados",
        403,
      );
    const ids = managed
      .filter(
        (e) =>
          (!f.event_ids.length || f.event_ids.includes(e.id)) &&
          (!f.year || Number(bogotaDay(e.starts_at).slice(0, 4)) === f.year),
      )
      .map((e) => e.id);
    const orders = (
      await tx.query(
        "SELECT id,event_id,status,channel,total_cop,created_at,confirmed_at,reservation_expires_at,buyer_user_id,created_by,buyer_category FROM orders WHERE event_id=ANY($1::uuid[])",
        [ids],
      )
    ).rows;
    const orderIds = orders.map((o) => o.id);
    const items = (
      await tx.query(
        "SELECT * FROM order_items WHERE order_id=ANY($1::uuid[])",
        [orderIds],
      )
    ).rows;
    const tickets = (
      await tx.query(
        "SELECT t.id,t.event_id,t.order_item_id,t.status,t.used_at,i.order_id,a.gender,a.age_band FROM tickets t JOIN order_items i ON i.id=t.order_item_id LEFT JOIN order_attendees a ON a.id=t.attendee_id WHERE t.event_id=ANY($1::uuid[])",
        [ids],
      )
    ).rows;
    const payments = (
      await tx.query(
        "SELECT order_id,status,amount_cop,method,created_at,verified_at FROM payments WHERE order_id=ANY($1::uuid[])",
        [orderIds],
      )
    ).rows;
    const refunds = (
      await tx.query(
        "SELECT order_id,amount_cop,status,recorded_at,completed_at FROM refunds WHERE order_id=ANY($1::uuid[])",
        [orderIds],
      )
    ).rows;
    const attempts = (
      await tx.query(
        "SELECT event_id,result,attempted_at FROM check_in_attempts WHERE event_id=ANY($1::uuid[])",
        [ids],
      )
    ).rows;
    const people = (
      await tx.query("SELECT id,name FROM profiles WHERE id=ANY($1::uuid[])", [
        orders.filter((o) => o.channel !== "web").map((o) => o.created_by),
      ])
    ).rows;
    const cash = (
      await tx.query(
        "SELECT event_id,closed_at,difference_cop FROM cash_sessions WHERE event_id=ANY($1::uuid[])",
        [ids],
      )
    ).rows;
    return buildAnalytics(
      {
        events: managed,
        orders,
        items,
        tickets,
        payments,
        refunds,
        attempts,
        people,
        cash,
      },
      f,
    );
  });
}
