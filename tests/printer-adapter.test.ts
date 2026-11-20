import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderTicketLayout,
  type TicketLayout,
} from "../src/lib/ticket-layout";
import { QZTrayAdapter } from "../src/lib/printer";
import { paperPreset } from "../src/lib/print-settings";

const qz = vi.hoisted(() => ({
  security: {
    setCertificatePromise: vi.fn(),
    setSignatureAlgorithm: vi.fn(),
    setSignaturePromise: vi.fn(),
  },
  websocket: { isActive: () => true, connect: vi.fn() },
  configs: { create: vi.fn((name: string) => ({ printer: name })) },
  print: vi.fn(async () => undefined),
}));
vi.mock("qz-tray", () => ({ default: qz }));
const event = {
  title: "Ensayo ficticio",
  starts_at: "2026-11-19T02:00:00Z",
  venue_name: "Recinto de prueba",
};
const tickets = [1, 2, 3].map((n) => ({
  credential: `pc:PRUEBA-SIN-VALIDEZ-${n}`,
  visible_number: `PRUEBA-00000${n}`,
  security_serial: `PRUEBA-SERIAL-${n}`,
  type_name: "General",
  status: "valid",
  layout: undefined as TicketLayout | undefined,
}));
beforeEach(async () => {
  for (const ticket of tickets)
    ticket.layout = await renderTicketLayout(ticket, event);
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_QZ_PRINTER", "Impresora de prueba");
});
afterEach(() => vi.unstubAllEnvs());
describe("envío QZ por papel (transporte simulado, sin imprimir)", () => {
  it("envía tres formatos ZPL separados a la impresora configurada, sin ESC/POS ni corte", async () => {
    await new QZTrayAdapter().print(tickets, event, paperPreset("ticket70x40"));
    expect(qz.print).toHaveBeenCalledTimes(3);
    for (const [config, payload] of qz.print.mock.calls as unknown as [
      unknown,
      { data: string }[],
    ][]) {
      expect(config).toEqual({ printer: "Impresora de prueba" });
      const command = Buffer.from(payload[0].data, "base64").toString("utf8");
      expect(command).toContain("^MNM,0");
      expect(command).toContain("^LT32");
      expect(command.match(/\^LL320/g)).toHaveLength(2);
      expect(command.match(/\^XA/g)).toHaveLength(2);
      expect(command).not.toContain("\x1b@");
      expect(command).not.toContain("\x1dV");
    }
    const payloads = qz.print.mock.calls.map((call) => JSON.stringify(call));
    expect(new Set(payloads).size).toBe(3);
  });
  it("valida toda la orden antes de enviar y conserva ESC/POS para recibos", async () => {
    await expect(
      new QZTrayAdapter().print(
        [tickets[0], { ...tickets[1], credential: "" }],
        event,
        paperPreset("ticket70x40"),
      ),
    ).rejects.toThrow();
    expect(qz.print).not.toHaveBeenCalled();
    await new QZTrayAdapter().print(
      [tickets[0]],
      event,
      paperPreset("receipt80"),
    );
    const calls = qz.print.mock.calls as unknown as [
      unknown,
      { data: string }[],
    ][];
    const command = Buffer.from(calls[0][1][0].data, "base64").toString("utf8");
    expect(command).toContain("\x1b@");
    expect(command).toContain("\x1dv0\x00");
  });
});
