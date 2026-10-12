import { requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { state } from "@/lib/state";
import { required } from "@/lib/config";
import { fail } from "@/lib/service";
import { errorResponse } from "@/lib/http";
export async function GET() {
  try {
    const a = await requireActor();
    const d = await state(await database(), a);
    if (!d.permissions.sell.length) fail("Sin permiso de impresión", 403);
    return new Response(
      required("QZ_CERTIFICATE_PEM").replaceAll("\\n", "\n"),
      {
        headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
