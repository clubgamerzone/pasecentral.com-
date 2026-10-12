import { createSign } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { state } from "@/lib/state";
import { required } from "@/lib/config";
import { fail, rateLimit } from "@/lib/service";
import { errorResponse, originCheck, jsonBody } from "@/lib/http";
export async function POST(req: Request) {
  try {
    originCheck(req);
    const a = await requireActor(),
      db = await database();
    await rateLimit(db, `print-sign:${a.id}`, 60);
    const d = await state(db, a);
    if (!d.permissions.sell.length) fail("Sin permiso de impresión", 403);
    const body = z
      .object({ request: z.string().max(25000) })
      .parse(await jsonBody(req));
    const parsed = JSON.parse(body.request);
    if (!["print", "printers.find"].includes(parsed.call))
      fail("Operación QZ no autorizada", 403);
    if (
      parsed.call === "print" &&
      parsed.params?.printer?.name !== required("NEXT_PUBLIC_QZ_PRINTER")
    )
      fail("Impresora no autorizada", 403);
    const signer = createSign("SHA512");
    signer.update(body.request);
    return NextResponse.json({
      signature: signer.sign(
        required("QZ_PRIVATE_KEY_PEM").replaceAll("\\n", "\n"),
        "base64",
      ),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
