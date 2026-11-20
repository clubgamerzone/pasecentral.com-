# Boleta doble integrada (2026-11-19)

## Qué cambió y dónde encontrarlo

El diseño aprobado en propuesta06 ya se integra en la página de entradas y sus salidas. Cada persona mantiene una sola entrada y un QR. El papel predeterminado es **Boleta doble · 2 tramos de 70 × 40 mm**: talón superior con QR, localidad/fase, precio histórico aplicado, lugar/dirección e identificadores; parte inferior con arte del evento, fecha/hora/lugar e identificadores, sin etiqueta Recuerdo del comprador y sin repetir QR. Total lógico70×80mm, separación central física existente.

- Administrador/gestor: Mis eventos → evento → Evento → **Logo y diseño para boletas**. Subir PNG/JPG/WebP horizontal de hasta4MB; vista previa inmediata y versión guardada monocromática. La imagen es independiente de portada/galería. Puede incluir logo y equipos superpuestos en un solo archivo. Sin diseño, se usa título del evento.
- Frase al pie de la boleta: se guarda con la carga de imagen; después se modifica con Guardar frase. Predeterminada VIVE EL MOMENTO, hasta40 caracteres. Quitar diseño elimina arte/frase de próximas descargas/reimpresiones, sin alterar entradas o ventas.
- Taquilla/entradas: al emitir o abrir una orden, la pantalla muestra el diseño completo, la separación de las dos mitades y el estado. Papel e impresora conserva selector de formatos y ajustes avanzados. Se inicia con70×40 doble, oscuridad16 y ajuste vertical+4mm, según ensayos previos. Nueva clave de preferencias v2 ignora configuración antigua v1; después recuerda la selección nueva por navegador.
- Descargar/compartir PDF: una página70×80mm por persona, usando la misma imagen. El correo conserva QR incrustado y PDF individual con esta composición.

## Mapa del código

- `src/lib/ticket-layout.ts`: render único SVG escapado → PNG560×640 monocromático con sharp/qrcode existentes. QR con margen de4 módulos, módulos enteros; rechaza credenciales que no quepan legiblemente. El QR aparece solo en la mitad superior. Estado usado/anulado superpuesto cuando corresponde. No se registra en logs.
- `src/lib/service.ts` ticketDocument: devuelve unit_price_cop,phase_name y type_name del snapshot order_items, nunca del precio vigente posterior; arte autorizado incorporado como PNG. Misma credencial/serial/consecutivo; no hay emisión nueva por mitad.
- `src/app/api/tickets/route.ts`: JSON privado no-store con imagen completa y mapas de bits por mitad, además del QR. Conserva autorización existente de titular, taquilla o enlace secreto revocable.
- `src/lib/pdf.ts`: incrusta esa misma imagen en70×80mm por entrada. No redibuja texto con otra plantilla. Impresión física desde PDF requiere ajustar controlador; no aplicar sin ensayo la calibración de la app.
- `src/components/print-options.tsx` PaperTickets y buyer.tsx: vista de pantalla y navegador comparten la imagen. En70×40, muestra/corta dos mitades e incluye el ajuste vertical; navegador produce dos páginas40mm por persona.70×100 usa la composición completa con margen; recibo80 la centra en70mm. No se aplican estilos globales para deformar imagen.
- `src/lib/ticket-zpl.ts` y printer.ts: compacta a1bit, valida dimensiones/hex y envía dos formatos ZPL GFA con LL320 en un trabajo por persona. Nunca LL640 para saltar marcas intermedias. Preserva sensor/calibración elegidos, sin EEPROM/calibrar/corte.70×100 usa una imagen completa; ESC/POS80 usa raster. Transporte QZ requiere instalación/certificado/firma ya documentados; no está homologado por generar código.
- `src/components/ticket-art-editor.tsx` + `/api/events/[eventId]/ticket-art`: GET/POST/PATCH/DELETE, identidad y permiso manage en servidor, CSRF, rate limit, normalización de imagen. SVG no admitido. Edición bajo bloqueo de evento y auditada; guía de códigos actualizada.
- `src/lib/ticket-art.ts`, migración013: asset pequeño normalizado hasta480×120px en event_ticket_art, bytea limitado a350000bytes, RLS habilitado y sin grants para anon/authenticated. Guardar en SQL permite al worker sin sesión preparar PDF sin nuevos secretos/buckets; no almacena originales ni QR. state.ts devuelve solo existencia/fecha/frase. Reset/backup privado incluye la tabla; bytes JSON deben reconstruirse como Buffer al restaurar, nunca publicarse.

