import { z } from "zod";
import { NextResponse } from "next/server";
import { database } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { preprintInventory, preprintDocument } from "@/lib/preprints";
import { originCheck, jsonBody, errorResponse } from "@/lib/http";
import { rateLimit } from "@/lib/service";
import { ticketPdf } from "@/lib/pdf";
import { renderTicketLayout } from "@/lib/ticket-layout";
export async function GET(req: Request) {
  try {
    const a = await requireActor(),
      db = await database();
    await rateLimit(db, `preprint-inventory:${a.id}`, 60);
    const eventId = z
      .uuid()
      .parse(new URL(req.url).searchParams.get("event_id"));
    return NextResponse.json(await preprintInventory(db, a, eventId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    originCheck(req);
    const a = await requireActor(),
      db = await database();
    await rateLimit(db, `preprint-document:${a.id}`, 30);
    const b = z
      .object({
        batch_id: z.uuid(),
        format: z.enum(["json", "pdf"]).default("json"),
      })
      .parse(await jsonBody(req));
    const doc = await preprintDocument(db, a, b.batch_id);
    if (b.format === "pdf") {
      if (!doc.tickets.length)
        throw new Error("El lote no tiene boletas sin activar para descargar");
      return new Response(new Uint8Array(await ticketPdf(doc)), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="boletas-sin-activar.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }
    const tickets = [];
    for (const t of doc.tickets)
      tickets.push({ ...t, layout: await renderTicketLayout(t, doc.event) });
    return NextResponse.json(
      { ...doc, tickets },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
