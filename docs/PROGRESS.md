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
