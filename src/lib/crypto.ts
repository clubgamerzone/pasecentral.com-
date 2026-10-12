import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { demoMode, required } from "./config";
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
function localKey() {
  mkdirSync(".local", { recursive: true });
  const p = ".local/server-key";
  if (!existsSync(p)) {
    try {
      writeFileSync(p, randomBytes(32).toString("hex"), {
        flag: "wx",
        mode: 0o600,
      });
    } catch {}
  }
  return readFileSync(p, "utf8").trim();
}
export function secret(name: string) {
  return demoMode() ? localKey() : required(name);
}
export function encrypt(v: string) {
  const key = Buffer.from(secret("TICKET_ENCRYPTION_KEY"), "hex");
  if (key.length !== 32)
    throw new Error("TICKET_ENCRYPTION_KEY debe tener 64 caracteres hex.");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  return Buffer.concat([iv, c.update(v), c.final(), c.getAuthTag()]).toString(
    "base64url",
  );
}
export function decrypt(v: string) {
  const b = Buffer.from(v, "base64url");
  const c = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(secret("TICKET_ENCRYPTION_KEY"), "hex"),
    b.subarray(0, 12),
  );
  c.setAuthTag(b.subarray(-16));
  return Buffer.concat([c.update(b.subarray(12, -16)), c.final()]).toString();
}
export function sign(v: string) {
  return createHmac("sha256", secret("SESSION_SECRET")).update(v).digest("hex");
}
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
