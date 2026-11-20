# Papel y configuración de impresión

Actualización vigente2026-11-19: boleta doble aprobada en página/PDF/impresión. Guía completa: [TICKET_DOUBLE_LAYOUT.md](TICKET_DOUBLE_LAYOUT.md). No se ha impreso el nuevo diseño; no confundir pruebas RAW previas con homologación de esta plantilla.

## Dónde se usa

Taquilla → venta emitida → pantalla de entradas (`/tickets/[orderId]`) → **Papel e impresora**. Visible para operadores con permiso de venta en ese evento. Elegir papel antes de pulsar Imprimir o QZ Tray. La selección se recuerda en ese navegador, no en todas las taquillas ni en la cuenta; no se guarda ningún QR o documento en localStorage.

| Papel | Salida directa QZ | Ajustes iniciales |
| --- | --- | --- |
| Recibo 80 mm | ESC/POS raster del diseño | 70mm de contenido centrado; prueba física pendiente |
| Boleta doble: dos tramos70 ×40mm por persona (predeterminado) | Dos formatos ZPL GFA de40mm en un trabajo por entrada | Marca negra inferior, referencia0, ajuste+4mm, oscuridad26,50,8mm/s; TEST-019 confirmado físicamente por propietario para RAW ZPL |
| Boleta 70 × 100 mm | ZPL, STARPOS IF4 203 dpi | Marca negra, desplazamiento 0, oscuridad inicial 18, 50,8 mm/s; calibración física pendiente |

Cambiar tamaño carga sus ajustes iniciales. En **Alineación y material** se puede seleccionar marca negra, gap o continuo, ajuste vertical de -5 a +5 mm y oscuridad de 1 a 26. Los ajustes se validan incluso si se manipula almacenamiento local. Elegir detección según el material real y calibrar con cada cambio. No suponer que la calibración del papel pequeño sirve en el grande.

La referencia física es TEST-013: propietario confirmó posición correcta de una muestra 70×40. El propietario también confirmó TEST-014-1/2/3 alineadas y legibles en Honeywell para la plantilla RAW anterior. El diseño doble nuevo, sus gráficos y transporte QZ real siguen pendientes de ensayo físico. Se conserva la lección confirmada: el papel inicial estaba al revés; la cara imprimible debe quedar hacia el cabezal. No se certifica una impresora por el nombre del driver ni por cola vacía. Historial: `docs/PRINTER_STAR_IF42.md`.

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
- `tests/printer-adapter.test.ts`: QZ simulado, tres payloads ZPL distintos, protocolo correcto por papel y prevalidación de toda la orden antes de enviar. No certifica el puente QZ ni el papel físico.
- `tests/e2e/flows.spec.ts`: persistencia de papel y límites de contenido en ambos tamaños dentro del ensayo de taquilla/PDF/acceso/caja.

Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npx playwright test --grep "taquilla vende"` y `npm run build`. Playwright usa servidor y datos ficticios aislados, nunca Supabase conectado. Para instalar su navegador: `npx playwright install chromium`.

Antes de operar: calibrar papel, imprimir tres boletas consecutivas, verificar ambas perforaciones y todos los datos; leer cada QR con EDA51. Probar especialmente títulos largos, varias entradas por orden y reimpresión. El 70×100 requiere papel real y ensayo propio antes de vender.

Resultado posterior: el propietario confirma tres muestras consecutivas TEST-014-1/2/3 alineadas y tres QR leidos por Honeywell, con plantilla RAW local basada en TEST-013. Esto valida ese ensayo de papel70x40; el nuevo diseno de app y transporte QZ completo siguen requiriendo prueba fisica propia. No se homologa70x100. Cambios actuales solo locales por instruccion del propietario.


## Configuración vigente aprobada: TEST-019 (2026-11-19)
Propietario confirma TEST-019 perfecta: boleta doble RAW ZPL con plantilla actual, dos tramos70x40, marca negraoffset0, LT32/+4mm, oscuridad26,50.8mm/s,ribbon y cara imprimible correcta. Sustituye la referencia provisionalD16para este material. No extrapolar a nuevo papel,70x100,Chrome/GDI o QZ real. No se envió otra muestra tras aprobación.

App: DEFAULT_PRINT_SETTINGS y preset ticket70x40 de src/lib/print-settings.ts pasan a26; preferencias v3 recuperan v2 conservando papel/alineación y cualquier oscuridad distinta de16, y actualizan solo el anterior16de70x40a26. Configuración v3 elegida después por operador conserva su valor, incluido16; no se actualiza driverWindows desde web. PrintOptions muestra referenciaTEST-019. Pruebas printing/printer-adapter7/7, lint,tipos,buildaprobados; sin emisión/cloud/push. Recargar conCtrl+F5para aplicar. Fecha de muestra y detalles en PRINTER_STAR_IF42.md.
