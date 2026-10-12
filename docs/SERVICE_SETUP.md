# Cuentas y datos para conectar la demo · 2026-10-12

La demo local ya funciona sin cuentas externas, con datos ficticios persistentes. Para probar autenticación real, pagos sandbox, correos y varios dispositivos se necesita un ambiente conectado. No crear tablas o roles manualmente: el repositorio contiene las migraciones y el bootstrap.

## 1. Supabase

Crear cuenta en https://supabase.com/dashboard y un proyecto dedicado, por ejemplo `pasecentral-staging`. Conservar la contraseña de base de datos en un gestor privado. Obtener desde **Connect** la URL del proyecto, la clave pública y la conexión PostgreSQL. Para la configuración local actual, elegir Session pooler si la red es IPv4; la conexión del hosting se seleccionará según su entorno. El programa usa transacciones de `pg`.

Variables del proyecto:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: admite la clave pública publishable actual; el nombre de esta variable se conserva por compatibilidad con el código. No requiere clave `service_role` ni clave secret de Supabase.
- `DATABASE_URL`: conexión PostgreSQL completa con contraseña correctamente codificada; exclusivamente servidor.

Activar inicio de sesión por email/contraseña y confirmación de correo. Configurar Site URL y redirecciones para el origen de la aplicación. Para confirmar cuentas fuera del equipo de Supabase se configura SMTP propio; el SMTP predeterminado está restringido y no debe suponerse disponible para cualquier comprador.

Aplicaremos `npm run db:migrate` con las variables correctas. Esto crea las tablas, políticas RLS, funciones y bucket privado `tickets`. Crear/verificar la cuenta que será administradora; obtener su UUID y ejecutar `npm run bootstrap -- UUID "Nombre de organización"`. No editar metadatos de usuario para asignar roles.

Fuentes: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [conexión PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [SMTP Auth](https://supabase.com/docs/guides/auth/auth-smtp).

## 2. Wompi Colombia

Crear cuenta del comercio/organizador en https://comercios.wompi.co. Empezar exclusivamente en sandbox. Obtener las cuatro credenciales del mismo ambiente:

- `WOMPI_PUBLIC_KEY`: prefijo `pub_test_`.
- `WOMPI_PRIVATE_KEY`: prefijo `prv_test_`.
- `WOMPI_INTEGRITY_SECRET`: prefijo `test_integrity_`.
- `WOMPI_EVENTS_SECRET`: prefijo `test_events_`.
- `WOMPI_ENV=sandbox`.

Cuando exista URL pública HTTPS, registrar URL de eventos `https://HOST/api/webhooks/wompi`. La aplicación genera retorno a `/checkout/result`. No registrar localhost como destino del proveedor: Wompi no puede llamar a la máquina local mediante loopback. Se necesita hosting o túnel HTTPS para pruebas del webhook.

La cuenta comercial/validaciones necesarias para cobrar realmente son un paso posterior. No activar llaves de producción para esta demo conectada.

Fuentes: [ambientes y llaves](https://docs.wompi.co/docs/colombia/ambientes-y-llaves/), [eventos](https://docs.wompi.co/docs/colombia/eventos/).

## 3. Resend

Crear cuenta en https://resend.com, agregar y verificar dominio/subdominio de envío mediante los registros DNS mostrados por Resend, y crear API key de envío. Se puede usar un dominio ya existente; no hace falta comprar otro si se dispone de uno adecuado y acceso a DNS.

Variables: `EMAIL_API_KEY` y `EMAIL_FROM`, por ejemplo `Pase Central <entradas@correo.pasecentral.com>` **solo si ese dominio es propiedad del usuario y está verificado**. El adaptador transaccional usa HTTP; la misma cuenta Resend permite configurar SMTP en Supabase Auth para confirmaciones de cuenta. Son dos configuraciones distintas: poner EMAIL_API_KEY en la app no configura automáticamente el SMTP de Supabase.

Debe programarse la cola persistente de entrega: endpoint POST `/api/worker`, autorizado con `WORKER_SECRET`, o proceso `npm run worker` con conexión SQL del servidor. Seleccionar scheduler compatible con el hosting; no asumir que cualquier cron llama por POST ni que todas las frecuencias están disponibles en todos los planes.

Fuentes: [dominios Resend](https://resend.com/docs/dashboard/domains/introduction), [SMTP Resend](https://resend.com/docs/send-with-smtp).

## 4. Hosting y dominio

Para una demo accesible desde varios equipos, Vercel soporta Next.js y conexión con GitHub: crear cuenta y seleccionar el repositorio `clubgamerzone/pasecentral.com-`. La URL temporal del hosting puede servir para probar web y webhook; el dominio comercial no es requisito inicial. Ajustar variables y scheduler antes de publicar. Si ya hay hosting, revisar su compatibilidad y usarlo cuando sea adecuado.

En ambiente hospedado: `APP_MODE=production` para identidad/SQL reales, pero `WOMPI_ENV=sandbox` para pagos de prueba. El código prohíbe `APP_MODE=demo` cuando Node está en producción. `APP_URL` debe ser el origen HTTPS exacto. Este nombre de modo no significa que se vaya a cobrar dinero real.

Fuente: [Next.js en Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

## 5. Datos que debe confirmar el usuario

- Nombre de organización, nombre/email del administrador inicial y UUID de su cuenta verificada.
- Dominio disponible y dónde se administran sus DNS; remitente deseado.
- Cuentas/proyectos creados y objetivo: pruebas locales conectadas o URL pública para compartir.
- Dos eventos ficticios para ensayo: nombre, recinto, fechas/horarios, aforo, cupo/precios General/VIP y operadores.
- Si se prueba hardware: modelo exacto de impresora y sistema operativo, Android/navegador del EDA51 y scanner como teclado.

Las credenciales se guardan en `.env.local`, que Git ignora, o en variables secretas del hosting. No enviarlas por chat ni ponerlas en documentación. Podemos configurar lo necesario desde ese archivo privado. `TICKET_ENCRYPTION_KEY`, `SESSION_SECRET` y `WORKER_SECRET` se generan localmente; no requieren cuentas externas. QZ Tray es opcional para impresión directa; el diálogo del navegador ya está disponible.

Orden propuesto: Supabase → hosting/URL HTTPS → Wompi sandbox → Resend/SMTP/cola → ensayo completo y hardware. Antes de un evento comercial completar `LAUNCH_CHECKLIST.md`.
