# Dominio propio y corte a producción — 2026-11-26

## Resultado remoto confirmado

Commit de implementación `c7675785b6f3f4632aca7c592cfd4c37eb67b172` enviado a main; Vercel confirmó Deployment has completed (success). El dominio `https://pasecentral.app` sirve la aplicación con environment=production, demo=false y cero eventos. Login200; callback sin token307 al login de este dominio; petición Auth inválida con Origin correcto400 y con origen ajeno403. Ambos alias anteriores redirigen308 al dominio propio conservando ruta/query. El webhook real, tanto por el alias autorizado como por el dominio propio, rechaza un cuerpo inválido400 sin redirección. Esto no equivale a verificar una transacción bancaria real.

Worker sin credenciales401; con el token exclusivo nuevo200, processed=0, invitations=0, notifications=0. Se actualizó en Vault únicamente la URL al nuevo `/api/worker` y se activó el cron de producción cada minuto. El cron de staging quedó pausado. Configuración anterior respaldada con cifrado y verificación de descifrado en `.local/backups/live-cutover-*/worker-jobs.enc`; clave privada de recuperación en la configuración local del proyecto nuevo. Script privado `.local/activate-production-worker.ts --apply`; informe `.local/production-worker-cutover-report.json`. No se dispararon correos ni se crearon ventas para la comprobación.

La base nueva conserva un administrador y una organización, cero eventos/órdenes/entradas; buckets avatars, event-images y tickets privados. Verificaciones HTTP repetidas en `.local/verify-live-domain.mjs`, informe privado `.local/production-domain-http.json`. Se agregó www al proyecto manteniendo desactivada la recomendación de redirigir apex a www para evitar un bucle con la URL canónica; HTTPS `https://www.pasecentral.app/login` respondió308 a `https://pasecentral.app/login`.

Se dejó abierta la página de login del dominio propio para la intervención del propietario. Falta comprobar su sesión administrativa en el navegador, crear el evento real con sus precios y realizar la primera compra real por el propietario. No se ejecutaron cargos, transferencias, devoluciones ni una compra de comprobación. Recepción de correo/PDF y abono bancario real siguen sin ensayo end-to-end.

## Alcance autorizado

El propietario confirmó contratación de Pro y registro de `pasecentral.app`. Vercel mostró Welcome to Pro y el dominio ya comprado; no se realizó una segunda compra ni se cambiaron datos de registro/renovación. Se conectó el dominio al proyecto existente `pasecentral-demo`, equipo `jd's projects`. HTTPS público `/login` devolvió200 antes del corte. Los alias Vercel anteriores se conservan.

Supabase producción conserva Site URL `https://pasecentral.app` y ocho callbacks autorizados: cuatro del dominio propio y los cuatro anteriores de `pasecentral.vercel.app`. Las plantillas españolas usan Site URL de forma dinámica. Se conserva el remitente del subdominio ya verificado de ClubGamerZone, con nombre Pase Central; no se registró un remitente nuevo en el dominio comprado.

## Selección completa de configuración

`src/lib/config.ts` añade `configured()` y el perfil explícito `PASE_CONFIG_PROFILE=live`. Solo funciona con APP_MODE, APP_ENVIRONMENT y WOMPI_ENV iguales a `production`; rechaza perfiles desconocidos. `required()` consulta el conjunto aislado y nunca usa una credencial anterior si falta un valor live. Si el perfil está vacío o es default, conserva el mecanismo anterior. No modifica el entorno local.

| Variable solicitada por el servidor | Secreto reservado usado en live |
| --- | --- |
| DATABASE_URL | DATABASE_LIVE_URL |
| DATABASE_SSL_CA | DATABASE_LIVE_SSL_CA |
| NEXT_PUBLIC_SUPABASE_URL | SUPABASE_LIVE_URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | SUPABASE_LIVE_ANON_KEY |
| WOMPI_PUBLIC_KEY | WOMPI_LIVE_PUBLIC_KEY |
| WOMPI_PRIVATE_KEY | WOMPI_LIVE_PRIVATE_KEY |
| WOMPI_EVENTS_SECRET | WOMPI_LIVE_EVENTS_SECRET |
| WOMPI_INTEGRITY_SECRET | WOMPI_LIVE_INTEGRITY_SECRET |
| TICKET_ENCRYPTION_KEY | TICKET_LIVE_ENCRYPTION_KEY |
| SESSION_SECRET | SESSION_LIVE_SECRET |
| WORKER_SECRET | WORKER_LIVE_SECRET |
| EMAIL_FROM | EMAIL_LIVE_FROM |

