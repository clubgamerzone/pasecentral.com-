# Estado de entrega · 2026-10-12 · America/Bogota

## Entregado

Trabajo iniciado el 2026-10-11 y finalizado el 2026-10-12. Proyecto iniciado desde `AGENTS.md.txt`. Se implementaron las entregas de software del MVP:

- Next.js/TypeScript, diseño responsive, español, COP y fechas en Bogotá.
- Cinco perfiles/roles, Supabase Auth preparado y acceso demo exclusivamente local.
- Organización inicial, varias fiestas, borradores/publicación, localidades y fases por canal, personal por evento.
- Venta presencial, transferencias verificadas, cortesías autorizadas, reservas online y adaptador Wompi.
- Transacciones SQL reales y bloqueo de evento; cupo total/localidad, precios históricos e idempotencia.
- Emisión individual con número, serial, hash QR y token cifrado. PDF, enlace privado revocable y WhatsApp manual.
- Validación online, un solo ingreso, request_id de reintento, consulta/confirmación manual, ventana y permisos.
- Apertura/cierre y movimientos de caja; efectivo separado de transferencias/Wompi; devoluciones registradas con entradas afectadas.
- Reimpresión sin duplicación, adaptadores navegador/QZ, estados de solicitud/envío y confirmación física explícita por operador.
- Dashboard consolidado/evento/periodo, cobros, ventas por localidad/fase/canal/operador, asistencia, incidencias, CSV y auditoría.
- Cola de emails persistente, Resend preparado, outbox ficticio local y reintentos sin pérdida de venta.
- Migraciones, RLS y permisos SQL; bucket privado de entradas; bootstrap administrativo por CLI.
- Documentación de instalación/funciones/cloud/operación y workflow de comprobaciones GitHub Actions.

## Verificado localmente

- `npm run lint`: pasó, sin errores ni advertencias en la ejecución final previa a documentación.
- `npm run typecheck`: pasó.
- `npm run test`: **36 pruebas** pasaron usando las migraciones PostgreSQL reales en PGlite.
- `npm run build`: compilación de producción pasó sin servicios externos.
- `npm run test:e2e`: **5 flujos Chromium** pasaron: dos fiestas creadas/configuradas/publicadas; venta física + PDF + acceso único + caja; compra múltiple demo; permisos/CSRF/CSV; escritorio y móvil sin overflow horizontal.
- Capturas revisadas visualmente: `test-results/dashboard-desktop.png`, `test-results/catalog-mobile.png` (ignoradas por Git; regenerables mediante E2E).
- `npm audit --omit=dev`: sin vulnerabilidades reportadas en ejecución. Auditoría completa: cinco avisos altos de la cadena de lint, descritos en `DECISIONS.md`.
- Remote indicado por usuario estaba vacío al inspeccionarlo. Git inicializado con rama `main` y remote del usuario.

Las pruebas de reglas cubren cupos concurrentes, reservas/vencimiento/pago tardío, múltiples QR, permiso y RLS, fases/precios históricos, reimpresión y sustitución, lectura doble/reintento, anulación/otro evento/horario, email fallido con reintento, caja, devoluciones y neutralización CSV. PGlite serializa un solo backend: falta certificar concurrencia de varias conexiones Supabase bajo carga representativa.

## Correcciones encontradas durante la verificación

Preparación de migraciones con `exec` de PGlite para SQL de varias sentencias; estrechamiento TypeScript de errores; conversión explícita de enteros en cierre SQL; identificadores de campos únicos para evitar que una etiqueta llenara otro formulario; espera de apertura de caja en el flujo browser; selección explícita de evento demo en pruebas; aserción COP compatible con espacio localizado; base E2E aislada por ejecución. Se incorporaron devoluciones en efectivo al cálculo de caja y devoluciones de pagos tardíos sin boletas.

## No verificado / configuración externa pendiente

