import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
afterEach(() => vi.unstubAllEnvs());
it("usa el dominio propio y mantiene páginas/callbacks completos sin redirigir APIs", () => {
  vi.stubEnv("APP_URL", "https://pasecentral.app");
  for (const host of [
    "pasecentral.vercel.app",
    "pasecentral-demo.vercel.app",
    "www.pasecentral.app",
  ]) {
    for (const method of ["GET", "HEAD"]) {
      const r = proxy(
        new NextRequest(
          `https://${host}/auth/confirm?type=signup&token_hash=fictional-only`,
          { method },
        ),
      );
      expect(r.status).toBe(308);
      expect(r.headers.get("location")).toBe(
        "https://pasecentral.app/auth/confirm?type=signup&token_hash=fictional-only",
      );
    }
    for (const method of ["GET", "POST"]) {
      expect(
        proxy(
          new NextRequest(`https://${host}/api/webhooks/wompi/production`, {
            method,
          }),
        ).headers.get("location"),
      ).toBeNull();
    }
  }
  expect(
    proxy(new NextRequest("https://pasecentral.app/login")).headers.get(
      "location",
    ),
  ).toBeNull();
  vi.stubEnv("APP_URL", "https://untrusted.example");
  expect(
    proxy(new NextRequest("https://pasecentral.vercel.app/login")).headers.get(
      "location",
    ),
  ).toBeNull();
});
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