## Configuración de Retrofest y entorno

Migración013 aplicada a Supabase staging compartido, previa copia cifrada verificada en .local/backups; eventos existentes comparados sin cambios y grants cliente0. El arte aprobado de Retrofest y su frase se asignaron únicamente al evento cuyo slug/nombre se verificaron, mediante setTicketArt y rol de administrador del propietario. Sin compras, entradas nuevas, emails o pagos de ensayo en cloud. No se modificó portada ni información del evento. Script privado .local/migrate-ticket-art.ts.

Código permanece local por instrucción del propietario. La página publicada no cambia hasta un push/despliegue autorizado. La migración/arte son compatibles con la versión anterior, que no consulta esta tabla.

## Prueba y límites

`npm test`: permisos/RLS, formatos de imagen rechazados, normalización blanco/negro, precio histórico, una entrada por persona, PDF de tamaño correcto y reconstrucción bit a bit de la imagen a partir de los datos ZPL. Reimpresión conserva contenido. `npx playwright test`: carga/edición privada por gestor, denegación al vendedor, compra/venta, pantalla doble, PDF, variantes de papel, QR distintos por persona y navegación/permisos previos. QZ se prueba simulado, sin imprimir.

Inspeccionar capturas ticket-double-desktop/mobile en test-results (datos demo aislados) y render real de muestra privado .local/boleta-double-implemented-preview.png. Resultados finales en PROGRESS.md.

**No se ha enviado este formato a la impresora.** Aún hay que probar parejas consecutivas, calidad del arte con oscuridad16 y lectura con Honeywell, además del flujo QZ real. Los detalles pequeños del arte pueden perderse en203dpi. La vista/PDF/ZPL comparten diseño y píxeles, pero el resultado físico depende de material, driver, escala y registro del sensor.70×100 y ESC/POS80 siguen pendientes de prueba en sus dispositivos/materiales. No afirmar homologación por la prueba de código.

Comprobación final adicional: vista/estilos de impresión también disponibles a titulares que usen Ctrl+P (ya pueden descargar/imprimir su PDF); botones operativos/QZ y registros de impresión siguen sujetos a permisos de taquilla. Para70x100, la vista incorpora el ajuste vertical seleccionado igual que la salida. Repetidos2 flujos comprador/taquilla tras ese ajuste: aprobados. No se imprimió papel.

## Lectura de la vista previa de Chrome
La boleta doble se muestra en dos páginas de70x40 por persona: control superior y parte del cliente. Para5 entradas se esperan10 páginas/tramos, no10 personas. Si la primera página visible está parcialmente por encima de la ventana de previsualización, desplazar al inicio antes de concluir que hay recorte. Verificar70x40,escala100%,márgenes0 y encabezado/pie desactivados. Una composición dividida entre control y arte del cliente es intencional; QR/letras cortados dentro de los bordes de una página completa sí requieren corregir configuración o registro. La vista previa no confirma la salida física, ni el avance correcto sobre marcas negras. Aclaración de captura del propietario, sin nueva impresión o cambio de código.

## Cancelar el diálogo no confirma impresión (2026-11-19)
Corregido Tickets/print en src/components/buyer.tsx: window.print() no indica si el usuario imprimió o canceló; su retorno y afterprint no prueban envío o papel. El trabajo browser queda requested hasta confirmación explícita, sin enviar print_result submitted. Se muestra ¿Qué ocurrió con la impresión? encima de las boletas: Papel impreso y verificado → confirmed; No se imprimió / cancelé → failed (estado existente incluye cancelación). Se requiere resolver el resultado antes de volver a solicitar impresión; si falla registrar resultados parciales, conserva pendientes y no da éxito falso.

