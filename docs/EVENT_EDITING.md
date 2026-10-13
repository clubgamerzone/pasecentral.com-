# Edición de eventos, cupos e imágenes (2026-10-13)

## Acceso y operación

Desde **Eventos → Administrar → Evento** se editan nombre, descripción, recinto, dirección, fechas, apertura/cierre de puertas y aforo total. El enlace público conserva su slug para no romper compras o enlaces compartidos. Las horas del formulario se interpretan en America/Bogota y se guardan en UTC. Descripción de texto plano con saltos de línea, hasta 5000 caracteres; no admite HTML ejecutable.

**Portada y galería** permite agregar varias imágenes, elegir portada y eliminar fotos. Máximo ocho imágenes por evento, JPG/PNG/WebP de hasta 4 MB y 36 megapíxeles cada una. La primera imagen se vuelve portada; al borrar la portada se elige automáticamente la siguiente disponible. Sin fotos se conserva el diseño gráfico anterior. El catálogo y dashboard usan la portada; la página pública muestra la galería con miniaturas seleccionables y descripción completa.

En **Localidades y precios → Editar [localidad]** se cambian nombre y cupo total, incluso con inventario agotado. Disponibles = cupo total menos comprometidas, limitado también por el aforo compartido. Para agregar diez disponibles a una localidad con cinco comprometidas, establecer su cupo en quince. La tabla muestra ambos números.

El servidor impide reducir una localidad por debajo de sus ventas confirmadas y reservas no vencidas. Se permite cupo cero cuando no hay entradas comprometidas. Para aumentar una localidad por encima del aforo, aumentar primero el aforo del evento. Para reducir el aforo por debajo del cupo de una localidad, reducir primero esa localidad; el aforo nunca puede quedar por debajo del total comprometido. Los cupos de localidades comparten el aforo, no son inventario independiente ni se suman obligatoriamente al aforo.

Las anulaciones y devoluciones conservan la regla existente de inventario comprometido; esta edición no revende automáticamente esos cupos. Las reservas vencidas se excluyen y marcan expiradas dentro de la transacción. Ventas y edición usan el mismo bloqueo de fila del evento para impedir sobreventa durante cambios concurrentes.

Cambios de nombre/localidad/precio no reescriben snapshots en órdenes anteriores. Cambios de fecha/lugar se ven en la página y documentos generados nuevamente, pero los PDF ya enviados conservan los datos anteriores. Avisar a compradores si cambia información importante; no se dispara envío masivo ni se generan QR nuevos al editar.

## Implementación y servicios

El límite de entrada es 4 MB para dejar margen al formulario multipart dentro del límite de 4.5 MB de [Vercel Functions](https://vercel.com/docs/functions/limitations). El bucket admite hasta 5 MB como techo de almacenamiento; la aplicación exige el límite menor en cliente y servidor.

- UI: `src/components/event-editing.tsx`, integrada en `operations.tsx`, `buyer.tsx` y `app.tsx`; estilos en `src/app/globals.css`.
- Comandos: `update_event`, `update_type`, `event_cover` en `src/lib/validation.ts` y `service.ts`. Permiso `manage`, validación servidor, transacción y auditoría. Organizador por evento solo edita eventos asignados; comprador/taquilla/acceso no pueden editar.
- Migración `005_event_editing_images.sql`: cupo cero, tabla `event_images` con RLS y bucket **privado** `event-images`; claves de objeto prefijadas por UUID de evento. Clientes no tienen INSERT/UPDATE/DELETE de la tabla. Storage permite subir/eliminar únicamente a administradores/organizadores autorizados del evento.
- `POST /api/events/[eventId]/images`: autenticación, origen, límite de solicitudes/tamaño, normalización con Sharp 0.35.5, subida con sesión Supabase existente y registro transaccional. Compensa archivo si falla la transacción. Sin service_role ni credencial nueva.
- `GET /api/event-images/[imageId]`: bytes WebP; borrador/cerrado solo usuarios con permiso de ver ese evento, publicado accesible al comprador. Cache privado no-store para no conservar acceso después de retirar publicación. `DELETE` solo gestores, cambia portada y elimina objeto.
- `src/lib/event-images.ts`: valida firma JPG/PNG/WebP, elimina metadatos al recodificar, limita píxeles y redimensiona sin deformar a máximo 2000 px. No permite SVG ni URLs externas. Desarrollo local usa `.local/event-images/`, ignorado por Git; conectado usa Supabase Storage.
- `src/lib/state.ts`: devuelve galería/portada solo de eventos visibles y URLs de la ruta de imágenes; no publica rutas arbitrarias de Storage.

## Ejecución y pruebas

Aplicar en entorno conectado con `node --env-file=.env.local --import tsx scripts/migrate.ts`; local aplica migraciones al iniciar. No copiar ni imprimir `.env.local`. No cambia configuración Wompi/Resend/Vercel ni requiere nuevas cuentas.

Prueba manual: crear un borrador ficticio, editar sus datos, subir dos imágenes, cambiar portada, configurar localidad/fases y publicar. Abrir catálogo y página como visitante y seleccionar miniaturas. Vender/reservar entradas de prueba, intentar bajar cupo bajo comprometidas (rechazado), aumentarlo y comprobar nuevos disponibles. Eliminar portada y verificar sustitución. Un visitante no puede leer imágenes del borrador.

Cobertura automatizada en `tests/service.test.ts`: vendido/reservado, vencimiento, renombre preserva snapshot, venta/reducción concurrentes, cupo cero, fechas inválidas, permisos/aislamiento, portada de otro evento, RLS y normalización. `tests/e2e/flows.spec.ts`: edición completa, dos imágenes, visitante rechazado en borrador y permitido publicado, portada/miniaturas/eliminación y localidad con cero cupos que se amplía. Ejecutar lint, typecheck, test, test:e2e y build. Evidencia final y commit: `docs/PROGRESS.md` y `git log -1 -- src/components/event-editing.tsx`.

No se verifican impresora ni Honeywell en esta entrega. Borrado de archivos después de confirmar DB es mejor esfuerzo; un error de Storage puede dejar un objeto huérfano sin referencia pública, que debe limpiarse durante operación supervisada.
