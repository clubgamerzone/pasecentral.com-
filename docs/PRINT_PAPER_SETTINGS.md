# Papel y configuración de impresión

## Dónde se usa

Taquilla → venta emitida → pantalla de entradas (`/tickets/[orderId]`) → **Papel e impresora**. Visible para operadores con permiso de venta en ese evento. Elegir papel antes de pulsar Imprimir o QZ Tray. La selección se recuerda en ese navegador, no en todas las taquillas ni en la cuenta; no se guarda ningún QR o documento en localStorage.

| Papel | Salida directa QZ | Ajustes iniciales |
| --- | --- | --- |
| Recibo 80 mm | ESC/POS existente | Sin cambio de comportamiento |
| Boleta 70 × 40 mm | ZPL, STARPOS IF4 203 dpi | Marca negra inferior, referencia de marca 0, desplazamiento vertical +4 mm, oscuridad 26, 50,8 mm/s |
| Boleta 70 × 100 mm | ZPL, STARPOS IF4 203 dpi | Marca negra, desplazamiento 0, oscuridad inicial 18, 50,8 mm/s; calibración física pendiente |

Cambiar tamaño carga sus ajustes iniciales. En **Alineación y material** se puede seleccionar marca negra, gap o continuo, ajuste vertical de -5 a +5 mm y oscuridad de 1 a 26. Los ajustes se validan incluso si se manipula almacenamiento local. Elegir detección según el material real y calibrar con cada cambio. No suponer que la calibración del papel pequeño sirve en el grande.

La referencia física es TEST-013: propietario confirmó posición correcta de una muestra 70×40. Pruebas de tres copias consecutivas, nuevo diseño con datos completos y QR real siguen pendientes. Se conserva la lección confirmada: el papel inicial estaba al revés; la cara imprimible debe quedar hacia el cabezal. No se certifica una impresora por el nombre del driver ni por cola vacía. Historial: `docs/PRINTER_STAR_IF42.md`.

## Navegador y QZ Tray

El botón Imprimir abre el diálogo del navegador con la plantilla seleccionada. Configurar también el tamaño en Windows/Chrome, escala 100 %, sin encabezado/pie y sin márgenes añadidos. El navegador no configura el sensor, la temperatura ni la velocidad del hardware; esos controles se aplican en la salida ZPL de QZ Tray. El +4 mm físico no garantiza idéntico registro en el camino del controlador del navegador.

QZ Tray requiere instalación local y configuración del servidor: `NEXT_PUBLIC_QZ_PRINTER` con nombre exacto de cola, `QZ_CERTIFICATE_PEM` y `QZ_PRIVATE_KEY_PEM`. Estos secretos siguen exclusivamente en servidor. Para este equipo la cola ensayada es `STAR POS STAR-iF42 (ZPL 203 dpi)` en USB002, con driver iDPRT iF4 (203 dpi), emulación ZPL provisional. El nombre público se fija al compilar; el firmante restringe a esa impresora y exige usuario con permisos. Si no está configurado el nombre, no aparece el botón QZ.

El formato determina el lenguaje: 80 mm envía ESC/POS; 70 mm envía ZPL. No enviar recibos ESC/POS a la STARPOS sin compatibilidad comprobada. ZPL no activa cuchilla, recalibración ni guardado EEPROM. El ticket conserva número, serial y credencial en reimpresiones; cada llamada envía una copia de cada entrada. La solicitud y resultado se registran mediante `print_request` / `print_result`; confirmar físicamente solo después de revisar el papel. La aceptación de QZ no equivale a papel impreso. Si una orden queda parcialmente impresa tras error local, revisar antes de reintentar para no repartir duplicados del mismo QR.

## Implementación y pruebas

- `src/lib/print-settings.ts`: presets, validación y clave local versionada.
- `src/components/print-options.tsx`: selector persistente, controles y plantillas para diálogo.
- `src/lib/ticket-zpl.ts`: plantillas ZPL; texto UTF-8 en hexadecimal para impedir inyección de comandos, QR con margen de cuatro módulos, tamaño calculado según contenido; rechaza boletas no vigentes o credenciales que no caben.
- `src/lib/printer.ts`: QZ firmado, selección ESC/POS/ZPL según papel, prepara formatos antes del primer envío.
- `src/components/buyer.tsx`: selector y envío en pantalla de entradas; PDF digital y compartir no cambian.
- `tests/printing.test.ts`: identificadores/reimpresión, inyección ZPL, validación y límites de QR.
- `tests/e2e/flows.spec.ts`: persistencia de papel y límites de contenido en ambos tamaños dentro del ensayo de taquilla/PDF/acceso/caja.

Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npx playwright test --grep "taquilla vende"` y `npm run build`. Playwright usa servidor y datos ficticios aislados, nunca Supabase conectado. Para instalar su navegador: `npx playwright install chromium`.

Antes de operar: calibrar papel, imprimir tres boletas consecutivas, verificar ambas perforaciones y todos los datos; leer cada QR con EDA51. Probar especialmente títulos largos, varias entradas por orden y reimpresión. El 70×100 requiere papel real y ensayo propio antes de vender.
