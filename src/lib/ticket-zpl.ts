import QRCode from "qrcode";
import {
  parsePrintSettings,
  PAPER_SIZES,
  type PrintSettings,
} from "./print-settings";

export type PrintedTicket = {
  credential: string;
  visible_number: string;
  security_serial: string;
  type_name: string;
  status: string;
};
export type PrintedEvent = {
  title: string;
  starts_at: string;
  venue_name: string;
  address?: string;
};

// Encode every UTF-8 byte: user content can never become a ZPL command.
function hex(value: string) {
  return Array.from(
    new TextEncoder().encode(value),
    (b) => `_${b.toString(16).padStart(2, "0").toUpperCase()}`,
  ).join("");
}
function short(value: string, length: number) {
  const clean = String(value).replace(/[\r\n\t]/g, " ");
  return clean.length > length ? `${clean.slice(0, length - 3)}...` : clean;
}
export function ticketZpl(
  ticket: PrintedTicket,
  event: PrintedEvent,
  input: PrintSettings,
): string {
  const settings = parsePrintSettings(input),
    paper = PAPER_SIZES[settings.paper];
  if (!paper.height) throw new Error("El recibo de 80 mm utiliza ESC/POS");
  if (ticket.status !== "valid")
    throw new Error("Solo se imprimen boletas vigentes en STARPOS");
  if (
    !ticket.credential ||
    ticket.credential.length > 200 ||
    !ticket.visible_number ||
    !ticket.security_serial
  )
    throw new Error("La boleta no tiene sus identificadores completos");
  const date = new Date(event.starts_at);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Fecha del evento inválida");
  const when = date.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const compact = paper.height === 40;
  const modules = QRCode.create(ticket.credential, {
    errorCorrectionLevel: "M",
  }).modules.size;
  const available = compact ? 184 : 320;
  const scale = Math.min(
    compact ? 4 : 6,
    Math.floor(available / (modules + 8)),
  );
  if (scale < 3) throw new Error("El QR requiere un papel más grande");
  const qrSize = modules * scale,
    quiet = 4 * scale;
  const qrX = compact ? 352 + quiet : Math.round((560 - qrSize) / 2);
  const qrY = compact ? 55 + quiet : 240 + quiet;
  const tracking = { black_mark: "M", gap: "Y", continuous: "N" }[
    settings.tracking
  ];
  const fields: string[] = [];
  const text = (
    x: number,
    y: number,
    height: number,
    width: number,
    value: string,
  ) => {
    fields.push(`^FO${x},${y}^A0N,${height},${width}^FH_^FD${hex(value)}^FS`);
  };
  text(72, 16, 26, 24, "PASE CENTRAL");
  if (compact) {
    text(72, 49, 22, 18, short(event.title, 25));
    text(72, 80, 20, 17, short(ticket.type_name, 21));
    text(72, 109, 17, 13, when);
    text(72, 135, 18, 14, short(event.venue_name, 25));
    text(72, 171, 19, 15, ticket.visible_number);
    text(72, 200, 17, 13, `Serial: ${ticket.security_serial}`);
    text(72, 244, 17, 13, "Un ingreso. No publiques tu QR.");
    text(72, 266, 15, 12, "Entrada de acceso. No es documento fiscal.");
  } else {
    text(72, 60, 30, 23, short(event.title, 32));
    text(72, 104, 26, 22, short(ticket.type_name, 32));
    text(72, 145, 22, 18, when);
    text(72, 180, 22, 18, short(event.venue_name, 36));
    text(72, 212, 18, 14, short(event.address ?? "", 45));
    text(72, 600, 26, 21, ticket.visible_number);
    text(72, 642, 22, 18, `Serial: ${ticket.security_serial}`);
    text(72, 700, 20, 16, "Un ingreso por entrada. No publiques tu QR.");
    text(72, 735, 18, 14, "Entrada de acceso. No es documento fiscal.");
  }
  fields.push(
    `^FO${qrX},${qrY}^BQN,2,${scale}^FH_^FDMA,${hex(ticket.credential)}^FS`,
  );
  // No cut, calibration, EEPROM save or QR logging. Reprints use the same credential.
  return `~SD${settings.darkness}\n^XA\n^CI28^PR2^MD0^MN${tracking},0^MTT^PW560^LL${paper.height * 8}^LH0,0^LS0^LT${settings.topMm * 8}^PON^FWN\n${fields.join("\n")}\n^PQ1,0,1,N\n^XZ`;
}