QZ conserva submitted solo al aceptar el adaptador el trabajo; no equivale a impresión física. Mensaje diferente y comprobación manual posterior. Fallos de aplicación/envío se registran como failed según el flujo existente. No se cambió esquema ni se reinterpretaron trabajos históricos: submitted previo no demuestra papel.

Prueba E2E de taquilla ampliada: window.print simulado como retorno sin resultado, ninguna transición submitted, cancelación registrada como failed, estado terminal no puede reabrirse, y nueva solicitud confirmada únicamente al pulsar verificación. No abre diálogo real ni envía papel; el ensayo físico anterior no se repite. El resto del flujo vende/descarga/PDF/acceso/caja. Resultados finales PROGRESS.md.

## Apertura del diálogo y registro por lote (2026-11-19)
Antes de window.print, Tickets registraba cada entrada con print_request y useApp.run esperaba además una recarga completa de /api/state por entrada. Los logs de la sesión LAN mostraban aproximadamente1.8–1.9s por comando y2.6–2.7s por recarga: ese recorrido se repetía según la cantidad, antes de que Chrome pudiera abrir el diálogo. No es una medición de la impresora.

Ahora buyer.tsx solicita print_batch_request con todos los IDs en una llamada; validation.ts admite1–500 IDs únicos y service.ts bloquea las entradas en orden, verifica existencia y permiso de venta en cada evento, inserta todos los print_jobs y sus auditorías dentro de una transacción. Un lote inválido/no autorizado no deja trabajos parciales. No se emiten entradas ni cambian sus credenciales. print_request individual sigue compatible. app.tsx omite refresh únicamente para print_request, print_batch_request y print_result porque no alteran los datos del panel; el resto de comandos conserva su recarga. El botón muestra Preparando impresión mientras espera. El registro continúa siendo previo al diálogo y depende de red/Auth/PostgreSQL; Chrome/driver pueden añadir tiempo al preparar vista previa.

Verificación:61 pruebas de service.test.ts aprobadas, incluido lote de3 entradas, auditoría, reimpresión, inexistente, duplicado y mezcla de eventos sin permiso con rollback. Playwright taquilla/PDF/acceso/caja aprobado: una sola solicitud de lote, cero recargas de state antes del diálogo simulado y ninguna confirmación automática por cerrar. Lint y tipos aprobados. Sin impresión física ni escrituras de pruebas en staging; no se promete un tiempo nuevo de hardware por estas pruebas. Resultado de build en PROGRESS.md.

### Driver Windows y registro físico (2026-11-19)
Foto física del propietario evidencia QR cortado por perforación. Driver del usuario tenía70x40correcto pero Material=Continuo: se guardó No continuo, Sensor de marcas y ajuste superior0mm, dejando +4mm solo en la plantilla web. Verificado reabriendo preferencias, sin imprimir ni recalibrar. Defaults globales consultados por API no coinciden con preferencias efectivas del usuario; no confundirlos. Nuevo aviso permanente en PrintOptions sobre driver,70x40portramo,100%,márgenes0 y encabezados/pies desactivados; QZ y navegador usan rutas distintas. Detalle/ensayo pendiente en PRINTER_STAR_IF42.md. Chromium exporta2páginas40mmporentrada; esto no demuestra registro físico del equipo. Repetir primero1entrada/2páginasantes de lote.

### Aprobación física posterior TEST-019 (2026-11-19)
Propietario confirma perfecta la muestra doble enviada por WinspoolRAWconZPLdeapp:2tramos70x40,oscuridad26,velocidad50.8mm/s,marcaoffset0/LT32. Esta aprobación reemplaza pendientes de corte/calidad de las secciones anteriores para ese perfil/material y transporte. App usa default26y almacenamiento depreferenciasv3conrecuperaciónsegurav2, guíaPRINT_PAPER_SETTINGS.md. No se ha homologado por esta aceptación la rutaChrome/GDI ni QZconectadodesdelaweb; no imprimir lotes por esas rutas como si estuvieran probadas.
