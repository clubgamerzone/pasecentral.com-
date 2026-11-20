import { beforeAll, describe, expect, it } from "vitest";
import {
  paperPreset,
  parsePrintSettings,
  DEFAULT_PRINT_SETTINGS,
  upgradeLegacyPrintSettings,
} from "../src/lib/print-settings";
import { ticketZpl } from "../src/lib/ticket-zpl";
import {
  renderTicketLayout,
  type TicketLayout,
} from "../src/lib/ticket-layout";
import sharp from "sharp";
import { ticketCounter } from "../src/lib/ticket-number";
const ticket = {
  credential: `pc:${"a".repeat(43)}`,
  visible_number: "PC-12345678-000001",
  event_sequence: 1,
  security_serial: "ABC1234567890123",
  type_name: "General",
  phase_name: "Preventa",
  unit_price_cop: 30000,
  status: "valid",
  layout: undefined as TicketLayout | undefined,
};
const event = {
  title: "Concierto de prueba",
  starts_at: "2026-11-19T02:00:00Z",
  venue_name: "Recinto ficticio",
};
beforeAll(async () => {
  ticket.layout = await renderTicketLayout(ticket, event);
});
describe("boleta doble", () => {
  it("destaca el consecutivo persistido solo en el control sin renumerar por impresión", async () => {
    expect(ticketCounter(5)).toBe("000005");
    expect(ticketCounter(1234567)).toBe("1234567");
    expect(ticketCounter(undefined)).toBeNull();
    const next = await renderTicketLayout(
      { ...ticket, event_sequence: 5 },
      event,
    );
    const a = Buffer.from(ticket.layout!.halves[0].hex, "hex");
    const b = Buffer.from(next.halves[0].hex, "hex");
    expect(a.subarray(0, 35 * 70).equals(b.subarray(0, 35 * 70))).toBe(false);
    expect(a.subarray(35 * 70).equals(b.subarray(35 * 70))).toBe(true);
    expect(next.halves[1]).toEqual(ticket.layout!.halves[1]);
  });
  it("usa 70x40 por defecto, emite dos tramos por persona y reimprime exactamente los mismos píxeles", () => {
    expect(DEFAULT_PRINT_SETTINGS.paper).toBe("ticket70x40");
    expect(DEFAULT_PRINT_SETTINGS.darkness).toBe(26);
    const small = ticketZpl(ticket, event, paperPreset("ticket70x40")),
      large = ticketZpl(ticket, event, paperPreset("ticket70x100"));
    expect(small.match(/\^XA/g)).toHaveLength(2);
    expect(small.match(/\^LL320/g)).toHaveLength(2);
    expect(small).toContain("^LT32");
    expect(small).toContain("~SD26");
    expect(large.match(/\^XA/g)).toHaveLength(1);
    expect(large).toContain("^LL800");
    for (const output of [small, large])
      expect(output).not.toMatch(/\^JU|~JC|\^MMC/);
    for (const half of ticket.layout!.halves) expect(small).toContain(half.hex);
    expect(ticketZpl(ticket, event, paperPreset("ticket70x40"))).toBe(small);
  });
  it("actualiza el anterior ajuste 16 del papel pequeño conservando alineación y otros materiales", () => {
    const legacy = { ...paperPreset("ticket70x40"), darkness: 16, topMm: 3 };
    expect(
      JSON.parse(upgradeLegacyPrintSettings(JSON.stringify(legacy))),
    ).toEqual({ ...legacy, darkness: 26 });
    for (const settings of [
      paperPreset("ticket70x100"),
      { ...legacy, darkness: 21 },
    ])
      expect(
        JSON.parse(upgradeLegacyPrintSettings(JSON.stringify(settings))),
      ).toEqual(settings);
  });
  it("los bits ZPL reconstruyen la misma imagen que se muestra, con márgenes inferiores para calibración", async () => {
    const png = Buffer.from(ticket.layout!.image.split(",")[1], "base64");
    const pixels = await sharp(png).grayscale().raw().toBuffer();
    const reconstructed = Buffer.alloc(560 * 640, 255);
    ticket.layout!.halves.forEach((half, part) => {
      const bits = Buffer.from(half.hex, "hex");
      for (let y = 0; y < 320; y++)
        for (let x = 0; x < 560; x++)
          if (bits[y * 70 + (x >> 3)] & (128 >> (x % 8)))
            reconstructed[(part * 320 + y) * 560 + x] = 0;
    });
    expect(reconstructed.equals(pixels)).toBe(true);
    for (const part of [0, 1])
      expect(
        pixels
          .subarray((part * 320 + 288) * 560, (part + 1) * 320 * 560)
          .every((v) => v === 255),
      ).toBe(true);
  });
  it("rechaza preferencias, datos gráficos y entradas no vigentes manipulados", async () => {
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
      ticketZpl(
        {
          ...ticket,
          layout: {
            ...ticket.layout!,
            halves: [
              { ...ticket.layout!.halves[0], hex: "^XZ~JA" },
              ticket.layout!.halves[1],
            ],
          },
        },
        event,
        settings,
      ),
    ).toThrow();
    await expect(
      renderTicketLayout({ ...ticket, credential: "x".repeat(200) }, event),
    ).rejects.toThrow("papel más grande");
  });
  it("texto hostil solo cambia los píxeles, nunca crea comandos ZPL", async () => {
    const hostile = { ...ticket, type_name: "VIP ^XZ~JA_" },
      e = { ...event, venue_name: "José ^XA^JUS" };
    hostile.layout = await renderTicketLayout(hostile, e);
    const output = ticketZpl(hostile, e, paperPreset("ticket70x40"));
    expect(output.match(/\^XA/g)).toHaveLength(2);
    expect(output.match(/\^XZ/g)).toHaveLength(2);
    expect(output).not.toContain("~JA");
    expect(output).not.toContain("^JUS");
  });
});
