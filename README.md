# Pase Central

MVP de boletería para fiestas en Colombia. Español, COP entero y presentación de fechas en `America/Bogota`. Propietario indicado en el alcance: José Demoya.

Incluye eventos independientes, localidades y fases de precio, compradores, taquilla, reservas online, QR individuales, PDF, control de ingreso, caja, devoluciones manuales, CSV y auditoría. **El entorno local usa datos ficticios. El lanzamiento comercial requiere configurar y verificar los servicios externos y el hardware.**

## Demo conectada

Disponible en https://pasecentral-demo.vercel.app. Usa Supabase real y Wompi **sandbox**, identificado como **PRUEBAS CONECTADAS**. El administrador inicial utiliza su cuenta verificada de Supabase. El evento `Fiesta de demostración · DEMO` tiene datos ficticios y cupos disponibles; no anuncia una fiesta real. Configuración y evidencia: [docs/CLOUD_SETUP_2026-10-13.md](docs/CLOUD_SETUP_2026-10-13.md).

Los servicios de email están configurados con Resend y scheduler Supabase; la verificación operativa está en [docs/EMAIL_SETUP_2026-10-13.md](docs/EMAIL_SETUP_2026-10-13.md). Impresión y EDA51 requieren ensayo físico. La configuración conectada privada en `.env.local` cambia el modo local: para usar los perfiles ficticios descritos abajo, guardar ese archivo temporalmente en una ubicación privada fuera del checkout y ejecutar sin él. No compartir ni subir el archivo.

## Probar ahora en Windows

Requisitos: Node.js **22.14 o superior**, npm y Git. No necesitas Docker ni credenciales para la demo.

```powershell
cd "D:\My projects\pase central"
npm ci
npm run dev
```

