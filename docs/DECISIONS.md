# Decisiones técnicas · 2026-10-11

## Alcance y punto de partida

La carpeta solo contenía `AGENTS.md.txt`; no había aplicación, Git ni dependencias. Se conservó ese original y se creó `AGENTS.md` como guía activa. La instrucción posterior del usuario amplió la prioridad inicial a todo el MVP y autorizó subirlo a `clubgamerzone/pasecentral.com-`, rama `main`. No autorizó cobros reales ni envío de mensajes a clientes.

## Arquitectura

Next.js App Router con TypeScript, Tailwind y componentes semánticos. No se añadieron microservicios, Redis, asientos, offline ni onboarding SaaS. Las vistas comparten `src/components/app.tsx`; operación está en `operations.tsx` y comprador en `buyer.tsx`. Las rutas sugeridas funcionan a través de `src/app/[[...path]]/page.tsx`. Los endpoints específicos viven en `src/app/api/`.

`src/lib/validation.ts` define comandos Zod. `service.ts` autoriza con identidad verificada y contiene las reglas; `db.ts` ofrece una transacción verdadera de PostgreSQL para cada mutación. Producción usa `pg` contra Supabase y Auth de `@supabase/ssr`. No se usa una secuencia de REST calls como sustituto de transacciones.

PGlite es un **adaptador exclusivo de desarrollo** ante Docker inactivo y ausencia de credenciales. Ejecuta las mismas migraciones y reglas con almacenamiento persistente local. Solo admite un proceso por carpeta. Las pruebas concurrentes locales se serializan en su backend; verifican reglas, pero no certifican bloqueos bajo carga multiconexión de Supabase.

## Seguridad

- Roles administrativos salen de tablas del servidor; comprador es el rol implícito sin permisos administrativos. No se confía en IDs de usuario/organización enviados por el navegador.
- Toda escritura se hace mediante conexión SQL privilegiada exclusivamente en servidor y autorización dentro de la transacción. Revocados `INSERT/UPDATE/DELETE` para roles de navegador. RLS limita lecturas de tablas expuestas.
- Funciones auxiliares RLS con `SECURITY DEFINER` se limitan a devolver permisos para `auth.uid()`, tienen `search_path=public,pg_temp`, y `EXECUTE` restringido. No hay funciones públicas que emitan o validen entradas con privilegios.
- Hash SHA-256 del QR para validar; token de 256 bits generado con `randomBytes`. Token recuperable cifrado con AES-256-GCM y clave privada del servidor.
- El estado administrativo y CSV nunca incluyen token QR, hash, token cifrado ni enlace de entrega. PDF/QR solo se devuelven al dueño, taquilla autorizada o poseedor del enlace secreto revocable.
- Enlace de entrega en fragmento `#`: no llega en URL al servidor. Se verifica mediante POST JSON, sin logging del body. `Referrer-Policy: no-referrer` y `Cache-Control: no-store` para documentos y estado.
- Mutaciones del navegador requieren Origin exacto y cookies SameSite. Límites de solicitudes persistentes para comandos, documentos, autenticación y firma QZ.
- Demo solo en desarrollo y escuchando en loopback. No publicar sus usuarios, base, outbox o secretos.
- Storage Supabase crea bucket `tickets` privado sin políticas públicas. El MVP genera PDFs autorizados bajo demanda desde credenciales cifradas; no necesita subir documentos ni almacenar tokens en un bucket público.

## Cupos y estados

Cada reserva, confirmación, venta, acceso y cierre toma el bloqueo de la fila del evento. Los cambios de fase bloquean evento/localidad; el trigger evita superposiciones. Todas las órdenes guardan el precio aplicado. Aforo total y cupo por localidad se calculan juntos.

Reserva de diez minutos configurable entre uno y sesenta. El inventario deja de considerar las reservas vencidas usando hora de base de datos; no depende de cron ni temporizador cliente. Un pago tardío vuelve a comprobar stock bajo el mismo bloqueo. Sin cupo o con evento cancelado/finalizado queda `needs_review`, sin boletas.

Entradas anuladas/devueltas mantienen cupo consumido por decisión conservadora del MVP. No hay botón para reabrir ese inventario; tampoco se reutilizan consecutivos. La sustitución cambia únicamente la credencial y su versión, conserva número/serial y vuelve inválido el QR anterior.

