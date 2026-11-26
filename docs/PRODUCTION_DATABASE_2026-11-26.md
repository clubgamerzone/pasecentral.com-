# Base separada de producción — 2026-11-26

## Estado comprobado

Proyecto Supabase `pasecentral-produccion`, referencia `oslmaxdagamvdeuqxqli`, región `ca-central-1`. El propietario creó el proyecto y guardó su contraseña en el archivo privado ignorado `.local/production.env`. No se trasladaron las ventas, boletas o identidades del proyecto de ensayo.

La conexión Session pooler usa el servidor mostrado en Connect → Direct → Session pooler, puerto5432, usuario PostgreSQL con sufijo de referencia del proyecto. Se verificó TLS con `rejectUnauthorized:true` y la CA pública existente `supabase/certificates/prod-ca-2021.crt`; nunca se desactivó la verificación de certificados.

Se ejecutó `npx tsx .local/setup-production.ts` como inspección previa y luego `npx tsx .local/setup-production.ts --apply`. El script privado está acotado al proyecto nuevo y reutiliza `migrate` de `src/lib/db.ts`, con transacciones por migración. Aplicó las15migraciones versionadas, sin seed. Informe privado `.local/production-setup-report.json`:33tablas públicas con RLS activado; cero eventos, órdenes, entradas y perfiles antes del alta del administrador. El script privado no forma parte de un clon limpio; el mecanismo versionado de migraciones es `scripts/migrate.ts`, que requiere configurar la conexión de servidor antes de ejecutarse.

## Configuración guardada

- Auth Site URL `https://pasecentral.vercel.app`; cuatro redirects exactos: raíz, `/auth/confirm`, mismo callback con `type=signup` y con `type=recovery`.
- SMTP autorizado: Resend, puerto465, remitente del subdominio verificado, nombre visible `Pase Central`. Se reutilizó la clave de envío existente autorizada por el propietario; guardado confirmado por Supabase. No se enviaron correos durante esta configuración.
- Las13plantillas de `src/lib/auth-email-templates.ts` se configuraron en Authentication → Emails. Se verificó persistencia volviendo a abrir cada plantilla y comparando el texto HTML del editor. Confirmación, invitación, enlace de acceso y cambio de correo usan `/auth/confirm?token_hash={{ .TokenHash }}&type=...`; recuperación usa `type=recovery`. Se conservaron apagados los siete interruptores de avisos de seguridad.
- Vercel, equipo `jd's projects`, proyecto `pasecentral-demo`, entorno Production: secretos reservados `DATABASE_LIVE_URL`, `DATABASE_LIVE_SSL_CA`, `SUPABASE_LIVE_URL`, `SUPABASE_LIVE_ANON_KEY`. No sustituyen todavía las variables que usa la app.
- Las llaves `WOMPI_LIVE_*` y el webhook real se prepararon antes; ver `WOMPI_CUTOVER_2026-11-26.md`. El receptor real permanece deshabilitado y responde503.

## Continuidad

Actualización posterior al alta manual: cuenta del propietario encontrada y correo confirmado en `auth.users`. Bootstrap privado ejecutado en una transacción con bloqueo de administración inicial y comprobación de ausencia de otros administradores/organizaciones. Quedaron un administrador global y una organización inicial `Pase Central`, sin eventos, órdenes o entradas. No se leyeron ni cambiaron contraseñas. Script e informe privados: `.local/bootstrap-production.ts --apply` y `.local/production-admin-report.json`. El procedimiento aplica la misma asignación explícita de `scripts/bootstrap.ts`, agregando verificación de correo, `auth_user_id` y guardia de concurrencia.

Worker nuevo preparado por `.local/prepare-production-worker.ts --apply`: extensiones pg_cron/pg_net, secreto de URL/token en Vault y job `pasecentral-delivery` cada minuto, **active=false**. Solo consulta las tres colas cuando esté activo. Verificados `net` fuera del Data API (406/PGRST106), Vault no legible por anon/authenticated y roles de cliente sin login SQL. No había trabajos pendientes y no se hizo POST al worker ni se enviaron correos. Informe privado `.local/production-worker-report.json`.

Claves internas nuevas (cifrado de entradas, sesión y worker) guardadas como tres secretos de Production en el Vercel autorizado: `TICKET_LIVE_ENCRYPTION_KEY`, `SESSION_LIVE_SECRET`, `WORKER_LIVE_SECRET`. Son reservas inactivas y coinciden con el token preparado en Vault. Respaldo de configuración privada en `.local/production-runtime.env` e importación privada en `.local/production-internal-reserved.env`; nunca publicarlos. Mantener las claves anteriores para la base anterior.

Vercel todavía muestra Hobby en esta inspección posterior. Wompi volvió a pedir login; se dejó una pestaña para que el propietario inicie sesión y realice la rotación de llaves ya indicada. No se cambiaron las variables activas ni el ambiente de pagos.

El propietario completó manualmente Create a new user. Las futuras cuentas deben seguir usando Auth e identidad verificada; no conceder roles mediante metadata pública. El bootstrap versionado de referencia está en `scripts/bootstrap.ts`.

Antes del corte faltan la verificación operativa, rotación de llaves Wompi tras la exposición técnica ya comunicada, hosting comercial y sustitución coordinada de variables activas. El worker nuevo debe activarse después de comprobar que la aplicación usa su base y token. No rotar las claves de entradas del ambiente anterior ni activar dinero real sobre la base de ensayo. La app pública sigue usando el ambiente anterior; esta preparación no acredita una compra real ni recepción efectiva de correo.

## Editor del dashboard

Para Monaco se usaron los controles de navegador: pegar el HTML mediante portapapeles, `ControlOrMeta+a` y `ControlOrMeta+v` en Editor content. Verificación por texto DOM renderizado (`.view-lines`, normalizando espacios no separables), sin acceder a estado interno del editor. El aviso flotante de Explorer cubría Guardar y se cerró. En avisos de seguridad hay dos botones Save changes: el último corresponde al contenido; no cambiar el interruptor de activación. Confirmación visible: Successfully updated email template. Ante una pestaña que no permite retomar control, se abrió una pestaña nueva del mismo navegador, conservando el formulario anterior sin guardar cambios adicionales.
