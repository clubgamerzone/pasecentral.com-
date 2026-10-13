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