Las compras/vendas usan UUID de idempotencia. Check-in usa UUID por intento y conserva resultado original para el reintento. Se rechaza un UUID ajeno a otro operador/evento. La nueva lectura de una boleta usada resulta `already_used`.

## Pagos y devoluciones

Wompi: firma del checkout incluyendo expiración; checksum del webhook según propiedades dinámicas; consulta autenticada al proveedor para validar también campos que pueden no estar firmados. Deduplicación por transacción/estado consultado. Confirmación, pago y emisión dentro de la misma transacción. Una aprobación no se degrada por notificaciones de rechazo atrasadas. Devoluciones/void posteriores se concilian manualmente con el proveedor; no se implementó reembolso automático.

Venta física en efectivo necesita caja abierta. Transferencia requiere verificación explícita y referencia. Cortesía requiere organizador y motivo, consume aforo y siempre tiene orden. Email escrito por taquilla **no** vincula la cuenta del supuesto comprador.

Devolución manual registra referencia externa, importe y entradas afectadas. No envía dinero. Entradas usadas no son reembolsables por este flujo básico. Un pago tardío sin boletas admite devolución con selección vacía. Devolución de efectivo crea movimiento en la caja original abierta o caja abierta del responsable; si no existe, se exige abrir una. Cajas cerradas no se reescriben.

## Entrega e impresión

Resend por HTTP y cola SQL, clave de idempotencia por trabajo, seis intentos, espera creciente y recuperación de trabajos abandonados. Configurar scheduler es requisito del hosting. Adaptador inyectable permite probar fallos sin contactar un proveedor. Demo usa archivos privados de outbox y nunca envía emails reales.

BrowserPrintAdapter y QZTrayAdapter. QZ envía ESC/POS, exige impresora configurada y firma desde servidor. Registro de solicitado/enviado no equivale a confirmación física. Identificadores conservados en reimpresión. Se debe homologar un modelo real de 80 mm.

## Dependencias y verificación

Las versiones instaladas se fijaron en manifiesto y lockfile. `npm audit --omit=dev` no reportó vulnerabilidades en dependencias de ejecución. La auditoría completa reporta cinco avisos altos en la cadena de lint `braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next`; no hay parche compatible que `npm audit fix` pueda aplicar. Su propuesta forzada reduce Next ESLint a otra versión mayor; no se aplicó esa regresión. No ejecutar lint sobre repositorios o patrones no confiables. Revaluar la cadena en futuras actualizaciones.

Fuentes de integración consultadas: documentación oficial de Wompi Checkout y Eventos, enlazada en README. Para preview local se consultó la guía local de Sites; no se registró ni desplegó un Site porque la entrega solicitada es el repositorio Next.js. No se accedió a Firebase, cuentas Supabase/Wompi/Resend, ni paneles cloud externos en esta entrega.

## TLS y staging conectado (2026-10-13)

Supabase requiere CA explícita en la conexión observada. Se distribuye solo su certificado público en supabase/certificates, y DATABASE_SSL_CA se configura del lado servidor; nunca se usa rejectUnauthorized=false. DATABASE_POOL_SIZE permite limitar sesiones (tres para esta demo). APP_ENVIRONMENT=staging etiqueta los ensayos en UI, independientemente de APP_MODE=production, que únicamente selecciona Auth/SQL reales. Las pruebas conectadas están protegidas para ejecutarse solo en staging con Wompi sandbox, conservan auditoría y no borran filas financieras. Procedimiento y evidencia: docs/CLOUD_SETUP_2026-10-13.md.
## Acceso automático por QR (2026-10-13)

A petición del propietario se elimina la selección de evento de `/access`. Comando `scan_auto` en `src/lib/validation.ts` y `service.ts`: resuelve evento mediante hash de credencial y reutiliza check-in transaccional con bloqueo de evento/entrada, autorización, horario, estado e idempotencia. No acepta event_id del navegador. Un operador con varios eventos asignados puede admitir cualquiera; el aviso muestra el evento solo si está autorizado. QR desconocido sin evento se registra en auditoría `scan_unknown`, sin token, pues check_in_attempts requiere evento. Reintentos comprueban permiso vigente incluso para un resultado guardado.

