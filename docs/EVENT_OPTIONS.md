# Aforo y horarios opcionales — 2026-11-19

## Cómo usarlo

En **Mis eventos → Crear evento** (`/admin/events/new`) y **Evento → Editar evento**:

- **Aforo ilimitado**: inicialmente desactivado al crear. Activado oculta el número de aforo total y guarda `capacity = NULL`. No crea un cupo ficticio enorme. Los cupos de localidades siguen vigentes; el texto lo aclara. Al volver a aforo limitado, el servidor rechaza un valor menor que lo comprometido o que el cupo de una localidad.
- **Definir fin del evento**: inicialmente desactivado al crear. Desactivado no muestra fecha y guarda `ends_at = NULL`; activado exige fecha posterior al inicio.
- **Apertura de puertas: misma hora de inicio del evento**: inicialmente activado al crear. Oculta la hora adicional y envía exactamente el inicio. Desactivado muestra una hora obligatoria en el mismo día del inicio. Editar deduce la selección comparando ambas fechas guardadas.
- **Definir cierre de puertas**: inicialmente desactivado al crear. Desactivado oculta fecha y guarda `admission_ends_at = NULL`; activado exige fecha posterior a la apertura y permite día siguiente.

Se usan toggles accesibles, con foco visible y etiquetas. Al editar, los campos se muestran según los datos existentes: no se borran fechas por abrir el formulario. Los campos ocultos no participan en la validación del navegador ni envían sus valores anteriores al guardar. Los eventos existentes conservan todos sus datos al migrar.

## Efectos operativos

Ventas mantienen transacciones, bloqueo por evento, reservas y verificación por localidad. Un evento ilimitado omite únicamente el límite global; una localidad agotada sigue bloqueando ventas. No cambia cantidad máxima por orden, precios ni pagos.

Validación de acceso siempre respeta apertura y estado del evento. Si hay cierre explícito, se usa ese cierre. Si no hay cierre explícito pero hay fin programado, ese fin actúa como límite de acceso. Si faltan ambos, no se inventa una fecha: finalizar/cancelar el evento bloquea el acceso. No hay ingreso offline ni excepciones para QR usado/anulado.

Transferencias no interpretan una fecha final nula como 1970. Reportes y catálogo muestran disponibilidad global sin límite con texto, sin tratarla como cero ni generar porcentaje de ocupación engañoso. Localidades siguen mostrando sus existencias finitas. Las fases de precio continúan requiriendo fechas propias, aunque el evento no tenga fin programado.

## Código y base de datos

- `src/components/enhanced-fields.tsx`: EventCapacity, EventSchedule y normalización de horarios; controles compartidos entre creación y edición.
- `src/components/operations.tsx`, `event-editing.tsx`: integración de controles y precios cuando no existe fin del evento.
- `src/lib/validation.ts`: aforo/fechas finales admiten NULL; fechas y números finitos siguen validados.
- `src/lib/service.ts`: cupo global opcional, cupos de localidad, edición segura y ventana de acceso.
- `src/lib/state.ts`, `analytics.ts`, `src/components/analytics.tsx`, `app.tsx`, `buyer.tsx`: presentación y agregación sin límite.
- `src/lib/transfers.ts`: fecha final opcional.
- `src/app/globals.css`: aspecto de toggles `.event-option`.
- `supabase/migrations/010_optional_event_limits.sql`: elimina NOT NULL de capacity/ends_at/admission_ends_at en events. CHECK existentes siguen rechazando valores finitos inválidos.

Aplicada a Supabase staging/sandbox con script privado `.local/migrate-event-options.ts`, guardando y verificando respaldo cifrado antes de migrar: `.local/backups/event-options-2026-11-19T06-43-30.427Z/before.enc`. Incluye configuración de columnas, constraints y filas de eventos previas. Verificado: filas de eventos idénticas después, tres columnas nullable. No se cambió Auth ni se crearon eventos de prueba conectados. Los tests usaron PGlite aislado; una base demo persistente aplica migraciones al arrancar.

Comando de migración versionado para otro ambiente autorizado: `npm run db:migrate`. No deshacer NOT NULL sin revisar primero las filas nuevas con NULL. La copia cifrada se verificó, no se ensayó restauración completa.

## Verificación

`tests/event-options.test.ts` comprueba NULL persistente, fechas inválidas, venta/escaneo sin finales, cupo de localidad y cambio de ilimitado a limitado, reportes sin porcentajes inventados y bloqueo al finalizar. `tests/e2e/event-options.spec.ts` comprueba campos ocultos/visibles, guardado y recarga al crear/editar; regresiones anteriores se actualizaron para activar opcionales explícitamente.

