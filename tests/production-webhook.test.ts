import { afterEach, expect, it, vi } from "vitest";
const receiver = vi.hoisted(() => vi.fn());
vi.mock("../src/app/api/webhooks/wompi/route", () => ({ POST: receiver }));
import { POST } from "../src/app/api/webhooks/wompi/production/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
const request = () =>
  new Request("https://example.test/api/webhooks/wompi/production", {
    method: "POST",
    body: "{}",
  });
it("no accede al procesador de pagos con ambientes incompletos o sandbox", async () => {
  for (const missing of ["APP_MODE", "APP_ENVIRONMENT", "WOMPI_ENV"]) {
    for (const key of ["APP_MODE", "APP_ENVIRONMENT", "WOMPI_ENV"])
      vi.stubEnv(key, "production");
    vi.stubEnv(missing, missing === "WOMPI_ENV" ? "sandbox" : "staging");
    expect((await POST(request())).status).toBe(503);
  }
  expect(receiver).not.toHaveBeenCalled();
});
it("producción utiliza el mismo receptor firmado y no un camino de aprobación alterno", async () => {
  for (const key of ["APP_MODE", "APP_ENVIRONMENT", "WOMPI_ENV"])
    vi.stubEnv(key, "production");
  const response = Response.json(
    { error: "Firma Wompi inválida" },
    { status: 401 },
  );
  receiver.mockResolvedValue(response);
  const req = request();
  expect(await POST(req)).toBe(response);
  expect(receiver).toHaveBeenCalledExactlyOnceWith(req);
});
