# Conexión de servicios · 2026-10-13

## Supabase conectado y verificado

Proyecto existente: `pasecentral.com-demo`, referencia `kvdbhtzjlysmlmopocds`, organización `clubgamerzone`. Se usó la sesión Chrome del propietario para identificar el proyecto y sus datos públicos; no se crearon claves nuevas ni se guardaron secretos en Git.

La configuración privada está en `.env.local` (ignorada). Se copiaron URL y clave publishable existentes. La conexión PostgreSQL usa el Session pooler de la región mostrada por el panel, con contraseña codificada en URI. El pool queda limitado a tres conexiones en este ambiente.

La primera conexión TLS falló con `SELF_SIGNED_CERT_IN_CHAIN`. Se descargó el certificado público desde el enlace **Database → Settings → SSL configuration → Download certificate**, URL oficial `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`. Está en `supabase/certificates/prod-ca-2021.crt`; SHA-256 `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`. `src/lib/db.ts` admite `DATABASE_SSL_CA` y mantiene `rejectUnauthorized: true`. Se eliminan de la URI las opciones SSL que sobrescribirían la CA de `pg`. No se desactivó la validación TLS.

Hubo rechazos transitorios `28P01` durante la actualización de contraseña; después el pooler aceptó la conexión. La documentación oficial describe el cache de credenciales después de una rotación: https://supabase.com/docs/guides/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation. No se documentan las contraseñas recibidas. Los cambios de contraseñas en UI los realiza el propietario.

Se aplicaron `001_core.sql` y `002_security.sql` usando `migrate()` y `pg` contra el proyecto. Resultado comprobado: **22 tablas públicas, 22 con RLS habilitado**, bucket `tickets` con `public=false`. Se probó además que el rol SQL `authenticated` no pueda insertar en `platform_admins` (`42501`).

El propietario creó y confirmó su usuario en **Authentication → Users → Add user → Create new user**. Se ejecutó el bootstrap existente para esa identidad verificada; organización inicial `Pase Central · pruebas`. No se cambió la contraseña de la cuenta ni se enviaron invitaciones. Los detalles privados de login quedan fuera de esta guía.

## Wompi sandbox

Comercio existente: `ClubGamerZone`. En **Desarrollo → Programadores** se activó la vista sandbox y se copiaron las cuatro llaves existentes al archivo privado. Se volvieron a ocultar las llaves después de leerlas. No se regeneraron llaves ni se configuró cobro real.

Consulta real al endpoint de comercio sandbox: HTTP 200, comercio reconocido y aceptación disponible. Esto verifica la llave pública; **no certifica todavía una transacción sandbox completa ni el webhook**.

Variables requeridas: `WOMPI_ENV=sandbox`, `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET`. El webhook se configura después de conocer el dominio HTTPS efectivo.

## Ambiente de pruebas

`APP_MODE=production` selecciona Supabase/Auth reales, no pagos reales. Se agregó `APP_ENVIRONMENT=staging`; `appEnvironment()` en `src/lib/config.ts` distingue demo local, staging conectado y operación real. La UI muestra **PRUEBAS CONECTADAS** y el dashboard advierte que sus importes de ensayo no representan ventas reales. La simulación directa de aprobación sigue permitida solamente en demo local. Wompi permanece en sandbox.

Para futuras pruebas de concurrencia:

```powershell
npm run test:connected -- EMAIL_DEL_ADMIN_VERIFICADO
```

Código: `scripts/verify-connected.ts`. Exige staging conectado y sandbox, utiliza transacciones `pg` concurrentes, conserva registros de ensayo auditables y no contacta la pasarela ni envía emails. No ejecutarlo sobre el comercio real.

Resultado ejecutado: dos eventos independientes ficticios; seis ventas concurrentes a capacidad uno → una venta; dos check-ins concurrentes → `accepted` y `already_used`; orden de tres entradas → tres QR diferentes. Al terminar los eventos quedaron `sales_closed`. No se movió dinero ni se enviaron mensajes. Los QR no se imprimieron en logs.

Pruebas de regresión: lint, tipos, 36 pruebas Vitest y build pasaron; cinco flujos Playwright pasaron en su base demo aislada. Para iniciar E2E debe detenerse primero otro `next dev` del mismo checkout: Next 16.4 impide dos servidores dev en la misma carpeta, aunque los puertos sean diferentes.

## Vercel y pendientes

Cuenta/equipo observado: `jd's projects` (`jds-projects-5cb9c772`), plan Hobby. Importación desde `clubgamerzone/pasecentral.com-`, rama `main`, proyecto preparado `pasecentral-demo`. El usuario autorizó explícitamente guardar las credenciales necesarias como variables de servidor y desplegar la demo conectada. Las variables de producción de Vercel seguirán representando **staging y Wompi sandbox**.

Pendiente de verificar el deployment y su dominio efectivo antes de registrar webhook y URLs de Auth. Resend/SMTP, scheduler de emails y hardware siguen pendientes; no había una sesión Resend aportada. No se contrataron planes pagos, no se modificó DNS y no se habilitaron pagos reales.