- Docker estaba instalado, pero su motor no estaba activo. Supabase local con Docker y Supabase remoto/Auth real no se ejecutaron.
- No había credenciales de Wompi ni Resend. Adaptadores implementados; sandbox real, cobros, email real y sus webhooks requieren ensayo con credenciales del organizador.
- No se conectó impresora ni Honeywell EDA51. No se certificó ESC/POS, QZ Tray, QR en papel, scanner/Android/navegador ni latencia menor de dos segundos.
- No se configuraron dominio/hosting, scheduler externo, DNS ni backups de proveedor; no se publicó un sitio comercial.
- Fecha y aforo del primer evento, marca, políticas, definición fiscal, contacto y conectividad siguen pendientes. Datos demo no sustituyen esos datos.
- CI remoto comprobado con éxito para el commit publicado `adb8c9bde8aff64428791b6f59d267132da79072`: lint, tipos, 36 pruebas, build y los 5 flujos Chromium en Ubuntu. Ver registro de publicación al final.

El **MVP de software local es ejecutable**. El lanzamiento para operar un evento real está condicionado a `LAUNCH_CHECKLIST.md`. No hubo cobros reales ni mensajes a clientes.

## Retomar trabajo

Leer `AGENTS.md`, este archivo y `README.md`. Ejecutar `npm ci` y `npm run dev`; abrir `http://127.0.0.1:3000/login`. El mapa permanente de pantallas/código y procedimientos está en `OPERATIONS.md`. Actualizar documentación después de cambios y conservar secretos/datos locales fuera de Git.

## Referencia Git de la implementación

Commit de aplicación y documentación inicial: `f2307b506b3a81fcb702ad90a8d65c816a53b844`.
Repositorio autorizado: https://github.com/clubgamerzone/pasecentral.com-.git, rama `main`.
La actualización de este registro queda en un commit de documentación posterior. Para identificar la revisión final publicada: `git rev-parse HEAD` y `git ls-remote origin refs/heads/main` deben coincidir.

La última compilación también verificó que los manifiestos de trazado de Next no incluyeran `.local/server-key`, `.local/` ni `.env.local`. El acceso dinámico a la carpeta demo quedó limitado a subdirectorios de `.local`, y `next.config.ts` excluye explícitamente datos/secretos locales de los artefactos de servidor.

## Publicación y CI verificados (2026-10-12)

