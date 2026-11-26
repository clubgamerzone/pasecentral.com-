# Venta automática de boletas preimpresas

## Acceso

En **Taquilla**, pulsar **Escanear boleta preimpresa**. Todo el recorrido permanece en esa pantalla: `/box-office?mode=preprints`. **Boletas preimpresas** queda para administrar/imprimir lotes, con un enlace a Taquilla. La venta con datos del comprador y envío por correo sigue disponible dentro del lector en **Venta con datos / correo**.

## Operación

La venta rápida está seleccionada inicialmente. El operador recibe el pago y escanea el QR: después de Enter o 350 ms sin escritura una sola solicitud consulta, verifica y activa la preimpresa transaccionalmente. No se recargan los datos generales después de cada lectura exitosa. El QR identifica el evento; no hay que seleccionarlo para vender. El resultado aparece como aviso verde/rojo durante 2,5 segundos y queda también visible debajo del lector. El campo recupera el foco sin navegar a otra pantalla y permite continuar con otra boleta.

- **Efectivo recibido**: requiere caja abierta del operador en el evento de esa boleta. Si falta, ofrece abrirla y pide volver a escanear; no registra una venta antes de abrirla.
- **Transferencia verificada**: preparar referencia y marcar la verificación del importe antes de escanear. Se limpian ambos datos tras cada venta para evitar aplicar la verificación de un pago a otro. La aplicación no verifica por sí sola un movimiento bancario.
- La venta rápida no pide contacto ni envía correos. Para datos del comprador y entrega digital, usar **Venta con datos / correo**, que conserva confirmación manual.
- Activar una venta no registra asistencia: el QR debe leerse posteriormente desde **Control de acceso**, aplicando los horarios y permisos normales.

No se permite vender una boleta bloqueada o activada. El envío en curso impide doble ejecución por Enter/debounce. El input se vacía y recupera foco después de cada resultado, incluyendo rechazo por duplicado/bloqueo. Ante fallo recuperable se detiene el proceso y ofrece **Reintentar última lectura**, conservando la credencial/clave idempotente solo en memoria, sin dejar el QR escrito en el campo. Si la operación ya llegó al servidor, el reintento de esa misma solicitud devuelve la venta original. Una nueva solicitud con otra clave rechaza la boleta activada. No se reintenta automáticamente ante errores. Solo si el servidor informa falta de caja se consulta información adicional para ofrecer el diálogo del evento correcto.

## Implementación

- `src/components/preprint-quick-sale.tsx`: lectura, medio preparado, consulta/activación, aviso, foco y apertura de caja.
- `src/components/preprints.tsx`: selección entre venta rápida y formulario con datos.
- `src/components/operations.tsx`: selector entre venta nueva y lector dentro de Taquilla; Acceso también evita la recarga general tras cada escaneo.
- `src/components/app.tsx`: cuarto argumento opcional de `run`, `refreshAfter=false`, permite que lectores reciban directamente el resultado transaccional. El resto de operaciones conserva refresco por defecto; al navegar se actualizan datos.
- `src/lib/preprints.ts`: la activación devuelve metadatos mínimos autorizados de evento, precio y número, incluso en reintento idempotente. `service.ts` devuelve error explícito cuando falta caja. Se reutilizan autorización, precio del lote, caja, auditoría y transacción existentes; sin migración.
- `tests/e2e/preprint-quick-sale.spec.ts`: interacción del navegador con API aislada, sin escrituras cloud. Prueba lectura con/sin Enter, duplicado, caja cerrada, bloqueo, verificación por transferencia y reintento con la misma clave.
- `tests/e2e/preprints.spec.ts`: el recorrido anterior selecciona explícitamente la venta con datos para conservar cobertura de esa alternativa.

## Ejecución y verificación

`npm run dev:lan` sirve frontend y API en el puerto 3000. Pruebas de reglas: `npm run test -- tests/service.test.ts tests/preprints.test.ts`. Pruebas de navegador: `npx playwright test tests/e2e/preprint-quick-sale.spec.ts tests/e2e/preprints.spec.ts` con el servidor aislado definido en Playwright. No ejecutar fixtures de pruebas contra producción.

En esta entrega se emplearon configuraciones privadas `.local/playwright-quick-sale.config.ts` (desarrollo con API interceptada) y `.local/playwright-preprints-integration.config.ts` (copia aislada de código sin archivos de entorno, Next dev con Webpack en puerto 3100, modo demo y PostgreSQL embebido independiente). El intento inicial con `next start` fue rechazado por la protección existente contra modo demo en producción; no se debilitó esa protección. Webpack mostró un aviso de la dependencia opcional `lna` de QZ Tray; no impidió estos flujos y la compilación Turbopack de lanzamiento pasó. No se usó la sesión de Chrome del propietario ni se enviaron trabajos a la impresora o correos. Resultados finales en `docs/PROGRESS.md`. El propietario debe validar la lectura física con Honeywell antes de publicar. Sin commit ni push en esta entrega local.
