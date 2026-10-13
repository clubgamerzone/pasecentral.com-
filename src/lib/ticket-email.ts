import QRCode from "qrcode";
import type { ticketDocument } from "./service";
import { ticketPdf } from "./pdf";

export type TicketEmail = {
  subject: string;
  text: string;
  html: string;
  attachments: {
    filename: string;
    content: string;
    content_type: string;
    content_id?: string;
  }[];
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export async function ticketEmail(
  doc: Awaited<ReturnType<typeof ticketDocument>>,
  link: string,
): Promise<TicketEmail> {
  const attachments: TicketEmail["attachments"] = [];
  const sections: string[] = [];
  const date = new Date(doc.event.starts_at).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
  });
  for (const [index, t] of doc.tickets.entries()) {
    const cid = `entrada-${index}`;
    const pdf = await ticketPdf({ ...doc, tickets: [t] });
    const qr = await QRCode.toBuffer(t.credential, {
      width: 600,
      margin: 4,
      errorCorrectionLevel: "M",
    });
    attachments.push(
      {
        filename: `${t.visible_number}.pdf`,
        content: pdf.toString("base64"),
        content_type: "application/pdf",
      },
      {
        filename: `${t.visible_number}-qr.png`,
        content: qr.toString("base64"),
        content_type: "image/png",
        content_id: cid,
      },
    );
    sections.push(
      `<section style="padding:20px;border:1px solid #d1d5db;margin:16px 0;text-align:center"><h2>${escape(t.type_name)}</h2><p>${escape(t.visible_number)} · Serial: ${escape(t.security_serial)}</p><img src="cid:${cid}" width="240" height="240" alt="QR de ${escape(t.visible_number)}" style="background:white;max-width:100%"><p>Una entrada, un ingreso. Conserva el PDF adjunto.</p></section>`,
    );
  }
  if (attachments.reduce((n, a) => n + a.content.length, 0) > 35_000_000)
    throw new Error("Las entradas exceden el límite de adjuntos del correo");
  return {
    subject: "Tus entradas y QR · Pase Central",
    text: `${doc.event.title}\n${date} · ${doc.event.venue_name}\nAdjuntamos ${doc.tickets.length} entradas en PDF, cada una con su QR individual.\n${doc.tickets.map((t) => `${t.visible_number} · ${t.type_name}`).join("\n")}\nConsulta su estado actualizado: ${link}\nCada QR permite un solo ingreso. No publiques ni compartas entradas que vayas a utilizar.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#102923"><h1>Pase Central</h1><h2>${escape(doc.event.title)}</h2><p>${escape(date)} · ${escape(doc.event.venue_name)}</p><p>${escape(doc.event.address)}</p><p>Estas son tus ${doc.tickets.length} entradas. Cada una tiene su propio QR y PDF adjunto.</p>${sections.join("")}<p><a href="${escape(link)}">Consultar estado y descargar todas las entradas</a></p><p>No publiques los QR. Si una entrada es anulada o sustituida, el PDF anterior no autoriza el ingreso. Entrada de acceso; no es documento fiscal.</p></div>`,
    attachments,
  };
}
