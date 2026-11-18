export const PAPER_SIZES = {
  receipt80: { label: "Recibo de 80 mm", width: 80, height: null },
  ticket70x40: { label: "Boleta de 70 × 40 mm", width: 70, height: 40 },
  ticket70x100: {
    label: "Boleta de concierto de 70 × 100 mm",
    width: 70,
    height: 100,
  },
} as const;
export type PaperSize = keyof typeof PAPER_SIZES;
export type PrintSettings = {
  paper: PaperSize;
  tracking: "black_mark" | "gap" | "continuous";
  topMm: number;
  darkness: number;
};
export const PRINT_SETTINGS_KEY = "pasecentral.print-settings.v1";
export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paper: "receipt80",
  tracking: "black_mark",
  topMm: 0,
  darkness: 18,
};
export function paperPreset(paper: PaperSize): PrintSettings {
  return {
    ...DEFAULT_PRINT_SETTINGS,
    paper,
    topMm: paper === "ticket70x40" ? 4 : 0,
    darkness: paper === "ticket70x40" ? 26 : 18,
  };
}
export function parsePrintSettings(value: unknown): PrintSettings {
  if (!value || typeof value !== "object")
    throw new Error("Configuración de impresión inválida");
  const s = value as PrintSettings;
  if (
    !Object.hasOwn(PAPER_SIZES, s.paper) ||
    !["black_mark", "gap", "continuous"].includes(s.tracking) ||
    !Number.isInteger(s.topMm) ||
    s.topMm < -5 ||
    s.topMm > 5 ||
    !Number.isInteger(s.darkness) ||
    s.darkness < 1 ||
    s.darkness > 26
  )
    throw new Error("Revisa el papel y los ajustes de impresión");
  return {
    paper: s.paper,
    tracking: s.tracking,
    topMm: s.topMm,
    darkness: s.darkness,
  };
}
