"use client";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_PRINT_SETTINGS,
  PAPER_SIZES,
  PRINT_SETTINGS_KEY,
  LEGACY_PRINT_SETTINGS_KEY,
  upgradeLegacyPrintSettings,
  paperPreset,
  parsePrintSettings,
  type PaperSize,
  type PrintSettings,
} from "@/lib/print-settings";
import type { Row } from "@/lib/db";
import { ticketCounter } from "@/lib/ticket-number";

let temporarySettings: string | null = null;
function readSettings() {
  if (temporarySettings !== null) return temporarySettings;
  try {
    const current = localStorage.getItem(PRINT_SETTINGS_KEY);
    if (current) return current;
    const legacy = localStorage.getItem(LEGACY_PRINT_SETTINGS_KEY);
    return legacy ? upgradeLegacyPrintSettings(legacy) : "";
  } catch {
    return "";
  }
}
function subscribeSettings(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("pasecentral-print-settings", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("pasecentral-print-settings", callback);
  };
}
export function usePrintSettings() {
  const stored = useSyncExternalStore(
    subscribeSettings,
    readSettings,
    () => "",
  );
  let settings = DEFAULT_PRINT_SETTINGS;
  try {
    if (stored) settings = parsePrintSettings(JSON.parse(stored));
  } catch {
    /* Ignore invalid saved preferences. */
  }
  function update(next: PrintSettings) {
    const valid = parsePrintSettings(next);
    try {
      localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(valid));
      temporarySettings = null;
    } catch {
      temporarySettings = JSON.stringify(valid);
    }
    window.dispatchEvent(new Event("pasecentral-print-settings"));
  }
  return [settings, update] as const;
}