Código publicado y HEAD remoto/local confirmados: `adb8c9bde8aff64428791b6f59d267132da79072`.
GitHub Actions completó correctamente [Verify MVP, ejecución 38206422699](https://github.com/clubgamerzone/pasecentral.com-/actions/runs/38206422699). La revisión posterior solo actualiza documentación.

El push usó la cuenta existente con `git -c credential.username=clubgamerzone -c credential.interactive=false push -u origin main`; los parámetros son locales a ese comando y no guardan secretos en el repo. Verificación posterior: `git ls-remote origin refs/heads/main`.

Demo comprobada en `http://127.0.0.1:3000/login` con respuesta 200; base de trabajo inicial con dos eventos ficticios y cero órdenes. El servidor fue iniciado mediante `npm run dev`. No se desplegó el dominio comercial.

## Preparación de servicios · 2026-10-12

Se agregó docs/SERVICE_SETUP.md con cuentas, variables, pasos Supabase/Wompi sandbox/Resend/hosting y datos que debe confirmar el usuario. Se consultaron fuentes oficiales vigentes. Supabase acepta clave pública publishable en la variable existente NEXT_PUBLIC_SUPABASE_ANON_KEY. Se distinguió SMTP de Auth frente a emails de boletas y la necesidad de URL pública para webhooks. No se crearon cuentas ni se configuraron credenciales: .env.local aún no existe. Cambios exclusivamente documentales; las pruebas de código anteriores siguen siendo la referencia.

## Servicios conectados · 2026-10-13

Ver docs/CLOUD_SETUP_2026-10-13.md. Supabase real: migraciones aplicadas, 22/22 tablas con RLS, bucket privado, administrador verificado y bootstrap. Wompi: llaves sandbox privadas guardadas localmente y consulta del comercio HTTP 200. Se añadió soporte CA TLS verificada y límite configurable de conexiones en src/lib/db.ts; ambiente staging explícito en config/state/UI. Ensayo SQL multiconexión pasó (sin sobreventa, sin ingreso doble, emisión de tres QR distintos), conservando dos eventos DEMO con ventas cerradas. Se añadió npm run test:connected para repetirlo exclusivamente en staging/sandbox. Regresión: lint, tipos, 36 pruebas, build y 5 flujos browser aprobados. Vercel autorizado y preparado, aún pendiente de deploy verificado; Resend/SMTP y hardware sin configurar. No se guardaron secretos en documentación/Git.

### Despliegue conectado completado

Vercel `pasecentral-demo` listo en https://pasecentral-demo.vercel.app, código inicial `db8f558`. Variables privadas Secret limitadas al destino Production; app staging y Wompi sandbox. Supabase Site URL/redirect exacto y webhook Wompi sandbox guardados. GET público `/api/state` 200 confirmó staging, demo false y aislamiento de datos administrativos. Se publicó un tercer evento ficticio General/VIP con cupos para pruebas manuales. El propietario debe comprobar su login en el dominio; compra sandbox completa, email transaccional y hardware continúan pendientes. Procedimiento y evidencia en CLOUD_SETUP_2026-10-13.md.

El propietario olvidó su contraseña Auth. Se implementó solicitud y formulario de recuperación con callback Supabase, autorización/CSRF y cierre de sesión tras guardar. Se configuró el redirect exacto; se conserva la plantilla predeterminada porque no hay SMTP propio. Siete pruebas de seguridad nuevas; lint, tipos, 43 pruebas y build aprobados. Recuperación real por correo y acceso del propietario pendientes de su intervención; el agente no cambia su contraseña.

Corrección `35e210e` desplegada Ready; 5 E2E aprobados. Solicitud de recuperación aceptada desde la UI publicada; reset sin sesión → 401 y callback sin credencial → retorno controlado. Pendiente que el propietario reciba el correo, guarde personalmente la contraseña e inicie sesión. Los límites de correo Supabase y Resend para boletas se documentaron sin afirmar entrega verificada.

Se comprobó la opción **Send password recovery** del usuario en Supabase y se añadió soporte a sus enlaces implícitos, además de PKCE. El cliente limpia la credencial del fragmento antes de intercambiarla; el servidor verifica identidad. Dos pruebas unitarias adicionales rechazan tokens inválidos/identidad no verificable; la regresión de navegador comprueba limpieza de URL sin conceder sesión. La guía evita confundir contraseña Auth con contraseña PostgreSQL. Recuperación manual efectiva sigue pendiente.

Validación de esta corrección: lint y tipos sin errores/advertencias, 45 pruebas Vitest, 6 flujos Playwright y build aprobados. No se cambió ninguna contraseña ni se certificó la recuperación manual del propietario.

Bloqueo comunicado posteriormente: Supabase rechazó otro correo de recuperación con `email rate limit exceeded`. Se confirmó en documentación oficial el límite compartido de dos correos por hora del SMTP incorporado. Pendiente esperar la ventana o configurar SMTP propio; no se debilitaron controles de Auth. Detalles en CLOUD_SETUP_2026-10-13.md.

## Resend y correo conectado · 2026-10-13

Ver EMAIL_SETUP_2026-10-13.md. Subdominio verificado, tres registros DNS autorizados, dos claves Sending access restringidas. SMTP guardado y comprobado tras recargar; el propietario inició sesión y se verificó su panel administrativo. Variables EMAIL guardadas como Secret en Vercel y archivo privado. Scheduler cada minuto configurado con Vault y comprobación de que net no está expuesto por Data API. Lint, tipos, 45 pruebas y build pasaron. Deployment de variables y entrega efectiva aún por verificar.

Verificación completada: código/configuración `39a2cf7` desplegados Ready. Una cortesía ficticia para el propietario generó una entrega; pg_cron la procesó automáticamente, worker HTTP 200, sent en un intento sin error. Resend mostró Delivered para la boleta y para recuperación Auth; sesión del administrador comprobada. No hubo pago real ni mensajes a clientes. Hardware y compra Wompi sandbox completa siguen pendientes.

## Guía de ensayo operativo (2026-10-13)

Se añadió `docs/TEST_REHEARSAL.md`: preparación de cuentas/asignaciones y dos eventos ficticios, configuración inicial del EDA51 como teclado, diagnóstico de sufijo Enter/foco, matriz de acceso con resultados pendientes y ensayo de venta, correo, impresión de 80 mm, caja y permisos. Se revisaron `Access` en `src/components/operations.tsx`, checkout en `src/components/buyer.tsx` y fuentes oficiales Honeywell/Wompi. No se modificó código ni se configuró hardware; no se afirma aprobación de checkout completo ni dispositivos. Verificación de entrega documental mediante `git diff --check`. Hash localizable con `git log -1 -- docs/TEST_REHEARSAL.md`.

Seguimiento EDA51: propietario confirmó Android 8.1.0 y Chrome; impresión aplazada. Consulta de solo lectura Windows mostró EDA51/WPD OK; ADB instalado en Android SDK, pero sin dispositivos en `adb devices -l`. Se documentó la configuración inicial Standard/Normal, sufijo y teclas, y la advertencia oficial sobre Keyboard en revisiones antiguas de Android 8. No se cambió el equipo ni se verificó escaneo físico. La versión de Chrome, compilación/MR y ensayo real quedan pendientes.

Incidencia reportada: EDA51 permanece en «Preparando tu espacio». API pública comprobada desde PC con HTTP 200; causa en dispositivo todavía sin confirmar. Se solicitó versión de Chrome/diagnóstico USB y se documentó el requisito Chrome 111+ del Next.js instalado. No se aplicó corrección especulativa; pendiente observar versión, conectividad y error real en el equipo. Detalles en TEST_REHEARSAL.md.

ADB autorizado y conectado: versión instalada de Chrome comprobada `70.0.3538.110`, Android 8.1.0. Incompatibilidad con mínimo Chrome 111 identificada; logcat acotado no aportó excepción JavaScript. Se indicó actualización oficial de Chrome y posterior ensayo; actualización/carga/escaneo siguen pendientes. Sin instalación de APK ni cambios de firmware/código.

Propietario confirmó que la página abre después de actualizar; ADB comprobó Chrome activo 101.0.4951.61, aún inferior al mínimo documentado 111. Lectura suena/vibra pero el campo queda vacío: ensayo físico pendiente, investigar foco/Wedge/perfil/Data Intent. Data Collection Service 1.97.00.0245; configuración privada no legible por ADB, sin cambiar permisos. Se documentaron pasos de diagnóstico en TEST_REHEARSAL.md. Sin aceptación de boleta ni corrección especulativa de código.
## Acceso sin selección de evento y validación automática (2026-10-13)

Implementado `scan_auto` que identifica evento por hash del QR y aplica el check-in transaccional existente; rechazo sin datos de evento para operador no autorizado. `/access` sin selector, lectura automática sin Enter, botón opcional/reintento y aviso grande verde/rojo que muestra evento autorizado, se cierra solo y conserva foco. Búsqueda manual entre eventos asignados y permiso vigente comprobado también en reintentos.

Lint, tipos, 47 pruebas Vitest, 6 flujos Playwright y build pasaron. Playwright comprobó validación sin botón, popup, duplicado y recuperación de respuesta perdida con mismo request_id; tests de reglas comprobaron resolución de otro evento e impedimento de ingreso/revelación sin permiso. Hardware pendiente: el último reporte indicó pitido sin texto y Wedge requiere configuración. No se afirma lectura física homologada. Implementación en operations.tsx/service.ts/validation.ts; guía en OPERATIONS.md, TEST_REHEARSAL.md y decisión en DECISIONS.md. Commit consultable con `git log -1 -- src/components/operations.tsx`. Publicación en staging pendiente de comprobar al registrar esta nota.

Publicación verificada: `58ae71d` Ready en Vercel, deployment `5RfnuYeAiEeFad6uP1m49VohVMA1`. Se recargó `/access` en sesión administrativa existente del navegador del PC: selector ausente, instrucciones de evento por QR y campo enfocado. Dos textos ficticios desconocidos enviados al campo se procesaron automáticamente y devolvieron «Entrada no encontrada» sin pulsar Validar; campo volvió vacío/enfocado, ninguna boleta consumida. Evidencia privada en `.local/verification/access-auto-result.png`. Popup/cierre y pérdida de respuesta comprobados mediante Playwright; escaneo físico del EDA51 todavía pendiente.
## Datos de Nequi para sandbox (2026-10-13)

Captura aportada por el propietario mostró «Número no válido en Sandbox». Documentación oficial consultada: Nequi sandbox admite 3991111111 para APPROVED y 3992222222 para DECLINED; otros números generan ERROR. Instrucciones añadidas a TEST_REHEARSAL.md, sin datos personales ni capturas en Git. Sin cambios de código ni transacción ejecutada; aprobación y webhook completos siguen pendientes de comprobar. Verificación documental: git diff --check.