Abre [http://127.0.0.1:3000/login](http://127.0.0.1:3000/login). Usa exactamente esta URL; la protección de origen distingue `localhost` de `127.0.0.1`.

Elige un perfil ficticio: administración, organizador, taquilla, acceso o comprador. Cada perfil tiene permisos distintos. Hay dos eventos ficticios General/VIP, sin ventas iniciales. La demo está identificada en pantalla y **se prohíbe cuando `NODE_ENV=production`**.

Flujo recomendado:

1. Administración → **Mis eventos** → **Crear evento**. Configura fechas y aforo propios. El evento comienza en borrador.
2. **Localidades y precios**: agrega General/VIP y una fase vigente para cada canal web/taquilla. No deben superponerse fases de una misma localidad y canal.
3. **Equipo**: asigna taquilla y acceso. Publica desde la pestaña **Evento**.
4. Taquilla → **Caja** → abrir caja para ese evento → **Taquilla** → vender en efectivo. Transferencia exige referencia y confirmación explícita; cortesía exige organizador y motivo.
5. Abre las boletas emitidas: descarga PDF, imprime 80 mm o comparte el PDF por WhatsApp mediante el menú del móvil. En escritorio, descárgalo y adjúntalo como Documento en WhatsApp Web.
6. Acceso → selecciona el mismo evento → recibe el QR `pc:…` del lector como teclado → Enter. La segunda lectura distinta debe indicar **Entrada ya utilizada**. El reintento de la misma solicitud recupera el resultado original.
7. Comprador → catálogo → reserva → pago ficticio identificado como DEMO → **Mis entradas**. Una orden con dos entradas genera dos QR distintos.
8. Administración → ventas del evento, reportes y auditoría. Taquilla → cierre de caja con efectivo declarado.

PGlite ejecuta PostgreSQL dentro del proceso y conserva datos en `.local/postgres/`. `.local/server-key` protege sesiones y QR cifrados. **No compartas ni subas esa carpeta**. No ejecutes dos procesos contra la misma carpeta; detén el servidor antes de usar comandos CLI de base de datos o el worker demo. Para empezar de nuevo, con el servidor detenido, mueve `.local` a una copia privada y vuelve a iniciar. Conservar la base sin su clave impide recuperar los QR.

## Stack y archivos

| Componente | Versión fijada | Ubicación |
| --- | --- | --- |
| Next.js App Router / React | 16.4.0 / 19.3.0 | `src/app/`, `src/components/` |
| TypeScript / Tailwind | 6.0.3 / 4.3.3 | `tsconfig.json`, `src/app/globals.css` |
| Supabase SSR / JS | 0.12.7 / 2.117.3 | `src/lib/auth.ts` |
| PostgreSQL / PGlite / pg | local Supabase 17 / 0.5.8 / 8.23.1 | `src/lib/db.ts`, `supabase/migrations/` |
| Zod | 4.6.6 | `src/lib/validation.ts` |
| QRCode / pdf-lib | 1.5.4 / 1.17.1 | `src/lib/pdf.ts` |
| QZ Tray JS | 2.3.0 | `src/lib/printer.ts`, `src/app/api/printing/` |
| Vitest / Playwright | 5.0.3 / 1.64.0 | `tests/`, `playwright.config.ts` |

`package.json` y `package-lock.json` fijan las versiones completas. Arquitectura y mapa de funciones: [docs/DECISIONS.md](docs/DECISIONS.md). Operación detallada: [docs/OPERATIONS.md](docs/OPERATIONS.md). Estado de entrega: [docs/PROGRESS.md](docs/PROGRESS.md).

## Variables de entorno y Supabase

`.env.example` no contiene secretos. Copia a `.env.local` solo cuando configures un ambiente; está ignorado por Git. Next.js y los comandos `tsx` cargan ese archivo. La demo funciona sin él.

Para Supabase local con Auth real, inicia Docker Desktop y ejecuta:

```powershell
npx supabase start
```

El CLI usa `supabase/config.toml` y las migraciones versionadas. Obtén las claves locales desde `npx supabase status` **sin guardarlas en documentación ni Git**. Configura `.env.local` con:

- `APP_MODE=production` (modo con identidad real; el ambiente Wompi puede continuar en sandbox).
- `APP_URL=http://127.0.0.1:3000` para desarrollo. En hospedaje usa el origen HTTPS real.
- `DATABASE_URL`: conexión PostgreSQL del servidor, con permisos para tablas y transacciones; para Supabase local, usa la conexión mostrada por el CLI. Para Supabase remoto, usa conexión directa o pool en modo sesión. Configura TLS y verificación de CA según el proveedor; no deshabilites validación de certificados.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: claves públicas de Auth.
- `TICKET_ENCRYPTION_KEY`: 32 bytes en hexadecimal; `SESSION_SECRET`: secreto aleatorio independiente. Nunca uses las claves demo en producción.

Genera cada secreto por separado en tu terminal privada:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Para aplicar migraciones mediante la conexión configurada:

```powershell
npm run db:migrate
```

Las migraciones registran también su aplicación para evitar duplicarlas cuando el CLI de Supabase las haya ejecutado primero. No ejecutes `supabase db reset` sobre datos que necesites conservar: reinicia destructivamente la base. El seed de usuarios ficticios solo se permite en modo demo. **No se probó Supabase local ni remoto en esta entrega: el motor Docker estaba detenido y no se proporcionaron credenciales.**

### Administrador inicial

1. Registra y verifica la cuenta mediante Supabase Auth o su consola. Confirma el UUID del usuario real.
2. Con `.env.local` configurado para Supabase, ejecuta localmente:

```powershell
npm run bootstrap -- UUID_DEL_USUARIO_AUTH "Nombre real de la organización"
```

Solo funciona cuando no existe un administrador. Crea perfil, organización inicial y registro de auditoría. No hay endpoint público de bootstrap ni autoasignación de privilegios. El administrador asigna organizadores y personal desde **Equipo y usuarios**. No inventes el aforo o la fecha del primer evento.

### Wompi sandbox

Configura `WOMPI_ENV=sandbox`, `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET` del mismo comercio/ambiente. Registra el webhook HTTPS `/api/webhooks/wompi` y el retorno `/checkout/result`. Las claves públicas sandbox deben comenzar con `pub_test_`.

El servidor firma referencia, importe en centavos, COP y vencimiento. Verifica el checksum según las propiedades recibidas y **consulta la transacción mediante la API autenticada del proveedor** antes de emitir. Una notificación repetida no duplica entradas; las notificaciones de rechazo posteriores no revierten una aprobación. Conciliación manual: ventas del evento → orden → **Conciliar Wompi**.

Fuentes primarias utilizadas: [Checkout Wompi](https://docs.wompi.co/docs/colombia/widget-checkout-web/) y [eventos y checksum](https://docs.wompi.co/docs/colombia/eventos/). Sandbox real y producción requieren prueba con tus credenciales. No se realizaron cobros reales.

### Email y cola

El adaptador real usa Resend por HTTP con `EMAIL_API_KEY` y `EMAIL_FROM` verificado. Configura dominio, DKIM/SPF y remitente en tu cuenta. Cada emisión con email crea un `delivery_jobs` persistente. Ejecuta el worker cada minuto con tu scheduler del hosting, mediante **POST** `/api/worker` con `Authorization: Bearer WORKER_SECRET`, o `npm run worker` en un proceso programado con las mismas variables.

Cada correo incluye el QR de cada entrada dentro del mensaje y un PDF individual adjunto, además del enlace protegido para consultar el estado. Aplica `003_email_attachments.sql` antes de desplegar: el contenido del correo se congela cifrado para que los reintentos conserven el mismo payload/idempotencia. Usa `pdf-lib` y `qrcode`; los documentos no se alojan públicamente. Algunos clientes bloquean imágenes incrustadas: los PDFs siguen disponibles.

El worker usa bloqueo `SKIP LOCKED`, reintentos con espera creciente, recuperación de trabajos abandonados e idempotencia del proveedor. Fallar el email no revierte el cobro. Tras seis intentos revisa configuración y usa **Reintentar email**. En demo, las operaciones procesan automáticamente el outbox privado `.local/outbox/`, sin enviar mensajes. No programes un segundo proceso PGlite mientras esté abierto el servidor.

### Impresión y EDA51

Impresión por navegador disponible: **Imprimir 80 mm**, selecciona papel 80 mm y desactiva encabezados/pies del navegador. Registra solicitud y trabajo enviado; el diálogo no garantiza papel impreso.

Para QZ Tray instala su aplicación y el driver del modelo homologado. Configura `NEXT_PUBLIC_QZ_PRINTER` con el nombre exacto, `QZ_CERTIFICATE_PEM` y `QZ_PRIVATE_KEY_PEM` con certificado/clave de firma del servidor. El adaptador envía ESC/POS con QR nativo; solo firma operaciones de impresión autorizadas y restringe el nombre de impresora. Certificado, licencia, driver, encoding y comandos de corte deben homologarse con el equipo. Nunca publiques la clave privada.

EDA51: navegador con sesión del operador, evento correcto, campo QR enfocado, scanner configurado como entrada de teclado y sufijo Enter. No hay autorización offline. Hardware, papel, contraste, margen QR y latencia menor a dos segundos requieren pruebas físicas pendientes. Consulta contingencias en [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Comprobaciones

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright inicia su servidor en `127.0.0.1:3100` y usa una base demo aislada por ejecución. Comprueba creación de dos fiestas, venta física, PDF, ingreso único, caja, compra online demo, autorización, CSV y diseño móvil. Los resultados y trazas se guardan en carpetas ignoradas. La concurrencia automatizada usa PostgreSQL embebido; antes de abrir ventas reales hay que repetirla con varias conexiones en Supabase y dispositivos representativos.

`npm run build` compila sin credenciales, pero el servidor real las requiere en ejecución. Para hosting Next.js usa `npm run build` y `npm start` con Supabase configurado. Esta entrega publica **código en GitHub**, no despliega un dominio comercial.

## Pendientes antes de abrir ventas reales

Lee [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md): credenciales y pruebas de Supabase/Wompi/email, autenticación verificada, privacidad y condiciones definitivas, definición fiscal, fecha/aforo, red del recinto, impresora, EDA51, pruebas concurrentes multiconexión y recuperación. No interpretar las pruebas locales como aprobación de estos requisitos.
