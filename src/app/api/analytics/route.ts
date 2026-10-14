import { database } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { analytics, parseAnalyticsFilters } from "@/lib/analytics";
import { csv } from "@/lib/csv";
import { errorResponse } from "@/lib/http";
import { fail } from "@/lib/service";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const url = new URL(req.url),
      data = await analytics(
        await database(),
        await requireActor(),
        parseAnalyticsFilters(url),
      );
    if (url.searchParams.get("format") === "csv") {
      const reports = {
        events: data.events,
        years: data.years,
        phases: data.phases,
        global_phases: data.global_phases,
        types: data.types,
        global_types: data.global_types,
        channels: data.channels,
        operators: data.operators,
        gender: data.gender,
        ages: data.ages,
        timeline: data.timeline,
        payments: data.payments,
        categories: data.categories,
        summary: [data.summary],
      };
      const kind = url.searchParams.get("report") ?? "events";
      if (!Object.hasOwn(reports, kind)) fail("Reporte de análisis inválido");
      const rows = reports[kind as keyof typeof reports];
      const common = {
        label: "Nombre",
        orders: "Órdenes con cobro",
        quantity: "Entradas vendidas",
        active_tickets: "Entradas vigentes",
        complimentary: "Cortesías",
        gross_cop: "Ventas brutas COP",
        refunds_cop: "Devoluciones registradas COP",
        net_cop: "Ventas menos devoluciones COP",
        used: "Ingresos registrados",
      };
      const lines = {
        label: "Nombre",
        event: "Evento",
        channel: "Canal",
        quantity: "Vendidas histórico",
        active_tickets: "Vigentes",
        gross_cop: "Importe de entradas COP",
      };
      const columns: Record<string, string> =
        kind === "summary"
          ? {
              events: "Eventos",
              paid_orders: "Órdenes con cobro",
              sold_tickets: "Entradas vendidas",
              complimentary_tickets: "Cortesías",
              active_tickets: "Vigentes",
              cancelled_tickets: "Anuladas",
              gross_cop: "Ventas brutas COP",
              refunds_cop: "Devoluciones registradas COP",
              completed_refunds_cop: "Devoluciones completadas COP",
              net_cop: "Ventas menos devoluciones COP",
              approved_cop: "Cobros aprobados COP",
              average_order_cop: "Promedio por orden COP",
              tickets_per_order: "Entradas por orden",
              used: "Ingresos",
              attendance_percent: "Asistencia %",
              available: "Disponibles ahora",
              pending_orders: "Reservas vigentes",
              pending_tickets: "Entradas reservadas",
              expired_orders: "Órdenes vencidas",
              cancelled_orders: "Órdenes canceladas",
              review_orders: "Incidencias de pago",
              web_confirmation_percent: "Confirmación web %",
              registered_buyers: "Compradores con cuenta",
              unlinked_orders: "Órdenes sin cuenta",
              population: "Entradas de la audiencia",
              gender_provided: "Género informado",
              age_provided: "Edad informada",
              children: "Edad 0 a 12 declarada",
              teenagers: "Edad 13 a 17 declarada",
              cash_difference_cop: "Diferencias de caja COP",
              closed_cash_sessions: "Cierres de caja",
            }
          : kind === "gender" || kind === "ages"
            ? { label: "Categoría", count: "Entradas", percent: "Porcentaje %" }
            : kind === "payments"
              ? {
                  label: "Medio",
                  payments: "Pagos aprobados",
                  amount_cop: "Importe aprobado COP",
                }
              : ["phases", "types", "global_phases", "global_types"].includes(
                    kind,
                  )
                ? lines
                : kind === "events"
                  ? {
                      ...common,
                      year: "Año",
                      starts_at: "Inicio UTC",
                      capacity: "Aforo",
                      available: "Disponibles ahora",
                      committed: "Cupo comprometido",
                      occupancy: "Ocupación %",
                    }
                  : kind === "years"
                    ? {
                        ...common,
                        events: "Eventos",
                        change_percent: "Variación interanual %",
                      }
                    : common;
      return new Response(csv(rows, columns), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pasecentral-analisis-${kind}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
