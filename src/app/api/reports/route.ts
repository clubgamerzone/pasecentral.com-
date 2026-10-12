import { database } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { state } from "@/lib/state";
import { csv } from "@/lib/csv";
import { fail } from "@/lib/service";
import { errorResponse } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const a = await requireActor(),
      data = await state(await database(), a);
    if (!data.permissions.manage.length && !data.permissions.admin)
      fail("No autorizado", 403);
    const url = new URL(req.url),
      kind = url.searchParams.get("kind"),
      event = url.searchParams.get("event");
    const tables = {
      sales: data.orders,
      attendees: data.tickets,
      cash: data.sessions,
      incidents: data.orders.filter((o) =>
        ["pending_payment", "expired", "needs_review"].includes(o.status),
      ),
    };
    const rows =
      tables[kind as keyof typeof tables] ?? fail("Reporte inválido");
    const allowed = rows.filter(
      (r) =>
        data.permissions.manage.includes(r.event_id) &&
        (!event || r.event_id === event),
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