En `Access` (`src/components/operations.tsx`), espera de 350 ms sin cambios para lectura sin sufijo, Enter/botón como alternativas y bloqueo de doble envío. Fallo de red conserva credencial/request_id y requiere reintento explícito para evitar bucles. Aviso accesible `role=alert` sin robar foco, cierre automático y resultado persistente; al comenzar otra lectura se retira la autorización anterior. El equipo todavía debe entregar texto mediante Wedge. No habilita ingreso offline.
## Boletas adjuntas por email y compartir PDF (2026-10-13)

Solicitud del propietario: recibir QR y cada boleta sin tener que abrir un enlace. `src/lib/ticket-email.ts` genera HTML escapado, QR PNG con Content-ID y PDF individual con `pdf-lib`/`qrcode`. Resend recibe base64, sin URLs de PDFs públicos. Se conserva enlace privado para estado y descarga; las imágenes CID pueden ser bloqueadas por el cliente de correo. Límite interno de 35 MB en contenido base64 de adjuntos para dejar margen al límite documentado de Resend de 40 MB.

`delivery.ts` prepara y cifra el payload una sola vez por trabajo (migración 003), para que una fecha de creación PDF o cambio de datos no altere el payload en un reintento idempotente. Acceso SQL a la nueva columna denegado a authenticated; estado administrativo solo devuelve campos seguros de la cola. Payload cifrado contiene credenciales de boletas y no debe exportarse. Reenvío crea un job nuevo, nunca entradas nuevas. Un PDF entregado no se revoca al revocar el enlace: el servidor sigue comprobando estado/versión del QR.

`Tickets` en buyer.tsx prepara el PDF antes del clic para conservar la activación exigida por Web Share. Permite compartir archivos en móviles compatibles y muestra descarga/adjuntar Documento en escritorio. La API nativa ofrece destinos; no fuerza WhatsApp ni certifica que el usuario envió. WhatsApp automático aplazado explícitamente por el propietario hasta disponer de número/integración empresarial. Fuentes: https://resend.com/changelog/embed-images-using-cid, https://resend.com/docs/api-reference/emails/send-email, https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share y https://whatsappbusiness.com/policy/.
## Perfil e invitaciones con permisos limitados (2026-10-13)

Se usa perfil local de PostgreSQL para nombre/teléfono/bio/foto y correo de identidad de Supabase Auth como fuente verificada. Solo se modifica el perfil propio; foto privada con sesión RLS, normalización Sharp y sin metadatos. No se añaden service_role o claves nuevas. Bucket avatars y API de imagen separada de documentos de boletas.

Invitaciones propias con Resend y cola persistente permiten asignar varios eventos antes de existir la cuenta, sin manipular contraseñas ni conceder rol desde metadata de signup. Hash/cifrado del token, destinatario confirmado desde Auth y transacción al aceptar. Organizador en event_staff permite alcance por evento; la membresía de organización existente conserva su alcance. El administrador global puede invitar roles globales, advertidos en UI. Reenvío genera clave de idempotencia nueva; revocar invalida aceptación sin borrar historial. Detalles de archivos, configuración, sesión y pruebas en PROFILE_TEAM_SETUP.md.
# Edición segura y galería (2026-10-13)

La solicitud del propietario agrega edición de eventos y cupos vendidos/agotados; las mutaciones comparten bloqueo transaccional del evento con venta y vencimiento. Se mantiene la regla de aforo compartido y no se reescriben snapshots históricos. Cupo cero permitido cuando no existen compromisos. Slug público estable. Descripción plana y galería máxima de ocho imágenes normalizadas con Sharp, Storage privado y lectura pública solo mientras el evento está publicado. No usar bucket público ni nuevas llaves de servicio; sesión Supabase y RLS por evento. Guía: EVENT_EDITING.md.
## Invitaciones exclusivamente laborales (2026-10-13)

