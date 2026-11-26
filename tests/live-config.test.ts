import { afterEach, expect, it, vi } from "vitest";
import { configured, required } from "../src/lib/config";
import { checkout } from "../src/lib/wompi";
import { hash } from "../src/lib/crypto";
import { database } from "../src/lib/db";
afterEach(() => vi.unstubAllEnvs());
function live() {
  vi.stubEnv("PASE_CONFIG_PROFILE", "live");
  for (const name of ["APP_MODE", "APP_ENVIRONMENT", "WOMPI_ENV"])
    vi.stubEnv(name, "production");
}
it("preserva la configuración habitual y rechaza perfiles desconocidos", () => {
  vi.stubEnv("PASE_CONFIG_PROFILE", "");
  vi.stubEnv("DATABASE_URL", "legacy-test-only");
  expect(required("DATABASE_URL")).toBe("legacy-test-only");
  vi.stubEnv("PASE_CONFIG_PROFILE", "typo");
  expect(() => required("DATABASE_URL")).toThrow("desconocido");
});
it("separa conexión, CA e identidad Auth y nunca utiliza la conexión anterior como fallback", () => {
  live();
  vi.stubEnv("DATABASE_URL", "legacy-test-only");
  vi.stubEnv("DATABASE_LIVE_URL", "isolated-test-only");
  vi.stubEnv("DATABASE_SSL_CA", "old-ca");
  vi.stubEnv("DATABASE_LIVE_SSL_CA", "new-ca");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://old.example");
  vi.stubEnv("SUPABASE_LIVE_URL", "https://new.example");
  expect(required("DATABASE_URL")).toBe("isolated-test-only");
  expect(configured("DATABASE_SSL_CA")).toBe("new-ca");
  expect(required("NEXT_PUBLIC_SUPABASE_URL")).toBe("https://new.example");
  vi.stubEnv("DATABASE_LIVE_URL", "");
  expect(() => required("DATABASE_URL")).toThrow("DATABASE_URL");
});
it("rechaza activación parcial antes de entregar secretos de servidor", () => {
  for (const missing of ["APP_MODE", "APP_ENVIRONMENT", "WOMPI_ENV"]) {
    live();
    vi.stubEnv(missing, "staging");
    expect(() => required("WORKER_SECRET")).toThrow("tres ambientes");
  }
});
it("rechaza la base real sin CA antes de intentar una conexión sin TLS", async () => {
  live();
  vi.stubEnv("DATABASE_LIVE_SSL_CA", "");
  delete globalThis.paseDb;
  try {
    await expect(database()).rejects.toThrow("DATABASE_SSL_CA");
  } finally {
    delete globalThis.paseDb;
  }
});
it("checkout firma con las llaves reservadas de producción y retorna al dominio propio", () => {
  live();
  vi.stubEnv("APP_URL", "https://pasecentral.app");
  vi.stubEnv("WOMPI_PUBLIC_KEY", "pub_test_unused");
  vi.stubEnv("WOMPI_INTEGRITY_SECRET", "old-test-only");
  vi.stubEnv("WOMPI_LIVE_PUBLIC_KEY", "pub_prod_unit_test_only");
  vi.stubEnv("WOMPI_LIVE_INTEGRITY_SECRET", "new-test-only");
  const expires = "2027-01-01T00:00:00.000Z";
  const u = new URL(
    checkout({
      id: "unit-order",
      total_cop: 30000,
      reservation_expires_at: expires,
    }).url,
  );
  expect(u.searchParams.get("public-key")).toBe("pub_prod_unit_test_only");
  expect(u.searchParams.get("signature:integrity")).toBe(
    hash(`PC-unit-order3000000COP${expires}new-test-only`),
  );
  expect(u.searchParams.get("redirect-url")).toBe(
    "https://pasecentral.app/checkout/result?order=unit-order",
  );
});