export function PrintOptions({
  settings,
  update,
  disabled,
}: {
  settings: PrintSettings;
  update: (next: PrintSettings) => void;
  disabled: boolean;
}) {
  const labelPaper = settings.paper !== "receipt80";
  return (
    <section
      className="panel no-print"
      aria-label="Configuración de impresión"
      style={{ marginBottom: 20 }}
    >
      <h3>Papel e impresora</h3>
      <label htmlFor="print-paper">Tamaño del papel</label>
      <select
        id="print-paper"
        value={settings.paper}
        disabled={disabled}
        onChange={(e) => update(paperPreset(e.target.value as PaperSize))}
      >
        {Object.entries(PAPER_SIZES).map(([key, value]) => (
          <option key={key} value={key}>
            {value.label}
          </option>
        ))}
      </select>
      <p className="helper">
        Se recuerda en este navegador de taquilla. Cambiar de papel carga sus
        ajustes iniciales; no modifica la identidad de tus entradas.
      </p>
      {settings.paper === "ticket70x40" && (
        <p className="notice">
          Una entrada ocupa dos tramos consecutivos de 70 × 40 mm (70 × 80 mm en
          total). El QR y el precio quedan en el talón superior; la parte
          inferior es para el comprador. Ajuste probado en TEST-019: oscuridad
          26, velocidad 50,8 mm/s, marca negra y desplazamiento +4 mm mediante
          impresión ZPL directa.
        </p>
      )}
      {labelPaper && (
        <>
          <p className="helper">
            STARPOS IF4 · transferencia térmica con ribbon · 203 dpi. Coloca la
            cara imprimible hacia el cabezal.
          </p>
          <div className="notice">
            <strong>Si imprimes desde Chrome:</strong> selecciona en Windows el
            papel de 70 × {PAPER_SIZES[settings.paper].height} mm, escala 100 %,
            márgenes Ninguno y sin encabezados ni pies. Para esta cartulina con
            marcas negras, configura Material → Tipo de medio → No continuo,
            Sensor de marcas. El ajuste superior del controlador debe quedar en
            0 mm; el desplazamiento se aplica desde esta página. La selección de
            detección y oscuridad de abajo solo configura QZ Tray, no Windows.
          </div>
          {settings.paper === "ticket70x100" && (
            <div className="notice">
              Formato preparado para el papel grande. Debes calibrarlo y
              probarlo con ese material antes de vender.
            </div>
          )}
          <details>
            <summary>Alineación y material</summary>
            <label htmlFor="print-tracking">Detección del papel</label>
            <select
              id="print-tracking"
              value={settings.tracking}
              disabled={disabled}
              onChange={(e) =>
                update({
                  ...settings,
                  tracking: e.target.value as PrintSettings["tracking"],
                })
              }
            >
              <option value="black_mark">Marca negra debajo del papel</option>
              <option value="gap">Separación entre etiquetas</option>
              <option value="continuous">Continuo, sin marcas</option>
            </select>
            <label htmlFor="print-top">
              Ajuste vertical (mm; positivo baja el diseño)
            </label>
            <select
              id="print-top"
              value={settings.topMm}
              disabled={disabled}
              onChange={(e) =>
                update({ ...settings, topMm: Number(e.target.value) })
              }
            >
              {Array.from({ length: 11 }, (_, i) => i - 5).map((n) => (
                <option key={n} value={n}>
                  {n > 0 ? "+" : ""}
                  {n} mm
                </option>
              ))}
            </select>
            <label htmlFor="print-darkness">Oscuridad</label>
            <select
              id="print-darkness"
              value={settings.darkness}
              disabled={disabled}
              onChange={(e) =>
                update({ ...settings, darkness: Number(e.target.value) })
              }
            >
              {Array.from({ length: 26 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="helper">
              Velocidad: 50,8 mm/s. Detección y oscuridad se aplican en QZ Tray.
              Con el diálogo del navegador configura también el tamaño, escala
              100 % y márgenes del controlador. Al cambiar de material, calibra
              la impresora.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

export function PaperTickets({
  tickets,
  event,
  settings,
  printable = true,
  printTickets = tickets,
  selectedIds,
  onToggle,
  selectionDisabled = false,
  onManage,
}: {
  tickets: Row[];
  event: Row;
  settings: PrintSettings;
  printable?: boolean;
  printTickets?: Row[];
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  selectionDisabled?: boolean;
  onManage?: (ticket: Row, operation: "deactivate" | "delete") => void;
}) {
  const compact = settings.paper === "ticket70x40";
  const width = settings.paper === "receipt80" ? 80 : 70;
  const height = compact ? 80 : settings.paper === "receipt80" ? 80 : 100;
  const top = settings.paper === "ticket70x100" ? 5 : 0;
  const imageStyle = {
    left: `${((width - 70) / 2 / width) * 100}%`,
    top: `${((top + (settings.paper === "ticket70x100" ? settings.topMm : 0)) / height) * 100}%`,
    width: `${(70 / width) * 100}%`,
    height: `${(80 / height) * 100}%`,
  };
  return (
    <>
      <div className="ticket-sheet double-ticket-preview">
        {tickets.map((t) => (
          <figure className="ticket double-ticket" key={t.id}>
            <div
              className="ticket-double-paper"
              style={{ aspectRatio: `${width}/${height}` }}
            >
              {compact ? (
                [0, 1].map((part) => (
                  <div className="ticket-screen-half" key={part}>
                    <img
                      src={t.layout?.image}
                      alt={
                        part
                          ? `Parte del comprador ${t.visible_number}`
                          : `Control y QR de ${t.visible_number}`
                      }
                      style={{
                        left: 0,
                        width: "100%",
                        height: "200%",
                        top: `${((settings.topMm - part * 40) / 40) * 100}%`,
                      }}
                    />
                  </div>
                ))
              ) : (
                <img
                  style={imageStyle}
                  src={t.layout?.image}
                  alt={`Boleta ${t.visible_number} · ${event.title} · ${t.type_name} · ${t.status}`}
                />
              )}
              {compact && (
                <span className="ticket-perforation" aria-hidden="true" />
              )}
            </div>
            <figcaption className="ticket-caption no-print">
              <b>
                {ticketCounter(t.event_sequence)
                  ? `Boleta N.º ${ticketCounter(t.event_sequence)}`
                  : t.visible_number}
              </b>
              <span>
                {t.status === "valid"
                  ? "Entrada vigente"
                  : t.preprinted && t.status === "stock"
                    ? "Sin activar · no permite ingresar"
                    : t.status === "used"
                      ? "Entrada utilizada"
                      : "Entrada anulada"}
              </span>
            </figcaption>
            {onToggle && (
              <label className="ticket-print-choice no-print">
                <input
                  type="checkbox"
                  checked={selectedIds?.includes(t.id) ?? false}
                  disabled={selectionDisabled}
                  onChange={() => onToggle(t.id)}
                  aria-label={`Imprimir boleta ${t.visible_number}`}
                />
                Incluir en impresión
              </label>
            )}
            {onManage && (
              <div
                className="buttons no-print"
                style={{ padding: "12px 18px" }}
              >
                <button
                  className="btn danger"
                  disabled={selectionDisabled}
                  onClick={() => onManage(t, "deactivate")}
                >
                  Desactivar boleta
                </button>
                <button
                  className="btn danger"
                  disabled={selectionDisabled}
                  onClick={() => onManage(t, "delete")}
                >
                  Eliminar boleta
                </button>
              </div>
            )}
          </figure>
        ))}
      </div>
      {printable && (
        <>
          <style>{`@media print {
    @page {size:${width}mm ${compact ? 40 : height}mm;margin:0}
    .ticket-sheet {display:none!important}
    .paper-ticket {position:relative;width:${width}mm;height:${compact ? 40 : height}mm;overflow:hidden;padding:0;margin:0;break-after:page;page-break-after:always;background:white}
    .paper-ticket:last-child {break-after:auto;page-break-after:auto}
    .paper-ticket img {position:absolute;display:block;left:${(width - 70) / 2}mm;width:70mm;height:80mm;max-width:none;margin:0}
   }`}</style>
          <div className="paper-tickets print-only">
            {printTickets.flatMap((t) =>
              (compact ? [0, 1] : [0]).map((part) => (
                <article
                  className="paper-ticket"
                  key={`${t.id}-${part}`}
                  data-ticket-id={t.id}
                  data-part={part}
                >
                  <img
                    src={t.layout?.image}
                    alt={
                      part
                        ? `Parte del comprador ${t.visible_number}`
                        : `Control ${t.visible_number}`
                    }
                    style={{
                      top: `${compact ? settings.topMm - part * 40 : top + settings.topMm}mm`,
                    }}
                  />
                </article>
              )),
            )}
          </div>
        </>
      )}
    </>
  );
}
