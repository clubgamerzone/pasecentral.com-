import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
afterEach(() => vi.unstubAllEnvs());
it("redirige páginas y callbacks antiguos conservando ruta y parámetros al origen fijo", () => {
  vi.stubEnv("APP_URL", "https://pasecentral.vercel.app");
  for (const method of ["GET", "HEAD"]) {
    const response = proxy(
      new NextRequest(
        "https://pasecentral-demo.vercel.app/auth/confirm?type=signup&token_hash=fictional-only",
        { method },
      ),
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://pasecentral.vercel.app/auth/confirm?type=signup&token_hash=fictional-only",
    );
  }
});
it("no redirige webhooks/worker/API, dominio nuevo ni desarrollo", () => {
  vi.stubEnv("APP_URL", "https://pasecentral.vercel.app");
  for (const url of [
    "https://pasecentral-demo.vercel.app/api/webhooks/wompi",
    "https://pasecentral-demo.vercel.app/api/worker",
    "https://pasecentral.vercel.app/login",
  ]) {
    expect(
      proxy(new NextRequest(url, { method: "POST" })).headers.get("location"),
    ).toBeNull();
    expect(proxy(new NextRequest(url)).headers.get("location")).toBeNull();
  }
  vi.stubEnv("APP_URL", "http://192.168.1.15:3000");
  expect(
    proxy(
      new NextRequest("https://pasecentral-demo.vercel.app/login"),
    ).headers.get("location"),
  ).toBeNull();
});
