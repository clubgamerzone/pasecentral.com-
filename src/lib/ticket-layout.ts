import sharp from "sharp";
import QRCode from "qrcode";
import type { Row } from "./db";
import { ticketCounter } from "./ticket-number";

const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
function clipped(value: unknown, length: number) {
  const clean = String(value ?? "").replace(/[\r\n\t]/g, " ");
  return escape(
    clean.length > length ? `${clean.slice(0, length - 1)}…` : clean,
  );
}
export type TicketBitmap = { width: 560; height: 320; hex: string };
export type TicketLayout = {
  image: string;
  halves: [TicketBitmap, TicketBitmap];
};

// One raster source for screen, PDF and both 40mm ZPL segments. No user SVG.
export async function renderTicketLayout(
  ticket: Row,
  event: Row,
): Promise<TicketLayout> {
  const modules = QRCode.create(ticket.credential, {
    errorCorrectionLevel: "M",
  }).modules.size;
  const scale = Math.min(4, Math.floor(176 / (modules + 8)));
  if (scale < 3) throw new Error("El QR requiere un papel más grande");
  const qr = await QRCode.toBuffer(ticket.credential, {
    scale,
    margin: 4,
    errorCorrectionLevel: "M",
  });
  const qrSize = (modules + 8) * scale;
  const date = new Date(event.starts_at);
  const day = date.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const hour = date.toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
  const price = Number(ticket.unit_price_cop ?? 0).toLocaleString("es-CO");
  const text = (
    x: number,
    y: number,
    size: number,
    value: unknown,
    bold = false,
    anchor = "start",
    max = 70,
  ) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}">${clipped(value, max)}</text>`;
  const line = (y: number) =>
    `<path d="M56 ${y}H536" stroke="black" stroke-width="1.5"/>`;
  const id = (y: number) =>
    text(56, y, 17, ticket.visible_number, true, "start", 32) +
    text(
      56,
      y + 20,
      13,
      `Serial: ${ticket.security_serial}`,
      false,
      "start",
      38,
    );
  const art = event.ticket_art_data_url;
  const counter = ticketCounter(ticket.event_sequence);
  if (art && !/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(art))
    throw new Error("Arte de boleta inválido");
  const status =
    ticket.status === "valid" ||
    (ticket.preprinted === true && ticket.status === "stock")
      ? ""
      : `<rect x="56" y="103" width="480" height="31" fill="white"/>${text(296, 126, 18, ticket.status === "used" ? "ENTRADA UTILIZADA" : "ENTRADA ANULADA", true, "middle")}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="640" viewBox="0 0 560 640"><rect width="560" height="640" fill="white"/><g fill="black" font-family="DejaVu Sans,Arial,sans-serif">
 ${text(56, 24, 17, "PASE CENTRAL", true)}${counter ? text(536, 11, 9, "CONTROL DE INGRESO", true, "end") + text(536, 30, 19, `BOLETA N.º ${counter}`, true, "end") : text(536, 24, 12, "CONTROL DE INGRESO", true, "end")}${line(35)}
 <image x="${64 + (176 - qrSize) / 2}" y="${53 + (176 - qrSize) / 2}" width="${qrSize}" height="${qrSize}" href="data:image/png;base64,${qr.toString("base64")}"/>
 ${text(266, 65, 21, String(ticket.type_name).toUpperCase(), true, "start", 22)}
 ${text(536, 87, 13, String(ticket.phase_name ?? "").toUpperCase(), false, "end", 30)}
 ${text(266, 135, 35, `$ ${price}`, true)}${text(266, 163, 11, "LUGAR", true)}
 ${text(266, 185, 16, event.venue_name, true, "start", 30)}${text(266, 206, 13, event.address, false, "start", 38)}
 ${line(232)}${id(255)}${text(536, 269, 12, ticket.preprinted ? "ACTIVAR AL VENDER" : "UN SOLO INGRESO", true, "end")}${status}
 ${art ? `<image x="56" y="330" width="480" height="112" preserveAspectRatio="xMidYMid meet" href="${art}"/>` : text(296, 391, 26, event.title, true, "middle", 34)}
 ${text(296, 451, 10, "ENTRADA DE ACCESO · NO ES DOCUMENTO FISCAL", false, "middle")}
 ${text(56, 465, 11, "FECHA", true)}${text(56, 487, 18, day, true)}${text(356, 465, 11, "INICIO", true)}${text(356, 487, 18, hour, true)}
 ${line(500)}${text(56, 523, 18, event.venue_name, true, "start", 45)}${text(56, 546, 15, event.address, false, "start", 52)}
 ${line(557)}${id(580)}${text(536, 596, 12, event.ticket_art_caption ?? "VIVE EL MOMENTO", true, "end")}
 </g></svg>`;
  const { data, info } = await sharp(Buffer.from(svg))
    .flatten({ background: "white" })
    .grayscale()
    .threshold(170)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stride = info.width * info.channels;
  const halves = [0, 320].map((top) => {
    const bytes = Buffer.alloc(70 * 320);
    for (let y = 0; y < 320; y++)
      for (let x = 0; x < 560; x++)
        if (data[(top + y) * stride + x * info.channels] < 128)
          bytes[y * 70 + (x >> 3)] |= 128 >> (x % 8);
    return {
      width: 560 as const,
      height: 320 as const,
      hex: bytes.toString("hex").toUpperCase(),
    };
  }) as [TicketBitmap, TicketBitmap];
  const png = await sharp(data, {
    raw: { width: 560, height: 640, channels: info.channels },
  })
    .png()
    .toBuffer();
  return { image: `data:image/png;base64,${png.toString("base64")}`, halves };
}
