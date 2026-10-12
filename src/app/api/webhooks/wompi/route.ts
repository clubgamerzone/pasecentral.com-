import { NextResponse } from "next/server";
import { database } from "@/lib/db";
import { verifyWebhook, transaction } from "@/lib/wompi";
import { settle, fail } from "@/lib/service";
import { jsonBody, errorResponse } from "@/lib/http";
export async function POST(req: Request) {
  try {
    const event = verifyWebhook(await jsonBody(req));
    // Reference/currency are not necessarily signed by Wompi. Always reconcile with its authenticated API.
    const p = await transaction(event.data.transaction.id);
    if (!p.reference.startsWith("PC-")) fail("Referencia ajena", 400);
    const db = await database();
    const result = await db.transaction(async (tx) => {
      const key = `${p.id}:${p.status}`;
      const inserted = await tx.query(
        "INSERT INTO payment_webhook_events(provider,deduplication_key,processing_status) VALUES('wompi',$1,'processing') ON CONFLICT DO NOTHING RETURNING id",
        [key],
      );
      if (!inserted.rows.length) return { duplicate: true };
      const r = await settle(tx, {
        orderId: p.reference.slice(3),
        transactionId: p.id,
        amount: p.amount_in_cents,
        currency: p.currency,
        status: p.status,
      });
      await tx.query(
        "UPDATE payment_webhook_events SET processing_status='processed',processed_at=now() WHERE deduplication_key=$1",
        [key],
      );
      return r;
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
