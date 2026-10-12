import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, fail } from "./service";
import { appUrl, demoMode } from "./config";
export function originCheck(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(appUrl()).origin;
  if (origin !== expected) fail("Origen de solicitud no autorizado", 403);
  if (
    demoMode() &&
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(req.url).hostname)
  )
    fail("La demo solo se permite en localhost", 403);
}
export async function jsonBody(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    fail("Se requiere JSON", 415);
  const body = await req.text();
  if (Buffer.byteLength(body) > 32000) fail("Solicitud demasiado grande", 413);
  return JSON.parse(body);
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: "Datos inválidos",
        fields: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  const code = (error as { code?: string }).code;
  if (code === "23505")
    return NextResponse.json(
      { error: "Ya existe ese registro o solicitud. Actualiza la pantalla." },
      { status: 409 },
    );
  if (code === "23514" || code === "P0001")
    return NextResponse.json(
      {
        error:
          "Revisa fechas, cantidades y fases de precio: no pueden superponerse.",
      },
      { status: 400 },
    );
  // No SQL, tokens, provider responses or personal information in logs.
  console.error(
    "Operación fallida:",
    error instanceof Error ? error.name : "UnknownError",
    code ?? "",
  );
  return NextResponse.json(
    {
      error:
        "Error del servidor. Revisa la configuración o inténtalo nuevamente.",
    },
    { status: 500 },
  );
}
