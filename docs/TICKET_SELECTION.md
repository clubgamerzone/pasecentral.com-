# Selección de boletas y consecutivo visible (2026-11-20)

## Dónde y cómo usarlo
En Taquilla/Ventas → Ver entradas de la orden, la sección ¿Qué entradas quieres imprimir? muestra cuántas hay seleccionadas y cuántos tramos consumen. Quitar selección desmarca todas; marcar Incluir en impresión debajo de una boleta permite imprimir solo esa. Seleccionar todas recupera el lote. Botón Imprimir seleccionadas (N). Sin selección no permite imprimir; mientras se registra/envía o queda resultado pendiente se bloquea el cambio de selección para no mezclar trabajos.

La pantalla conserva visibles todas las boletas y sus estados. Solo las seleccionadas forman parte de las páginas de impresión del navegador y de QZ. Una seleccionada en papel pequeño sigue siendo dos tramos70x40. Se registra print_batch_request únicamente con esos IDs, con permisos/auditoría de servidor existentes. La descarga PDF y compartir PDF mantienen todas las entradas autorizadas: se advierte expresamente. Ctrl+P de un titular sin controles de taquilla conserva todas sus entradas. No cambia autorización ni acceso de comprador.

## Consecutivo por evento, independiente de entrega
El contador ya existía: tickets.event_sequence lo asigna issue() en la transacción de emisión con el contador del evento. visible_number incluye el mismo consecutivo al final (PC-prefijoevento-000005). No depende de imprimir, enviar correo, WhatsApp o descargar PDF; reimpresiones/reenvíos no consumen un número nuevo. Eventos distintos tienen contadores independientes. Es un número de emisión, no un total de ingresos válidos ni de dinero cobrado: incluye cortesías y no se reutiliza al anular. Puede haber saltos, no es consecutivo fiscal.

Ahora ticketDocument devuelve el entero event_sequence a los mismos destinatarios ya autorizados. ticketCounter() lo formatea con al menos seis dígitos. El encabezado superior del render común destaca BOLETA N.º 000005 junto a CONTROL DE INGRESO y mantiene el código completo y serial originales. El pie visible de cada tarjeta también lo muestra. Pantalla, PDF generado ahora y ZPL/ESC-POS comparten imagen y número. No se crea un contador basado en índice de selección ni se renumeran entradas antiguas. Correos/PDF ya enviados y payloads congelados de entrega no se modifican ni se reenvían automáticamente; al consultar/descargar de nuevo aparece el encabezado actual. La versión publicada/worker cloud no cambia hasta despliegue autorizado.

## Código y ejecución
- src/components/buyer.tsx: estado de selección por orden, conteo, botones, registro y adaptador con subconjunto.
- src/components/print-options.tsx: casillas por tarjeta y printTickets separado de vista completa; estilos screen en globals.css.
- src/lib/ticket-number.ts: formato puro sin dependencias de servidor.
- src/lib/service.ts: ticketDocument expone secuencia ya persistida, sin tocar issue/QR/precios.
- src/lib/ticket-layout.ts: encabezado superior, mismos tamaños/márgenes y raster compartido.

No se necesitan servicios, secretos, bibliotecas nuevas o migración. npm run dev:lan y recargarCtrl+F5. Preferencias aprobadasTEST-019D26/PR2/marcaoffset0/LT32 se conservan. No se inició captura/control de escritorio ni se envió papel para esta entrega.

## Verificación
71 pruebas Vitest (service,printing,printer-adapter,ticket-art) aprobadas. Incluyen secuencia que no cambia al reimprimir, raster cambia solo en encabezado superior al cambiar secuencia, misma mitad inferior y QR. Dos flujos Playwright aprobados: taquilla/PDF/acceso/caja, y orden con5entradas→seleccionar1→2páginas40mm→registrar1soloID→cancelar→QR/IDs/secuencia intactos→seleccionar todas5. Datos demo aislados, window.print simulado sin impresión física. Captura móvil390px y PNG de muestra con contador revisados sin solapamiento/overflow. PDF de Chromium respeta páginas seleccionadas. Lint/tipos/build/diff-check aprobados.

Falta ensayo físico del encabezado nuevo en impresora y del flujo QZ real. Aprobación anteriorTEST-019 corresponde al perfil/material y plantilla antes de este texto de encabezado, no equivale a una nueva lectura física de este cambio. Sin escrituras de pruebas cloud, commit/push/deploy por instrucción del propietario; commit pendiente.
