import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { renderTicketLayout } from "@/lib/ticket-layout";
import { z } from "zod";
import { database } from "@/lib/db";
import { currentActor } from "@/lib/auth";
import { ticketDocument, rateLimit, fail } from "@/lib/service";
import { ticketPdf } from "@/lib/pdf";
import { originCheck, jsonBody, errorResponse } from "@/lib/http";
const schema = z.object({
  order_id: z.string().uuid(),
  share: z.string().max(100).optional(),
  format: z.enum(["json", "pdf"]).default("json"),
  owner_only: z.boolean().default(false),
  preview_ticket_id: z.uuid().optional(),
});
export async function POST(req: Request) {
  try {
    originCheck(req);
    const b = schema.parse(await jsonBody(req));
    if (b.preview_ticket_id && !b.owner_only)
      fail("La vista personal requiere acceso como titular", 400);
    const a = await currentActor(),
      db = await database();
    await rateLimit(db, `document:${a?.id ?? b.order_id}`, 60);
    const doc = await ticketDocument(db, a, b.order_id, b.share, b.owner_only);
    if (b.preview_ticket_id) {
      const ticket = doc.tickets.find((t) => t.id === b.preview_ticket_id);
      if (!ticket) fail("Esta entrada no está disponible en tu cuenta", 404);
      const image = await QRCode.toDataURL(ticket.credential, {
        width: 360,
        margin: 4,
        errorCorrectionLevel: "M",
      });
      return NextResponse.json(
        { id: ticket.id, image },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (b.format === "pdf") {
      const pdf = await ticketPdf(doc);
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="entradas-${b.order_id}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const tickets = await Promise.all(
      doc.tickets.map(async (t) => ({
        ...t,
        layout: await renderTicketLayout(t, doc.event),
        qr: await QRCode.toDataURL(t.credential, { width: 360, margin: 4 }),
      })),
    );
    return NextResponse.json(
      { ...doc, tickets },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