`EMAIL_API_KEY` se reutiliza conforme a la autorización previa. Los nombres NEXT_PUBLIC de esta tabla se resuelven en `src/lib/auth.ts` en el servidor; las reservas privadas no se incorporan al cliente. No usar el perfil para servir una mezcla parcial de bases o ambientes. `src/lib/db.ts` exige la CA en live y conserva verificación TLS; falta de CA falla antes de abrir el pool.

## Configuración de Vercel preparada para el despliegue

Production: APP_MODE=production, APP_ENVIRONMENT=production, WOMPI_ENV=production, APP_URL=https://pasecentral.app, PASE_CONFIG_PROFILE=live, EMAIL_LIVE_FROM con el remitente de boletas previamente verificado y nombre Pase Central. Las12reservas de la tabla ya están guardadas como secretos. El código se publica después de preparar este conjunto; cambios de variables no actualizan por sí solos el despliegue que está sirviendo tráfico.

`src/proxy.ts`: al usar el dominio propio, GET/HEAD desde los dos alias anteriores y www redirigen308, conservando ruta/query. Solo admite los orígenes fijados en código. No redirige APIs ni POSTs; el webhook autorizado `https://pasecentral.vercel.app/api/webhooks/wompi/production` sigue siendo un receptor HTTPS directo de la misma aplicación. No depende de la URL de retorno para confirmar pagos. www requiere además asignación DNS/dominio para poder recibir tráfico; no darlo por comprobado solo por la regla de proxy.

## Verificación y siguientes pasos

Pruebas de configuración y redirecciones en `tests/live-config.test.ts` y `tests/canonical-url.test.ts`: selección aislada de DB/Auth/CA, rechazo de valores faltantes/activación parcial, firma checkout con integridad de producción y retorno al dominio propio; rechazo de conexión live sin CA; páginas antiguas308 y API sin redirect. Suite completa previa:17archivos/144pruebas aprobados; prueba adicional de TLS y repetición focalizada:8pruebas aprobadas. Lint, tipos y build finales aprobados. No crear fixtures ni compras en la base nueva para estas pruebas locales.

Tras Ready del commit: comprobar dominio/callback/CSRF, API de estado sin fixtures y ambiente production, rechazo de webhooks inválidos y autenticación del worker con token nuevo. Cambiar únicamente la URL en Vault del proyecto nuevo al dominio propio y activar su cron después de comprobar la aplicación. Pausar el cron del proyecto de ensayo para que no siga llamando al worker ya migrado. Conservar tablas, identidades y secretos anteriores; no borrar datos de ensayo en este corte.

El propietario debe iniciar sesión con la cuenta creada en el proyecto nuevo. No se copiaron usuarios antiguos. No hay eventos, órdenes o boletas en la base nueva antes del lanzamiento. La creación del evento/precios y la primera compra real deben verificarse con el propietario; una configuración live o pruebas unitarias no prueban recepción de dinero, entrega de correo ni abono bancario.

## Recuperación

Antes de la primera transacción real se puede volver al conjunto anterior restaurando PASE_CONFIG_PROFILE=default, APP_ENVIRONMENT=staging, WOMPI_ENV=sandbox y APP_URL anterior, con un despliegue controlado y cron real pausado. Después de comenzar ventas reales no volver a una base de ensayo ni usar una reversión a despliegues anteriores al soporte del perfil: conservar la base real, pausar ventas si hace falta y corregir la incidencia sin perder ventas, credenciales o notificaciones. No cambiar las claves de cifrado de boletas ya emitidas.
