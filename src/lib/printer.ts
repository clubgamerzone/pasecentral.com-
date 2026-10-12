import type { Row } from "./db";
export interface PrinterAdapter {
  print(tickets: Row[], event: Row): Promise<void>;
}
export class BrowserPrintAdapter implements PrinterAdapter {
  async print() {
    window.print();
  }
}
export class QZTrayAdapter implements PrinterAdapter {
  async print(tickets: Row[], event: Row) {
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
    for (const t of tickets) {
      const qr = t.credential;
      const n = qr.length + 3;
      const text = `PASE CENTRAL\n${event.title}\n${t.type_name}\n${t.visible_number}\nSerial: ${t.security_serial}\n`;
      const raw =
        "\x1b@\x1ba\x01" +
        text +
        "\n\x1d(k\x04\x001A2\x00" +
        "\x1d(k\x03\x001C\x06" +
        "\x1d(k\x03\x001E0" +
        `\x1d(k${String.fromCharCode(n % 256)}${String.fromCharCode(Math.floor(n / 256))}1P0${qr}` +
        "\x1d(k\x03\x001Q0" +
        "\nUn ingreso por entrada\n\n\n\x1dV\x00";
      const bytes = new TextEncoder().encode(raw);
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
