import type { Row } from "./db";
import {
  DEFAULT_PRINT_SETTINGS,
  parsePrintSettings,
  type PrintSettings,
} from "./print-settings";
import { ticketZpl, assertTicketLayout } from "./ticket-zpl";
export interface PrinterAdapter {
  print(tickets: Row[], event: Row, settings?: PrintSettings): Promise<void>;
}
export class BrowserPrintAdapter implements PrinterAdapter {
  async print() {
    window.print();
  }
}
export class QZTrayAdapter implements PrinterAdapter {
  async print(tickets: Row[], event: Row, input = DEFAULT_PRINT_SETTINGS) {
    const settings = parsePrintSettings(input);
    for (const ticket of tickets) {
      if (
        !ticket.credential ||
        (ticket.status !== "valid" &&
          !(ticket.preprinted && ticket.status === "stock")) ||
        !ticket.visible_number ||
        !ticket.security_serial
      )
        throw new Error(
          "Solo se imprimen entradas vigentes con identificadores completos",
        );
      if (ticket.layout) assertTicketLayout(ticket.layout);
    }
    // Prepare the whole order before submitting anything to the printer.
    const labels =
      settings.paper === "receipt80"
        ? null
        : tickets.map((t) =>
            ticketZpl(
              {
                credential: t.credential,
                visible_number: t.visible_number,
                security_serial: t.security_serial,
                type_name: t.type_name,
                status: t.status,
                preprinted: t.preprinted,
                layout: t.layout,
              },
              {
                title: event.title,
                starts_at: event.starts_at,
                venue_name: event.venue_name,
                address: event.address,
              },
              settings,
            ),
          );
    const qz = (await import("qz-tray")).default;
    qz.security.setCertificatePromise(async (resolve, reject) => {
      try {
        const res = await fetch("/api/printing/certificate");
        if (!res.ok) throw new Error("Certificado QZ no configurado");
        resolve(await res.text());
      } catch (e) {
        reject(e instanceof Error ? e.message : String(e));
      }
    });
    qz.security.setSignatureAlgorithm("SHA512");
    qz.security.setSignaturePromise((data) => async (resolve, reject) => {
      try {
        const res = await fetch("/api/printing/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: data }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        resolve(body.signature);
      } catch (e) {
        reject(e instanceof Error ? e.message : String(e));
      }
    });
    if (!qz.websocket.isActive()) await qz.websocket.connect();
    const printer = process.env.NEXT_PUBLIC_QZ_PRINTER;
    if (!printer) throw new Error("Falta impresora QZ configurada");
    const config = qz.configs.create(printer);
    for (const [index, t] of tickets.entries()) {
      const qr = t.credential;
      const n = qr.length + 3;
      const text = `PASE CENTRAL\n${event.title}\n${t.type_name}\n${t.visible_number}\nSerial: ${t.security_serial}\n`;
      const raw =
        labels?.[index] ??
        (t.layout
          ? "\x1b@\x1ba\x01\x1dv0\x00" +
            String.fromCharCode(70, 0, 128, 2) +
            t.layout.halves
              .map((h: Row) =>
                h.hex
                  .match(/../g)
                  .map((v: string) => String.fromCharCode(parseInt(v, 16)))
                  .join(""),
              )
              .join("") +
            "\n\n\n\x1dV\x00"
          : "\x1b@\x1ba\x01" +
            text +
            "\n\x1d(k\x04\x001A2\x00" +
            "\x1d(k\x03\x001C\x06" +
            "\x1d(k\x03\x001E0" +
            `\x1d(k${String.fromCharCode(n % 256)}${String.fromCharCode(Math.floor(n / 256))}1P0${qr}` +
            "\x1d(k\x03\x001Q0" +
            "\nUn ingreso por entrada\n\n\n\x1dV\x00");
      const bytes =
        settings.paper === "receipt80" && t.layout
          ? Uint8Array.from(raw, (c: string) => c.charCodeAt(0))
          : new TextEncoder().encode(raw);
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      await qz.print(config, [
        {
          type: "raw",
          format: "command",
          flavor: "base64",
          data: btoa(binary),
        },
      ]);
    }
  }
}
