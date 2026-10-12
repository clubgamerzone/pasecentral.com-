import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { ticketDocument } from "./service";
export async function ticketPdf(
  doc: Awaited<ReturnType<typeof ticketDocument>>,
) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const t of doc.tickets) {
    const page = pdf.addPage([300, 510]);
    const text = (s: string, y: number, size = 11, b = false) =>
      page.drawText(s.replace(/[^\x20-\xFF]/g, "").slice(0, 45), {
        x: 24,
        y,
        size,
        font: b ? bold : font,
        color: rgb(0.07, 0.13, 0.12),
      });
    text("PASE CENTRAL", 474, 20, true);
    text(doc.event.title, 438, 14, true);
    text(t.type_name.toUpperCase(), 414, 11, true);
    text(
      new Date(doc.event.starts_at).toLocaleString("es-CO", {
        timeZone: "America/Bogota",
      }),
      394,
      10,
    );
    text(doc.event.venue_name, 376);
    text(doc.event.address, 358, 9);
    const qr = await pdf.embedPng(
      await QRCode.toBuffer(t.credential, {
        width: 600,
        margin: 4,
        errorCorrectionLevel: "M",
      }),
    );
    page.drawImage(qr, { x: 55, y: 135, width: 190, height: 190 });
    text(t.visible_number, 120, 11, true);
    text(`Serial: ${t.security_serial}`, 98, 10);
    text(`Estado: ${t.status}`, 78, 10);
    text("Un ingreso por entrada. No publiques tu QR.", 48, 9);
    text("Entrada de acceso. No es documento fiscal.", 32, 9);
  }
  return Buffer.from(await pdf.save());
}
