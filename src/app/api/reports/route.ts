import { database } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { state } from "@/lib/state";
import { csv } from "@/lib/csv";
import { fail } from "@/lib/service";
import { errorResponse } from "@/lib/http";
import { parseAnalyticsFilters, bogotaDay } from "@/lib/analytics";
export async function GET(req: Request) {
  try {
    const a = await requireActor(),
      data = await state(await database(), a);
    if (!data.permissions.manage.length && !data.permissions.admin)
      fail("No autorizado", 403);
    const url = new URL(req.url),
      kind = url.searchParams.get("kind"),
      filters = parseAnalyticsFilters(url);
    if (filters.event_ids.some((id) => !data.permissions.manage.includes(id)))
      fail("Evento no autorizado", 403);
    const ids = new Set(
      data.events
        .filter(
          (e) =>
            data.permissions.manage.includes(e.id) &&
            (!filters.event_ids.length || filters.event_ids.includes(e.id)) &&
            (!filters.year ||
              Number(bogotaDay(e.starts_at).slice(0, 4)) === filters.year),
        )
        .map((e) => e.id),
    );
    const inPeriod = (date: string | Date) =>
      (!filters.from || bogotaDay(date) >= filters.from) &&
      (!filters.to || bogotaDay(date) <= filters.to);
    const orders = data.orders.filter(
      (o) => ids.has(o.event_id) && inPeriod(o.confirmed_at ?? o.created_at),
    );
    const orderIds = new Set(orders.map((o) => o.id));
    const tables = {
      sales: orders,
      attendees: data.tickets.filter((t) => orderIds.has(t.order_id)),
      cash: data.sessions.filter(
        (s) => ids.has(s.event_id) && inPeriod(s.closed_at ?? s.opened_at),
      ),
      incidents: orders.filter((o) =>
        ["pending_payment", "expired", "needs_review"].includes(o.status),
      ),
    };
    const rows =
      tables[kind as keyof typeof tables] ?? fail("Reporte inválido");
    const allowed = rows.filter(
      (r) =>
        data.permissions.manage.includes(r.event_id) && ids.has(r.event_id),
    );
    return new Response(csv(allowed), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pasecentral-${kind}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
