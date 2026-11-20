import { afterEach, it, expect, vi } from "vitest";
import { browserId } from "../src/lib/browser-id";
afterEach(() => vi.unstubAllGlobals());
it("usa randomUUID nativo cuando existe", () => {
  const native = vi.fn(() => "12345678-1234-4123-8123-123456789abc");
  vi.stubGlobal("crypto", { randomUUID: native });
  expect(browserId()).toBe("12345678-1234-4123-8123-123456789abc");
  expect(native).toHaveBeenCalledOnce();
});
it("sin randomUUID genera UUIDv4 con bytes de getRandomValues y sin Math.random", () => {
  const fill = vi.fn((bytes: Uint8Array) => bytes.fill(0xa5));
  vi.stubGlobal("crypto", { getRandomValues: fill });
  expect(browserId()).toBe("a5a5a5a5-a5a5-45a5-a5a5-a5a5a5a5a5a5");
  expect(fill).toHaveBeenCalledOnce();
  expect(fill.mock.calls[0][0].length).toBe(16);
});
it("rechaza ausencia de aleatoriedad segura en vez de usar un identificador predecible", () => {
  vi.stubGlobal("crypto", {});
  expect(() => browserId()).toThrow("identificadores seguros");
});
