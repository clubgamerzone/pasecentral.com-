# Compra de impresora para entradas de concierto — 2026-10-14

Solicitud del propietario: entradas físicas bonitas, con papel tipo concierto; no solo recibos de caja. Recomendación provisional: cotizar BOCA Lemur-C en configuración Ticket Printer de 300 dpi para taquilla de volumen moderado, y BOCA Lemur 300 dpi si se requiere mayor volumen o cartulina más gruesa. Alternativa Zebra ZD421 de transferencia térmica (ZD421t), 300 dpi, con soportes no adhesivos compatibles. STIMARE STIMA CLS es otra familia dedicada a conciertos/taquilla, sujeta a cotización/configuración.

La presentación depende del soporte y diseño: tickets/cartulina compatibles preimpresos en color por proveedor/imprenta, con zona blanca para QR y datos variables negros, perforación/talón si se desea. Impresoras térmicas de esta selección no imprimen fotografías a todo color como una impresora CMYK. No comprar cartulina genérica ni decidir solo por gramaje: confirmar espesor, tratamiento térmico o ribbon, marca negra, ancho/largo, alimentación/corte y configuración exacta.

BOCA Lemur-C Ticket: 203 dpi base/300 opcional, tickets plegados, ancho estándar 2–3.25 pulgadas, espesor de papel .004–.0075 pulgadas (aprox. .10–.19 mm). No confundir con Lemur-C Receipt. BOCA Lemur: 203/300 dpi, rollo o plegado, espesor .004–.011 pulgadas (aprox. .10–.28 mm), opciones de cortador y Ethernet. Zebra ZD421 admite tag stock no adhesivo, 300 dpi opcional, espesor hasta .19 mm; confirmar variante térmica de transferencia y ribbon/cortador adecuados, no confundir etiquetas adhesivas con entradas.

Fuentes oficiales consultadas:
- https://www.bocasystems.com/lemurcticket.html
- https://www.bocasystems.com/lemur.html
- https://www.bocasystems.com/tickets.html
- https://stimare.net/products/desktop-ticket-printers/
- https://www.zebra.com/us/en/products/spec-sheets/printers/desktop/zd421-series.html
- https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/media/types-of-thermal-media.html

Presupuesto en COP, número de boletas físicas por evento, proveedor/soporte local y disponibilidad de consumibles pendientes; no se verificaron precios finales/importación/stock en Colombia. Cotizar equipo + papel personalizado + repuestos + soporte, y pedir muestra impresa con QR para leer con Honeywell EDA51 antes de compra. Recomendación no equivale a homologación.

Estado real del proyecto verificado en src/lib/printer.ts y docs/OPERATIONS.md: impresión navegador y QZ Tray con comandos ESC/POS para 80 mm. BOCA usa FGL y Zebra ZPL/EPL; será necesario adaptar protocolo/driver, plantilla y tamaño/sensores a modelo elegido. No basta cambiar nombre de impresora; no se modificó código ni se probó hardware en esta consulta. No se compró/configuró ningún dispositivo. Se mantiene el plan original de impresión como alternativa de ensayo, sin presentarlo como decisión comercial final.
