import { PDFDocument } from "pdf-lib";
import type { Row } from "./db";
import { renderTicketLayout } from "./ticket-layout";
export async function ticketPdf(doc: { tickets: Row[]; event: Row }) {
  const pdf = await PDFDocument.create();
  for (const ticket of doc.tickets) {
    const layout = await renderTicketLayout(ticket, doc.event);
    const page = pdf.addPage([(70 * 72) / 25.4, (80 * 72) / 25.4]);
    const png = await pdf.embedPng(
      Buffer.from(layout.image.split(",")[1], "base64"),
    );
    page.drawImage(png, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });
  }
  return Buffer.from(await pdf.save());
}
