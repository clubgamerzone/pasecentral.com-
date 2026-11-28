import { describe, expect, it } from "vitest";
import { purchaseReturn, purchaseSelection } from "../src/lib/purchase-return";
describe("continuidad de compra", () => {
  it("solo permite volver a eventos públicos del mismo sitio", () => {
    expect(purchaseReturn("/events/retro-fest-1-0")).toBe(
      "/events/retro-fest-1-0",
    );
    for (const path of [
      "https://evil.test",
      "//evil.test/events/x",
      "/admin",
      "/events/x#token",
      "/events/x?next=https://evil.test",
      "/events/x/../admin",
      "/events/x%0aevil",
      null,
    ])
      expect(purchaseReturn(path)).toBeNull();
  });
  it("restaura solo cantidades acotadas y no precios o datos de cuenta", () => {
    const id = "00000000-0000-4000-8000-000000000002";
    expect(purchaseSelection(`${id}:2,wrong:3`)).toEqual({ [id]: 2 });
    for (const quantity of ["-1", "21", "NaN", "1.5", "0"])
      expect(purchaseSelection(`${id}:${quantity}`)).toEqual({});
  });
});
