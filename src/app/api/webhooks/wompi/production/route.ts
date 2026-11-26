import { POST as receiveWompi } from "../route";

// Keep the live URL distinct from the existing sandbox integration. Signature,
// provider reconciliation and idempotent settlement remain in the same handler.
export async function POST(req: Request) {
  if (
    process.env.APP_MODE !== "production" ||
    process.env.APP_ENVIRONMENT !== "production" ||
    process.env.WOMPI_ENV !== "production"
  )
    return Response.json(
      { error: "El receptor de pagos reales no está habilitado" },
      { status: 503 },
    );
  return receiveWompi(req);
}
