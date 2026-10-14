"use client";
import { useId, useState } from "react";
import type { Row } from "@/lib/db";
import { money } from "./app";

export type Tone = "good" | "warning" | "bad" | "neutral";
const palette = [
  "#247a68",
  "#527acc",
  "#9864b5",
  "#d28a35",
  "#36a4ad",
  "#a8687c",
  "#78879a",
];
const value = (row: Row, key: string) => {
  const n = Number(row[key]);
  return Number.isFinite(n) ? n : 0;
};
const number = (n: number) => n.toLocaleString("es-CO");
const color = (row: Row, index: number) =>
  row.key === "unknown" || row.key === "prefer_not_to_say"
    ? "#8b95a3"
    : palette[index % palette.length];
export const signedTone = (n: number): Tone =>
  n < 0 ? "bad" : n > 0 ? "good" : "neutral";
export function StatusTag({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span className={`analytics-status tone-${tone}`}>
      {tone === "good" ? "✓" : tone === "neutral" ? "•" : "!"} {children}
    </span>
  );
}

/** Categories use distinct colors, never a good/bad judgment about people. */
export function DonutChart({
  rows,
  metric = "count",
  label,
  monetary = false,
}: {
  rows: Row[];
  metric?: string;
  label: string;
  monetary?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = rows.reduce(
    (sum, row) => sum + Math.max(0, value(row, metric)),
    0,
  );
  const selected = active == null ? null : rows[active];
  const format = monetary ? money : number;
  return (
    <figure className="analytics-donut" aria-label={label}>
      {total <= 0 ? (
        <p className="analytics-empty">
          Sin datos para representar con estos filtros.
        </p>
      ) : (
        <>
          <div className="donut-picture">
            <svg
              viewBox="0 0 200 200"
              role="img"
              aria-label={`${label}. Total ${format(total)}. Consulta las categorías debajo.`}
            >
              <circle
                cx="100"
                cy="100"
                r="74"
                fill="none"
                stroke="#edf1f4"
                strokeWidth="28"
              />
              {rows.map((row, index) => {
                const part = (Math.max(0, value(row, metric)) / total) * 100;
                const start = rows
                  .slice(0, index)
                  .reduce(
                    (sum, previous) =>
                      sum +
                      (Math.max(0, value(previous, metric)) / total) * 100,
                    0,
                  );
                return (
                  part > 0 && (
                    <circle
                      key={row.key ?? index}
                      cx="100"
                      cy="100"
                      r="74"
                      pathLength="100"
                      fill="none"
                      stroke={color(row, index)}
                      strokeWidth={active === index ? 33 : 28}
                      strokeDasharray={`${part} ${100 - part}`}
                      strokeDashoffset={-start}
                      transform="rotate(-90 100 100)"
                      opacity={active == null || active === index ? 1 : 0.35}
                    >
                      <title>
                        {row.label}: {format(value(row, metric))} (
                        {part.toFixed(1)}%)
                      </title>
                    </circle>
                  )
                );
              })}
            </svg>
            <div className="donut-center" aria-hidden="true">
              <strong className={monetary ? "money-total" : undefined}>
                {format(total)}
              </strong>
              <span>{monetary ? "Importe aprobado" : "Total"}</span>
            </div>
          </div>
          <figcaption className="chart-legend">
            {rows.map((row, index) => (
              <button
                type="button"
                key={row.key ?? index}
                aria-pressed={active === index}
                onClick={() => setActive(active === index ? null : index)}
              >
                <span
                  className="chart-dot"
                  style={{ background: color(row, index) }}
                />
                <span>{row.label}</span>
                <b>
                  {format(value(row, metric))}
                  <small>
                    {((Math.max(0, value(row, metric)) / total) * 100).toFixed(
                      1,
                    )}
                    %
                  </small>
                </b>
              </button>
            ))}
          </figcaption>
          <p className="chart-selection" role="status">
            {selected
              ? `${selected.label}: ${format(value(selected, metric))}`
              : "Toca una categoría para resaltarla."}
          </p>
        </>
      )}
    </figure>
  );
}

export function BarChart({
  rows,
  metric = "quantity",
  label,
  monetary = false,
  signed = false,
}: {
  rows: Row[];
  metric?: string;
  label: string;
  monetary?: boolean;
  signed?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(0, ...rows.map((row) => Math.abs(value(row, metric))));
  const shown = expanded ? rows : rows.slice(0, 8);
  const format = monetary ? money : number;
  return (
    <figure className="analytics-bars" aria-label={label}>
      {!max ? (
        <p className="analytics-empty">
          Sin valores registrados para estos filtros.
        </p>
      ) : (
        <>
          <ul>
            {shown.map((row, index) => {
              const n = value(row, metric);
              const width = (Math.abs(n) / max) * (signed ? 50 : 100);
              return (
                <li key={row.key ?? index}>
                  <div className="chart-bar-label">
                    <span>
                      {row.label}
                      {row.event && (
                        <small>
                          {row.event}
                          {row.channel ? ` · ${row.channel}` : ""}
                        </small>
                      )}
                    </span>
                    <b className={signed ? `tone-${signedTone(n)}` : ""}>
                      {format(n)}
                    </b>
                  </div>
                  <div
                    className={`chart-bar-track${signed ? " signed" : ""}`}
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        width: `${width}%`,
                        left: signed ? `${n < 0 ? 50 - width : 50}%` : 0,
                        background: signed
                          ? n < 0
                            ? "#b83e48"
                            : "#247a68"
                          : color(row, index),
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length > 8 && (
            <button
              className="btn small"
              type="button"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Ver menos" : `Ver las ${rows.length} categorías`}
            </button>
          )}
        </>
      )}
    </figure>
  );
}

export function SalesTimeline({ rows }: { rows: Row[] }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...rows.map((row) => value(row, "gross_cop")));
  const first = rows.length ? Date.parse(rows[0].key) : 0;
  const last = rows.length ? Date.parse(rows[rows.length - 1].key) : 0;
  const x = (row: Row) =>
    first === last
      ? 300
      : 48 + ((Date.parse(row.key) - first) / (last - first)) * 504;
  const y = (row: Row) => 188 - (max ? value(row, "gross_cop") / max : 0) * 150;
  const date = (row: Row) =>
    new Date(`${row.key}T12:00:00Z`).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "America/Bogota",
    });
  const selected = active == null ? null : rows[active];
  return (
    <figure
      className="analytics-timeline"
      aria-label="Gráfico de evolución diaria de ventas"
    >
      {!rows.length ? (
        <p className="analytics-empty">
          Aún no hay ventas confirmadas en este período.
        </p>
      ) : (
        <>
          <svg viewBox="0 0 600 225" role="img" aria-labelledby={id}>
            <title id={id}>
              Ventas brutas por día de confirmación. Máximo {money(max)}.
              Selecciona un punto para consultar su fecha y valor.
            </title>
            {[38, 113, 188].map((level, i) => (
              <g key={level}>
                <line
                  x1="48"
                  x2="552"
                  y1={level}
                  y2={level}
                  stroke="#e3e9ee"
                  strokeDasharray="4 5"
                />
                <text x="45" y={level - 7} fill="#677683" fontSize="11">
                  {money(Math.round(max * (1 - i / 2)))}
                </text>
              </g>
            ))}
            {rows.length > 1 && (
              <polyline
                points={rows.map((row) => `${x(row)},${y(row)}`).join(" ")}
                fill="none"
                stroke="#247a68"
                strokeWidth="3"
              />
            )}
            {rows.map((row, index) => (
              <circle
                key={row.key}
                cx={x(row)}
                cy={y(row)}
                r={active === index ? 7 : 5}
                fill="#247a68"
                stroke="white"
                strokeWidth="2"
                role="button"
                tabIndex={0}
                aria-label={`${date(row)}: ${money(value(row, "gross_cop"))}, ${number(value(row, "quantity"))} entradas`}
                onClick={() => setActive(index)}
                onFocus={() => setActive(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActive(index);
                  }
                }}
              >
                <title>
                  {date(row)}: {money(value(row, "gross_cop"))}
                </title>
              </circle>
            ))}
            <text x="48" y="217" fill="#677683" fontSize="12">
              {date(rows[0])}
            </text>
            {rows.length > 1 && (
              <text
                x="552"
                y="217"
                textAnchor="end"
                fill="#677683"
                fontSize="12"
              >
                {date(rows[rows.length - 1])}
              </text>
            )}
          </svg>
          <figcaption className="chart-selection" role="status">
            {selected
              ? `${date(selected)} · ${money(value(selected, "gross_cop"))} · ${number(value(selected, "quantity"))} entradas vendidas`
              : "Toca un punto para ver sus ventas."}
          </figcaption>
          <p className="helper">
            Puntos en días con confirmaciones. Las líneas unen registros; los
            días intermedios no son valores estimados.
          </p>
        </>
      )}
    </figure>
  );
}
