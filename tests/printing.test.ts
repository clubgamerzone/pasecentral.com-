import { describe, expect, it } from "vitest";
import { paperPreset, parsePrintSettings } from "../src/lib/print-settings";
import { ticketZpl } from "../src/lib/ticket-zpl";

const ticket = {
  credential: `pc:${"a".repeat(43)}`,
  visible_number: "PC-12345678-000001",
  security_serial: "ABC1234567890123",
  type_name: "General",
  status: "valid",
};
const event = {
  title: "Concierto de prueba",
  starts_at: "2026-11-19T02:00:00Z",
  venue_name: "Recinto ficticio",
};
function decodeFields(zpl: string) {
  return [...zpl.matchAll(/\^FD(?:MA,)?((?:_[\dA-F]{2})+)\^FS/g)].map((m) =>
    Buffer.from(m[1].replaceAll("_", ""), "hex").toString("utf8"),
  );
}
describe("impresión de boletas", () => {
  it("conserva los identificadores y QR al reimprimir y cambia largo sin heredar la calibración pequeña", () => {
    const small = ticketZpl(ticket, event, paperPreset("ticket70x40"));
    const large = ticketZpl(ticket, event, paperPreset("ticket70x100"));
    expect(small).toContain("^MNM,0");
    expect(small).toContain("^LL320");
    expect(small).toContain("^LT32");
    expect(large).toContain("^LL800");
    expect(large).toContain("^LT0");
    for (const zpl of [small, large]) {
      expect(decodeFields(zpl)).toEqual(
        expect.arrayContaining([
          ticket.credential,
          ticket.visible_number,
          `Serial: ${ticket.security_serial}`,
        ]),
      );
      expect(zpl).toContain("^PQ1,0,1,N");
      expect(zpl).not.toMatch(/\^JU|~JC|\^MMC/);
    }
    expect(ticketZpl(ticket, event, paperPreset("ticket70x40"))).toBe(small);
  });
  it("codifica comandos hostiles y texto español como datos sin ejecutar ZPL", () => {
    const zpl = ticketZpl(
      { ...ticket, type_name: "VIP ^XZ~JA_" },
      { ...event, venue_name: "José ^XA^JUS" },
      paperPreset("ticket70x40"),
    );
    expect(zpl.match(/\^XA/g)).toHaveLength(1);
    expect(zpl.match(/\^XZ/g)).toHaveLength(1);
    expect(zpl).not.toContain("~JA");
    expect(zpl).not.toContain("^JUS");
    expect(decodeFields(zpl)).toContain("José ^XA^JUS");
  });
  it("rechaza preferencias manipuladas y boletas sin credencial o no vigentes", () => {
    const settings = paperPreset("ticket70x40");
    for (const invalid of [
      { ...settings, paper: "__proto__" },
      { ...settings, topMm: 200 },
      { ...settings, darkness: 30 },
      { ...settings, tracking: "^XZ" },
    ])
      expect(() => parsePrintSettings(invalid)).toThrow();
    expect(() =>
      ticketZpl({ ...ticket, credential: "" }, event, settings),
    ).toThrow();
    expect(() =>
      ticketZpl({ ...ticket, status: "cancelled" }, event, settings),
    ).toThrow();
    expect(() =>
      ticketZpl({ ...ticket, credential: "x".repeat(200) }, event, settings),
    ).toThrow("papel más grande");
  });
  it("mantiene cada QR dentro del papel con cuatro módulos blancos alrededor", () => {
    for (const paper of ["ticket70x40", "ticket70x100"] as const) {
      const settings = paperPreset(paper),
        zpl = ticketZpl(ticket, event, settings);
      const qr = /\^FO(\d+),(\d+)\^BQN,2,(\d+)/.exec(zpl)!;
      const x = Number(qr[1]),
        y = Number(qr[2]),
        scale = Number(qr[3]);
      // 46-byte credential, error correction M => version 4, 33 modules.
      expect(x - 4 * scale).toBeGreaterThanOrEqual(0);
      expect(x + 37 * scale).toBeLessThanOrEqual(560);
      expect(y + 37 * scale + settings.topMm * 8).toBeLessThanOrEqual(
        paper === "ticket70x40" ? 320 : 800,
      );
    }
  });
});
