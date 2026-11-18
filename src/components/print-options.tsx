"use client";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_PRINT_SETTINGS,
  PAPER_SIZES,
  PRINT_SETTINGS_KEY,
  paperPreset,
  parsePrintSettings,
  type PaperSize,
  type PrintSettings,
} from "@/lib/print-settings";
import type { Row } from "@/lib/db";

let temporarySettings: string | null = null;
function readSettings() {
  if (temporarySettings !== null) return temporarySettings;
  try {
    return localStorage.getItem(PRINT_SETTINGS_KEY) ?? "";
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
        ajustes iniciales; no modifica tus entradas ni el PDF digital.
      </p>
      {labelPaper && (
        <>
          <p className="helper">
            STARPOS IF4 · transferencia térmica con ribbon · 203 dpi. Coloca la
            cara imprimible hacia el cabezal.
          </p>
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
}: {
  tickets: Row[];
  event: Row;
  settings: PrintSettings;
}) {
  const paper = PAPER_SIZES[settings.paper];
  if (!paper.height) return null;
  const compact = paper.height === 40;
  return (
    <>
      <style>{`@media print {
      @page { size: 70mm ${paper.height}mm; margin: 0; }
      .ticket-sheet { display: none !important; }
      .paper-ticket { position: relative; box-sizing: border-box; width: 70mm; height: ${paper.height}mm; padding: 0; margin: 0; break-after: page; page-break-after: always; color: #000; background: #fff; }
      .paper-ticket:last-child { break-after: auto; page-break-after: auto; }
      .paper-ticket-content { position: absolute; left: 9mm; right: 3mm; top: ${Math.max(0, settings.topMm)}mm; font: ${compact ? "7" : "9"}pt Arial, sans-serif; }
      .paper-ticket-brand { font-weight: bold; font-size: ${compact ? "8" : "13"}pt; margin: 0 0 1mm; }
      .paper-ticket-title { font-weight: bold; height: ${compact ? "4" : "10"}mm; overflow: hidden; margin: 0; line-height: 1.05; }
      .paper-ticket-details { display: ${compact ? "grid" : "flex"}; ${compact ? "grid-template-columns: 32mm 24mm; gap: 2mm;" : "flex-direction: column;"} }
      .paper-ticket p { margin: 0 0 ${compact ? "0.8" : "2"}mm; line-height: 1.1; overflow-wrap: anywhere; }
      .paper-ticket-place { max-height: ${compact ? "4" : "10"}mm; overflow: hidden; }
      .paper-ticket img { width: ${compact ? "22" : "40"}mm; height: ${compact ? "22" : "40"}mm; display: block; ${compact ? "" : "align-self: center; margin: 2mm 0;"} }
      .paper-ticket-terms { font-size: ${compact ? "5" : "8"}pt; margin-top: 1mm !important; }
    }`}</style>
      <div className="paper-tickets print-only">
        {tickets.map((t) => (
          <article className="paper-ticket" key={t.id}>
            <div className="paper-ticket-content">
              <div className="paper-ticket-brand">PASE CENTRAL</div>
              <div className="paper-ticket-title">{event.title}</div>
              <div className="paper-ticket-details">
                <div>
                  <p>
                    <b>{t.type_name}</b>
                  </p>
                  <p>
                    {new Date(event.starts_at).toLocaleString("es-CO", {
                      timeZone: "America/Bogota",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="paper-ticket-place">{event.venue_name}</p>
                  <p>
                    <b>{t.visible_number}</b>
                  </p>
                  <p>Serial: {t.security_serial}</p>
                </div>
                <img src={t.qr} alt={`QR de ${t.visible_number}`} />
              </div>
              <p className="paper-ticket-terms">
                Un ingreso por entrada. No publiques tu QR.
                <br />
                Entrada de acceso. No es documento fiscal.
              </p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