Resultado: **102 Vitest, 19 Playwright**, lint, tipos y build aprobados. No prueba física nueva de impresora ni Honeywell necesaria por este formulario. El código queda local, sin commit/push/despliegue por instrucción del propietario. La migración de Supabase sí está aplicada porque el servidor local usa esa base compartida; el hosting anterior no debe darse por actualizado hasta publicar el código compatible.

## Ampliacion: enlace, miniaturas y localidades ilimitadas (2026-11-19)
El antiguo campo Direccion corta ahora se llama Enlace del evento, con placeholder tuevento y ejemplo pasecentral.com/eventos/tuevento debajo, asociado al campo como descripcion accesible. El dominio es ilustrativo, no publicacion verificada. Mantiene slug unico con minusculas, numeros y guiones, sin espacios, maximo100 caracteres. Direccion normal sigue siendo ubicacion fisica. app.tsx acepta /eventos y /eventos/[slug] ademas de /events con los mismos permisos y reglas de publicacion.
Portada y galeria muestra miniaturas locales al seleccionar archivos con estado Subiendo. Cada archivo confirmado refresca imagen guardada; fallo muestra No guardada y permite descartar vista previa. URLs temporales revocadas al reemplazar/descartar/desmontar, sin hacer publico Storage. Limites8imagenes/4MB, JPG/PNG/WebP, validados tambien en cliente. Galeria administrativa con miniaturas de maximo200x120px. Codigo EventDetails de event-editing.tsx y globals.css.
Localidades de un evento ilimitado permiten Cupo ilimitado de la localidad al agregar y Cupo ilimitado de [nombre] al editar. Oculta numero y guarda capacity=NULL; permite combinar localidades finitas e ilimitadas. Tabla/taquilla muestran Ilimitado/Ilimitadas. Servidor rechaza localidad ilimitada en evento finito; rechaza limitar evento mientras haya localidades ilimitadas; al limitar localidad exige cupo suficiente para ventas/reservas comprometidas. Transacciones/bloqueos y limite por compra permanecen.
Implementacion: TicketCapacity/enhanced-fields.tsx, EditTicketType/event-editing.tsx, operations.tsx, typeCapacity/validation.ts, stock/edicion/service.ts. Migracion011_unlimited_ticket_types.sql aplicada a Supabase staging con respaldo cifrado y filas de localidades sin cambios. Script privado .local/migrate-locality-options.ts; copia .local/backups/locality-options-2026-11-19T07-01-05.710Z/before.enc. Sin fixtures cloud creados.
Pruebas:103Vitest,20Playwright,lint,tipos y build aprobados. E2E retiene POST de imagen para verificar vista previa antes de guardar y mide miniatura persistida; caso de localidades ilimitadas/editables y ambas rutas publicas. Unitarios cubren padre limitado, cupos bajo comprometidas y vuelta a limites finitos. Sin commit/push/deploy; se reinicia servidor local.

## Fases hasta final del evento (2026-11-19)

En Localidades y precios, tanto Nueva fase como Editar fase incluyen **Vender hasta el final del evento**. Activarlo oculta la fecha manual. Sigue la fecha/hora exacta de fin del evento, incluso cuando se edita después; no supone medianoche del día de inicio. Si no hay fin definido, continúa hasta cerrar ventas o finalizar/cancelar el evento. Desactivarlo permite escoger una fecha/hora manual.

Implementación: `PhaseEnd` en enhanced-fields.tsx, operations.tsx y phase-editing.tsx. Migración012 permite ends_at NULL como vínculo dinámico al evento, sin fechas artificiales. state.ts expone ends_with_event y effective_ends_at; service.ts aplica el final efectivo al publicar/vender y valida inicio anterior al final. Catálogo, comprador y taquilla usan el mismo final efectivo.

Solapamientos: una fase vinculada reserva desde su inicio el resto del canal para impedir conflictos si el evento se prolonga. Para añadir otra fase posterior en el mismo canal, primero asignar un final manual a la anterior o desactivarla. No afecta precios históricos ni altera fases existentes.

Prueba: `npm test` incluye venta antes/después del final, cambio de fecha, evento sin fin y solapamiento; `npx playwright test` comprueba interruptor, ocultación y edición de vuelta a fecha manual. Supabase staging compartido: migración012 aplicada con respaldo cifrado verificado y filas existentes sin cambios. Solo el código local usa esta opción hasta una publicación futura; no se crearon fases de ensayo en Supabase. Sin commit ni push.