Comprador es toda persona registrada que compra; no necesita ni recibe invitación. Se retira customer del comando/formulario de invitación, con restricción de base para nuevas escrituras y revocación auditada de pendientes antiguas. Históricos se conservan sin exposición en equipo ni posibilidad de aceptar; cuentas/ventas no se modifican. Roles invitables: platform_admin, organizer por evento, box_office (Cajero / taquilla) y access_staff, con múltiples eventos para los operativos. Ver PROFILE_TEAM_SETUP.md.
## Reiniciar fixtures conservando identidad (2026-10-13)

El propietario autoriza eliminar registros de ensayo, incluidos registros financieros ficticios, para comenzar eventos propios. Es una limpieza excepcional de staging/sandbox, no una corrección de ventas reales. Se usa CLI privado con lista exacta de eventos DEMO, comprobación de invitaciones dependientes, respaldo cifrado verificado y transacción con bloqueos. Se conservan Auth/perfiles/invitaciones/roles generales, seguridad e integraciones. Se retiran asignaciones a eventos eliminados. Pagos siguen en sandbox hasta activación comercial explícita. Guía: TEST_DATA_RESET.md.
## Auditoría comprensible (2026-10-13)

El propietario no encontraba las definiciones de los códigos internos. La tabla usa nombres/explicaciones en español conservando códigos originales para soporte; catálogo completo consultable y buscable dentro de Reportes, disponible con auditoría vacía. No se modifican operaciones, registros ni autorizaciones; códigos futuros desconocidos no se interpretan automáticamente. Fuente única: audit-labels.ts; guía AUDIT_GUIDE.md.
# Analítica de ventas y audiencia individual (2026-10-13)

Solicitud del propietario: ampliar vista general/reportes con ventas generales y por evento, fases más vendidas, ranking/comparación anual y composición del público. Se comparte componente y endpoint de agregados autorizados, con snapshot SQL REPEATABLE READ; no se calcula demografía en cliente a partir del estado administrativo. Género y edad voluntarios se registran por entrada con consentimiento y rangos amplios, sin nombres/DOB. Datos antiguos quedan desconocidos. RLS/REVOKE impide leer filas demográficas directamente y las respuestas/exportaciones contienen agregados. Migración 007 aditiva, sin nueva limpieza cloud. Definiciones de ventas, fechas, inventario, cobertura, devoluciones y límites en ANALYTICS.md. No se estima utilidad ni medios específicos de Wompi que no estén registrados.
## Ampliación autorizada de cuentas y entradas — 2026-10-14

El propietario amplía alcance a organizaciones/transferencias/regalos antes pospuestos. Aceptación con identidad verificada y plazo 7 días; destinatario de regalo puede registrarse, transferencia solo a cuenta existente. Titularidad cambia atómicamente y rota QR/revoca enlaces, conserva inventario/emisión/historial. Demografía del perfil se copia a la propia entrada, no a todos los acompañantes; snapshots anteriores se restauran al cancelar transferencia. Eliminar cuenta propia anula sin reembolsar, anonimiza perfil y elimina Auth conservando actor financiero mediante FK separable; RLS restrictive active_account niega JWT antiguo. Último admin/cajas/Storage ajeno protegen operación. No service_role nuevo ni SQL cliente.

Apertura de puertas en fecha inicial con campo hora; cierre permite día siguiente, edad mínima editable (aceptado por propietario) y zona Colombia. Fase both comparte precio, compite con ambos canales, edición conserva snapshots. Bloquear contextmenu cumple preferencia de interfaz y no es control de seguridad contra inspección. Plantillas Auth españolas y callbacks por tipo verifican sesión antes de perfil/recuperación. Código, servicios, pruebas y límites en ACCOUNTS_TICKETS_2026-10-14.md.

## Análisis visual — 2026-10-14

Gráficos React/SVG/CSS propios sobre los agregados autorizados existentes, sin biblioteca/proveedor de tracking adicional. Tortas para distribución, barras para comparar y línea con eje temporal real; tablas/CSV conservados. Verde/amarillo/rojo se interpretan según significado, no signo numérico de forma indiscriminada: incidencias positivas son rojas, reservas pendientes amarillas y faltantes negativos rojos. Categorías demográficas distinguidas sin juicio ni inferencia. Cero/sin base neutral; cupo bajo tiene umbral explícito 10% del total filtrado; no inventar metas o datos. Guía: ANALYTICS_VISUALS.md.
