import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { database } from "@/lib/db";
import { currentActor } from "@/lib/auth";
import { ticketDocument, rateLimit } from "@/lib/service";
import { ticketPdf } from "@/lib/pdf";
import { originCheck, jsonBody, errorResponse } from "@/lib/http";
const schema = z.object({
  order_id: z.string().uuid(),
  share: z.string().max(100).optional(),
  format: z.enum(["json", "pdf"]).default("json"),
});
export async function POST(req: Request) {
  try {
    originCheck(req);
    const b = schema.parse(await jsonBody(req));
    const a = await currentActor(),
      db = await database();
    await rateLimit(db, `document:${a?.id ?? b.order_id}`, 60);
    const doc = await ticketDocument(db, a, b.order_id, b.share);
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
