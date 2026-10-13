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

Deployment inicial del código `db8f5589a2bdad12389e0504996b6ebc900a9557`: **Ready**, dominio https://pasecentral-demo.vercel.app, deployment Vercel `5YhQYpS41HN9rT5qJPb2Uny1Av63`. Se creó desde Deployments → Actions → Create Deployment → main → Deploy to Production. El destino de Vercel se llama Production, pero el software sigue configurado como staging/sandbox.

En Settings → Environment Variables se guardaron 15 variables de servidor como **Secret**, exclusivamente para Production. Las dos variables `NEXT_PUBLIC_SUPABASE_*` son **Config**, como exige Vercel para valores públicos. Un guardado masivo puede persistir las variables válidas aunque rechace las de prefijo público: se comprobó la lista antes de completar las dos restantes. No se añadieron credenciales a Preview ni Development. El `APP_URL` desplegado usa el dominio HTTPS; la copia local conserva su URL local.

Supabase → Authentication → URL Configuration: Site URL y redirect permitido exacto `https://pasecentral-demo.vercel.app`. Wompi → Desarrollo → Programadores, vista Sandbox: URL de Eventos `https://pasecentral-demo.vercel.app/api/webhooks/wompi`, comprobada al volver a abrir Programadores después de recargar. No se modificó la URL de producción del comercio.

Verificación pública real: GET `/api/state` HTTP 200, `environment=staging`, `demo=false`, sin actor autenticado, un evento publicado ficticio. El fixture `Fiesta de demostración · DEMO` tiene aforo ficticio 20 (General 15, VIP 5), precios ficticios web 15.000/30.000 COP y taquilla 20.000/40.000 COP. Fechas de ensayo y admisión amplias para probar la operación; no representan datos del primer evento real. Se creó mediante `execute()` en `src/lib/service.ts`, conservando autorización, transacciones y auditoría.

Las capturas de comprobación están únicamente en `.local/verification/`, ignoradas por Git. Resend/SMTP, scheduler de emails y hardware siguen pendientes; no había una sesión Resend aportada. No se contrataron planes pagos, no se modificó DNS y no se habilitaron pagos reales. El guardado del webhook no acredita una compra sandbox aprobada; esa prueba completa sigue pendiente.

Controles públicos del deployment: POST `/api/commands` sin sesión → 401; origen ajeno → 403; intento de login demo → 403; worker sin autorización → 401; webhook sin formato/firma válida → 400. La identidad administrativa existe, está confirmada y no bloqueada; el primer intento manual de login devolvió error y requiere comprobar la contraseña elegida por el propietario. No se leyó ni cambió esa contraseña.

## Recuperación de contraseña

El propietario indicó que olvidó la contraseña de Auth y que el enlace anterior no abría un formulario. Se añadió **Olvidé mi contraseña** en `/login`, solicitud de correo en `/forgot-password` y formulario en `/reset-password`. Código UI: `src/components/recovery.tsx`; API: `src/app/api/auth/route.ts`, acciones `forgot`/`reset`; retorno: `src/app/auth/confirm/route.ts`.

El retorno intercambia el código PKCE por cookies de sesión; admite también `token_hash` de tipo recovery para una futura plantilla SMTP personalizada. Un enlace inválido/vencido regresa a la solicitud; nunca acepta un destino externo. El cambio requiere identidad verificada en servidor, origen autorizado y rate limit; actualiza exclusivamente al usuario de su sesión y cierra esa sesión. No se registran contraseñas ni credenciales de recuperación.

Se añadió el redirect exacto `https://pasecentral-demo.vercel.app/auth/confirm` en Supabase. No se modificaron plantillas: el panel actual requiere SMTP personalizado para editarlas. Se mantiene el correo predeterminado de Supabase y su flujo PKCE; pedir un enlace **nuevo desde la aplicación** y abrirlo en el mismo navegador donde se solicitó. Los enlaces anteriores del dashboard no verifican este nuevo flujo. El propietario introduce, confirma y guarda personalmente la contraseña nueva.

Fuente: https://supabase.com/docs/guides/auth/passwords. El correo predeterminado es limitado (dos correos por hora, disponibilidad de prueba); la entrega efectiva depende de Supabase. Para compradores externos se necesita SMTP propio. El email de boletas usa otro adaptador (`src/lib/delivery.ts`, Resend) y sigue pendiente.

Pruebas de recuperación: `tests/auth-recovery.test.ts`, siete casos que cubren sesión obligatoria, CSRF, identidad de sesión, cierre de sesión, solicitud no enumerativa, enlace vencido, retorno PKCE y rechazo de tipos ajenos. Lint, tipos, 43 pruebas y build aprobados. El cambio de contraseña y la entrega del correo requieren comprobación manual del propietario.

La corrección está publicada en commit `35e210e00a1b0b3b0e08307599ce13eab3846b24`; deployment `62y8VSnVfHDUnqLgVzR9dXKTnzWa`, **Ready**. Los cinco flujos Playwright de regresión pasaron. Se comprobó públicamente que un callback sin credencial redirige a `/forgot-password?invalid=1` con no-store, y que reset sin sesión devuelve 401. La solicitud hecha desde la UI publicada para el propietario fue aceptada por Supabase; esto acredita la solicitud, no la recepción del correo ni el guardado de la contraseña. Se dejó la página abierta para intervención del propietario.
