"use client";
import { useEffect, useState } from "react";
import { useApp, money, when, Empty } from "./app";
import type { Row } from "@/lib/db";
import type { analytics } from "@/lib/analytics";
type Result = Awaited<ReturnType<typeof analytics>>;
export const initialAnalyticsFilters = {
  event: "",
  compare: "",
  year: "",
  from: "",
  to: "",
  audience: "active",
};
export type AnalyticsUIFilters = typeof initialAnalyticsFilters;
export function analyticsQuery(f: AnalyticsUIFilters) {
  const p = new URLSearchParams();
  if (f.event)
    p.set(
      "events",
      [f.event, f.compare]
        .filter(Boolean)
        .filter((id, n, all) => all.indexOf(id) === n)
        .join(","),
    );
  for (const key of ["year", "from", "to", "audience"] as const)
    if (f[key]) p.set(key, f[key]);
  return p.toString();
}
type Column = {
  key: string;
  label: string;
  format?: "money" | "percent" | "date";
};
function AnalyticsTable({
  title,
  description,
  rows,
  columns,
  query,
  report,
}: {
  title: string;
  description?: string;
  rows: Row[];
  columns: Column[];
  query: string;
  report: string;
}) {
  return (
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-head">
        <h2>{title}</h2>
        <a
          className="btn small"
          href={`/api/analytics?${query}&format=csv&report=${report}`}
        >
          Descargar CSV
        </a>
      </div>
      {description && (
        <p className="helper" style={{ margin: "12px 0" }}>
          {description}
        </p>
      )}
      {!rows.length ? (
        <Empty>Aún no hay datos para estos filtros.</Empty>
      ) : (
        <div className="table-wrap analytics-table">
          <table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={r.key ?? n}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {r[c.key] == null
                        ? "—"
                        : c.format === "money"
                          ? money(r[c.key])
                          : c.format === "percent"
                            ? `${r[c.key]}%`
                            : c.format === "date"
                              ? when(r[c.key])
                              : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function DemographicBars({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Result["gender"];
  total: number;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {!total ? (
        <Empty>No hay entradas incluidas para analizar.</Empty>
      ) : (
        <div style={{ marginTop: 18 }}>
          {rows.map((r) => (
            <div className="analytics-bar-row" key={r.key}>
              <div>
                <span>{r.label}</span>
                <b>
                  {r.count} · {r.percent}%
                </b>
              </div>
              <div className="analytics-bar-track">
                <span style={{ width: `${r.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export function AnalyticsPanel({
  filters,
  onChange,
}: {
  filters: AnalyticsUIFilters;
  onChange: (f: AnalyticsUIFilters) => void;
}) {
  const { data, refresh } = useApp();
  const [epoch, setEpoch] = useState(0),
    [rank, setRank] = useState<"quantity" | "net_cop" | "used">("quantity"),
    [global, setGlobal] = useState(false);
  const query = analyticsQuery(filters),
    key = `${query}|${epoch}`;
  const [response, setResponse] = useState<{
    key: string;
    data: Result | null;
    error: string | null;
  }>({ key: "", data: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/analytics?${query}`, {
            signal: controller.signal,
            cache: "no-store",
          }),
          body = await res.json();
        if (!res.ok)
          throw new Error(
            body.error || "No se pudieron consultar los análisis",
          );
        if (!controller.signal.aborted)
          setResponse({ key, data: body, error: null });
      } catch (e) {
        if (!controller.signal.aborted)
          setResponse({ key, data: null, error: (e as Error).message });
      }
    })();
    return () => controller.abort();
  }, [query, key]);
  const managed = data.events.filter((e) =>
    data.permissions.manage.includes(e.id),
  );
  const eventYear = (e: Row) =>
    new Date(e.starts_at).toLocaleDateString("sv-SE", {
      timeZone: "America/Bogota",
      year: "numeric",
    });
  const years = [...new Set(managed.map(eventYear))].sort().reverse(),
    options = managed.filter(
      (e) => !filters.year || eventYear(e) === filters.year,
    );
  const update = (field: keyof AnalyticsUIFilters, value: string) =>
    onChange({
      ...filters,
      [field]: value,
      ...(field === "year"
        ? { event: "", compare: "" }
        : field === "event"
          ? { compare: "" }
          : {}),
    });
  const loaded = response.key === key,
    r = loaded ? response.data : null;
  const columns: Column[] = [
    { key: "label", label: "Nombre" },
    { key: "orders", label: "Órdenes con cobro" },
    { key: "quantity", label: "Entradas vendidas" },
    { key: "complimentary", label: "Cortesías" },
    { key: "gross_cop", label: "Ventas brutas", format: "money" },
    { key: "refunds_cop", label: "Devoluciones registradas", format: "money" },
    { key: "net_cop", label: "Ventas menos devoluciones", format: "money" },
  ];
  const lineColumns: Column[] = [
    { key: "label", label: "Nombre" },
    { key: "event", label: "Evento" },
    { key: "channel", label: "Canal" },
    { key: "quantity", label: "Vendidas (histórico)" },
    { key: "active_tickets", label: "Vigentes" },
    { key: "gross_cop", label: "Importe de entradas", format: "money" },
  ];
  const events = r
    ? [...r.events].sort(
        (a, b) =>
          Number(b[rank]) - Number(a[rank]) ||
          a.label.localeCompare(b.label, "es"),
      )
    : [];
  const s = r?.summary;
  return (
    <>
      <section className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head">
          <h2>Análisis de ventas y audiencia</h2>
          <button
            className="btn"
            onClick={() => {
              setEpoch((v) => v + 1);
              void refresh();
            }}
          >
            Actualizar análisis
          </button>
        </div>
        <div className="form-grid" style={{ marginTop: 20 }}>
          <label className="field">
            <span>Año del evento</span>
            <select
              aria-label="Año del evento"
              value={filters.year}
              onChange={(ev) => update("year", ev.target.value)}
            >
              <option value="">Todos los años</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Evento para análisis</span>
            <select
              aria-label="Evento para análisis"
              value={filters.event}
              onChange={(ev) => update("event", ev.target.value)}
            >
              <option value="">Todos los eventos</option>
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Comparar con otro evento</span>
            <select
              aria-label="Comparar con otro evento"
              disabled={!filters.event}
              value={filters.compare}
              onChange={(ev) => update("compare", ev.target.value)}
            >
              <option value="">Sin comparación adicional</option>
              {options
                .filter((e) => e.id !== filters.event)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Ventas desde</span>
            <input
              type="date"
              value={filters.from}
              onChange={(ev) => update("from", ev.target.value)}
            />
          </label>
          <label className="field">
            <span>Ventas hasta</span>
            <input
              type="date"
              value={filters.to}
              onChange={(ev) => update("to", ev.target.value)}
            />
          </label>
          <label className="field">
            <span>Audiencia que se analiza</span>
            <select
              aria-label="Audiencia que se analiza"
              value={filters.audience}
              onChange={(ev) => update("audience", ev.target.value)}
            >
              <option value="active">Entradas vigentes</option>
              <option value="used">Personas con ingreso registrado</option>
            </select>
          </label>
        </div>
        <div className="buttons" style={{ marginTop: 16 }}>
          <button
            className="btn"
            onClick={() => onChange({ ...initialAnalyticsFilters })}
          >
            Restablecer filtros
          </button>
          <a
            className="btn"
            href={`/api/analytics?${query}&format=csv&report=summary`}
          >
            Descargar resumen CSV
          </a>
        </div>
        <p className="helper" style={{ marginTop: 16 }}>
          Año según la fecha del evento. Ventas según su confirmación, en hora
          de Colombia. Los cupos muestran disponibilidad actual. Devoluciones
          corresponden a las órdenes de venta incluidas; no es utilidad ni
          conciliación bancaria.
        </p>
      </section>
      {!loaded ? (
        <p role="status">Cargando análisis del servidor…</p>
      ) : response.error ? (
        <div role="alert" className="notice">
          {response.error}
        </div>
      ) : r && s ? (
        <>
          {data.environment !== "production" && (
            <div className="notice" style={{ marginBottom: 20 }}>
              Wompi está en modo de pruebas. Estos indicadores usan únicamente
              registros guardados en el servidor.
            </div>
          )}
          <div className="metrics analytics-metrics">
            {[
              [
                "Ventas brutas",
                money(s.gross_cop),
                `${s.paid_orders} órdenes con cobro`,
              ],
              [
                "Ventas menos devoluciones",
                money(s.net_cop),
                `${money(s.refunds_cop)} en devoluciones registradas`,
              ],
              [
                "Entradas vendidas",
                s.sold_tickets,
                `${s.complimentary_tickets} cortesías · ${s.cancelled_tickets} anuladas`,
              ],
              [
                "Cobros aprobados",
                money(s.approved_cop),
                "Por fecha de aprobación; no es depósito bancario",
              ],
              [
                "Valor promedio por orden",
                money(s.average_order_cop),
                `${s.tickets_per_order} entradas por orden con cobro`,
              ],
              [
                "Ingresos registrados",
                s.used,
                `${s.attendance_percent}% sobre vigentes o con ingreso`,
              ],
              [
                "Disponibles ahora",
                s.available,
                `${s.events} eventos seleccionados`,
              ],
              [
                "Reservas vigentes",
                s.pending_orders,
                `${s.pending_tickets} entradas reservadas`,
              ],
              [
                "Órdenes web confirmadas",
                `${s.web_confirmation_percent}%`,
                "Proporción de las órdenes web del filtro",
              ],
              [
                "Incidencias de pago",
                s.review_orders,
                `${s.expired_orders} vencidas · ${s.cancelled_orders} canceladas`,
              ],
              [
                "Compradores con cuenta",
                s.registered_buyers,
                `${s.unlinked_orders} órdenes sin cuenta vinculada`,
              ],
              [
                "Diferencias de caja",
                money(s.cash_difference_cop),
                `${s.closed_cash_sessions} cierres en el período`,
              ],
            ].map(([label, value, note]) => (
              <article className="metric" key={label}>
                <div className="metric-top">{label}</div>
                <strong>{value}</strong>
                <small>{note}</small>
              </article>
            ))}
          </div>
          <section className="panel" style={{ marginTop: 22 }}>
            <div className="panel-head">
              <h2>Comparativa y ranking de eventos</h2>
              <label className="field">
                <span>Ordenar eventos por</span>
                <select
                  aria-label="Ordenar eventos por"
                  value={rank}
                  onChange={(ev) =>
                    setRank(ev.target.value as "quantity" | "net_cop" | "used")
                  }
                >
                  <option value="quantity">Más entradas vendidas</option>
                  <option value="net_cop">Más ventas menos devoluciones</option>
                  <option value="used">Más ingresos registrados</option>
                </select>
              </label>
            </div>
            {events.some((e) => e.quantity > 0) && (
              <p className="notice" style={{ marginTop: 12 }}>
                Mayor venta en entradas:{" "}
                {r.events
                  .filter((e) => e.quantity === r.events[0].quantity)
                  .map((e) => e.label)
                  .join(" / ")}{" "}
                · {r.events[0].quantity} entradas por evento.
              </p>
            )}
            <AnalyticsTable
              title="Resultados por evento"
              rows={events}
              columns={[
                { key: "label", label: "Evento" },
                { key: "year", label: "Año" },
                { key: "quantity", label: "Vendidas" },
                { key: "complimentary", label: "Cortesías" },
                {
                  key: "net_cop",
                  label: "Ventas menos devoluciones",
                  format: "money",
                },
                { key: "used", label: "Ingresos" },
                { key: "capacity", label: "Aforo" },
                { key: "available", label: "Disponibles ahora" },
                {
                  key: "occupancy",
                  label: "Cupo comprometido",
                  format: "percent",
                },
              ]}
              query={query}
              report="events"
            />
          </section>
          <AnalyticsTable
            title="Comparativa por año del evento"
            description="Variación frente al año anterior solo cuando existe una base de ventas mayor a cero."
            rows={r.years}
            columns={[
              { key: "label", label: "Año" },
              ...columns.slice(1),
              { key: "events", label: "Eventos" },
              {
                key: "change_percent",
                label: "Variación interanual",
                format: "percent",
              },
            ]}
            query={query}
            report="years"
          />
          <div className="filterbar" style={{ marginTop: 22 }}>
            <h2>Localidades y fases que más venden</h2>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={global}
                onChange={(ev) => setGlobal(ev.target.checked)}
              />
              Consolidar nombres iguales entre eventos
            </label>
          </div>
          <AnalyticsTable
            title="Ventas por fase"
            description="Entradas con cobro; cortesías aparte. Usa precios y nombres guardados en cada compra. Al consolidar, se agrupan nombres iguales por canal, aunque sus precios puedan variar."
            rows={global ? r.global_phases : r.phases}
            columns={lineColumns}
            query={query}
            report={global ? "global_phases" : "phases"}
          />
          <AnalyticsTable
            title="Ventas por localidad"
            rows={global ? r.global_types : r.types}
            columns={lineColumns.filter((c) => c.key !== "channel")}
            query={query}
            report={global ? "global_types" : "types"}
          />
          <AnalyticsTable
            title="Ventas por canal"
            rows={r.channels}
            columns={columns}
            query={query}
            report="channels"
          />
          <AnalyticsTable
            title="Ventas por operador"
            description="La venta online se agrupa como canal; el comprador no se cuenta como vendedor."
            rows={r.operators}
            columns={columns}
            query={query}
            report="operators"
          />
          <AnalyticsTable
            title="Cobros por medio de pago"
            description="Online Wompi agrupa el checkout; el medio online específico (Nequi, tarjeta, etc.) todavía no se guarda en estos registros."
            rows={r.payments}
            columns={[
              { key: "label", label: "Medio" },
              { key: "payments", label: "Pagos aprobados" },
              { key: "amount_cop", label: "Importe aprobado", format: "money" },
            ]}
            query={query}
            report="payments"
          />
          <AnalyticsTable
            title="Evolución diaria de ventas"
            description="Días con confirmaciones en hora de Colombia; no se usa la fecha inicial de la reserva."
            rows={r.timeline}
            columns={[{ key: "label", label: "Fecha" }, ...columns.slice(1)]}
            query={query}
            report="timeline"
          />
          <AnalyticsTable
            title="Ventas por categoría de comprador"
            rows={r.categories}
            columns={columns}
            query={query}
            report="categories"
          />
          <section className="panel" style={{ marginTop: 22 }}>
            <h2>Composición del público</h2>
            <p style={{ margin: "14px 0" }}>
              {s.population} entradas incluidas · género informado en{" "}
              {s.gender_provided} · edad informada en {s.age_provided}.
            </p>
            <p className="helper">
              Datos voluntarios de cada asistente, no del comprador de toda la
              orden. Género y edad son variables distintas. Sin dato no
              significa que no haya mujeres, hombres o menores. Las entradas
              anteriores sin información aparecen como Sin dato.
            </p>
            <div className="buttons" style={{ marginTop: 14 }}>
              <a
                className="btn"
                href={`/api/analytics?${query}&format=csv&report=gender`}
              >
                CSV por género
              </a>
              <a
                className="btn"
                href={`/api/analytics?${query}&format=csv&report=ages`}
              >
                CSV por edad
              </a>
            </div>
            <p style={{ marginTop: 16 }}>
              0–12 años declarados: <b>{s.children}</b> · 13–17 años declarados:{" "}
              <b>{s.teenagers}</b>. El modo de ingreso registrado incluye
              entradas que ingresaron aunque fueran anuladas después.
            </p>
          </section>
          <div className="report-grid" style={{ marginTop: 22 }}>
            <DemographicBars
              title="Género declarado por entrada"
              rows={r.gender}
              total={s.population}
            />
            <DemographicBars
              title="Rangos de edad declarados"
              rows={r.ages}
              total={s.population}
            />
          </div>
          <section className="panel" style={{ marginTop: 22 }}>
            <h2>Lecturas de acceso en el período</h2>
            {!r.rejections.length ? (
              <Empty>Aún no hay lecturas para estos filtros.</Empty>
            ) : (
              r.rejections.map((row) => (
                <div className="summary-line" key={row.key}>
                  <span>
                    {(
                      {
                        accepted: "Ingreso aceptado",
                        pending_transfer: "Entrega pendiente de aceptación",
                        already_used: "Entrada ya utilizada",
                        cancelled: "Entrada anulada",
                        wrong_event: "Otro evento",
                        outside_admission_window:
                          "Fuera del horario de ingreso",
                        unknown_ticket: "QR desconocido",
                        unauthorized: "Sin autorización",
                      } as Record<string, string>
                    )[row.key] ?? row.key}
                  </span>
                  <b>{row.count}</b>
                </div>
              ))
            )}
          </section>
          <p className="helper" style={{ marginTop: 20 }}>
            Actualizado: {when(r.generated_at)}. Los filtros de venta delimitan
            las entradas usadas para audiencia; las lecturas y cierres se
            filtran por su propia fecha.
          </p>
        </>
      ) : null}
    </>
  );
}
