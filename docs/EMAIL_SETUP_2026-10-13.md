# Correo conectado · 2026-10-13

## Resend y DNS

Se usaron las pestañas Chrome del propietario en Resend (`clubgamerzone`) y HostGator. El propietario confirmó clubgamerzone.com y autorizó tres registros de envío, dos claves restringidas y su almacenamiento en Supabase/Vercel/configuración local privada.

Se verificó `pasecentral.clubgamerzone.com` en Resend, región São Paulo. En HostGator → Domains → clubgamerzone.com → Manage Advanced DNS Records se agregaron:

| Tipo | Host relativo a clubgamerzone.com | Valor |
|---|---|---|
| TXT | resend._domainkey.pasecentral | Clave pública DKIM exacta mostrada por Resend |
| CNAME | rsend.pasecentral | rsend-sae1.forge.rmta.net |
| CNAME | send.pasecentral | send.forge.rmta.net |

TTL: cuatro horas. Google/Cloudflare DNS mostraron los registros y Resend confirmó **verified** para los tres. Los NS directos devolvieron resultados diferentes durante la actualización; la verificación de Resend y los resolvers públicos fue posterior. No se modificaron sitio, MX/SPF/DKIM existentes del dominio principal. No se activó recepción ni el DMARC opcional sugerido para el dominio raíz.

Claves separadas **Sending access**, restringidas al subdominio verificado: `Pase Central · Supabase Auth` y `Pase Central · Boletas staging`. Se ocultaron después de capturarlas; no están en Git, capturas públicas ni documentación.

## Supabase Auth

Proyecto pasecentral.com-demo → Authentication → Emails → SMTP Settings. SMTP guardado y comprobado tras recargar: host smtp.resend.com, puerto TLS 465, usuario resend, contraseña = clave exclusiva de Auth. Remitente no-reply@pasecentral.clubgamerzone.com, nombre Pase Central · pruebas; intervalo por usuario 60 segundos. El panel indica 30 correos Auth por hora para SMTP personalizado; se mantienen las protecciones.

El propietario consiguió iniciar sesión. Se comprobó `/admin` con rol de administrador y eventos independientes. No se leyó ni cambió su contraseña; no es necesario solicitar otro reset.

## Boletas y worker

Adaptador: src/lib/delivery.ts, cola delivery_jobs, enlaces cifrados, idempotencia y reintentos. EMAIL_API_KEY y EMAIL_FROM=`Pase Central · pruebas <entradas@pasecentral.clubgamerzone.com>` se guardaron en .env.local privado y Vercel pasecentral-demo, como **Secret** exclusivamente para Production (la app sigue staging/Wompi sandbox). La clave de Auth se guarda solamente en SMTP de Supabase.

Configuración versionada del scheduler: scripts/configure-email-worker.ts, comando worker:configure. Ejecutado en Windows:

```powershell
node --env-file=.env.local --import tsx scripts/configure-email-worker.ts https://pasecentral-demo.vercel.app --apply
```

pg_cron y pg_net habilitados; job pasecentral-delivery cada minuto. Sólo hace POST a /api/worker cuando hay entregas pendientes vencidas o bloqueadas que recuperar. WORKER_SECRET se guarda cifrado en Vault; el comando contiene referencias, no el valor. El endpoint valida autorización; la cola conserva idempotencia. Pausar con cron.alter_job(active=false); la reconfiguración válida lo reactiva. No editar cron.job directamente: pertenece a Supabase.

**Restricción comprobada:** postgres no puede revocar los permisos predeterminados de pg_net, porque supabase_admin es su propietario. Los headers HTTP transitorios son legibles por roles con conexión SQL. Se verificó que anon/authenticated/service_role no tienen LOGIN SQL y Data API sólo expone public/graphql_public; Accept-Profile: net devuelve 406/PGRST106. El script exige esta comprobación HTTP antes de activar el job y verifica Vault privado. En Windows usa PowerShell 7 para comprobar HTTP; otros sistemas usan fetch. No exponer net, crear wrappers públicos de su cola ni conceder LOGIN SQL a servicios no confiables. Vault no impide que los headers salientes estén transitoriamente descifrados en pg_net.

Fuentes: [Resend SMTP](https://resend.com/docs/send-with-supabase-smtp), [dominios](https://resend.com/docs/dashboard/domains/introduction), [scheduler](https://supabase.com/docs/guides/functions/schedule-functions), [permisos pg_net](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16), [headers](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357).

## Verificación

Lint, tipos, 45 pruebas Vitest y build aprobados. Dominio, claves restringidas, SMTP persistido, sesión administrativa, variables Vercel y job activo comprobados. Pendiente verificar deployment con variables nuevas y entrega de boleta ficticia por la cola. Capturas privadas: .local/verification/, ignoradas. No se solicitó otro reset ni se enviaron mensajes a clientes.
