import { z } from "zod";
import { hash, equal } from "./crypto";
import { required, appUrl } from "./config";
import { fail } from "./service";
import type { Row } from "./db";
const transactionSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  amount_in_cents: z.number().int().nonnegative(),
  currency: z.literal("COP"),
  status: z.enum(["APPROVED", "DECLINED", "ERROR", "VOIDED", "PENDING"]),
});
const eventSchema = z.object({
  event: z.literal("transaction.updated"),
  environment: z.enum(["test", "prod"]),
  timestamp: z.number().int(),
  data: z.object({ transaction: transactionSchema }),
  signature: z.object({
    properties: z
      .array(z.string().regex(/^[a-zA-Z0-9_.]+$/))
      .min(1)
      .max(20),
    checksum: z.string().regex(/^[a-fA-F0-9]{64}$/),
  }),
});
function environment() {
  return process.env.WOMPI_ENV === "production" ? "prod" : "test";
}
export function checkout(o: Row) {
  const publicKey = required("WOMPI_PUBLIC_KEY");
  if (
    !publicKey.startsWith(environment() === "test" ? "pub_test_" : "pub_prod_")
  )
    fail("Llave Wompi no coincide con el ambiente", 503);
  const reference = `PC-${o.id}`,
    amount = String(o.total_cop * 100),
    expiration = new Date(o.reservation_expires_at).toISOString();
  const signature = hash(
    `${reference}${amount}COP${expiration}${required("WOMPI_INTEGRITY_SECRET")}`,
  );
  const params = new URLSearchParams({
    "public-key": publicKey,
    currency: "COP",
    "amount-in-cents": amount,
    reference,
    "signature:integrity": signature,
    "expiration-time": expiration,
    "redirect-url": `${appUrl()}/checkout/result?order=${o.id}`,
  });
  return { url: `https://checkout.wompi.co/p/?${params.toString()}` };
}
export function verifyWebhook(
  body: unknown,
  secret = required("WOMPI_EVENTS_SECRET"),
) {
  const e = eventSchema.parse(body);
  if (e.environment !== environment())
    fail("Ambiente de webhook incorrecto", 401);
  let concatenated = "";
  for (const property of e.signature.properties) {
    let current: unknown = e.data;
    for (const key of property.split(".")) {
      if (
        ["__proto__", "prototype", "constructor"].includes(key) ||
        !current ||
        typeof current !== "object" ||
        !Object.hasOwn(current, key)
      )
        fail("Propiedad firmada inválida", 401);
      current = (current as Row)[key];
    }
    if (typeof current !== "string" && typeof current !== "number")
      fail("Firma inválida", 401);
    concatenated += current;
  }
  if (
    !equal(
      hash(`${concatenated}${e.timestamp}${secret}`),
      e.signature.checksum.toLowerCase(),
    )
  )
    fail("Firma Wompi inválida", 401);
  return e;
}
export async function transaction(id: string) {
  const base =
    environment() === "test"
      ? "https://sandbox.wompi.co/v1"
      : "https://production.wompi.co/v1";
  const res = await fetch(`${base}/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${required("WOMPI_PRIVATE_KEY")}` },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!res.ok) fail("No fue posible consultar la transacción con Wompi", 502);
  return transactionSchema.parse((await res.json()).data);
}
