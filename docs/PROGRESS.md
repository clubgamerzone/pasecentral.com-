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
## QR/PDF en correo y compartir archivos (2026-10-13)

Implementados QR incrustados CID y un PDF por entrada en `src/lib/ticket-email.ts`; cola con snapshot cifrado de adjuntos en delivery.ts/migración 003. Migración aplicada en Supabase con `node --env-file=.env.local --import tsx scripts/migrate.ts`. Se restringió lectura de la columna cifrada a usuarios cliente; sin buckets públicos. Compartir PDF desde Tickets usa Web Share de archivos con documento preparado antes del clic, o descarga e instrucciones para adjuntar en WhatsApp Web. El propietario aplazó WhatsApp automático; no se configuró ni prometió envío automático al comprar.

48 pruebas Vitest y 6 Playwright pasaron; build correcto. Test nuevo verifica dos PDFs de una página y QR distintos, payload idéntico tras fallo/reintento, venta persistente y columna protegida. Playwright verifica archivo PDF en el menú de compartir simulado y descarga alternativa; no envió a WhatsApp real. Lint/tipos ejecutados; verificación final después de los cambios de tests pendiente al registrar esta nota. Publicación y email real con adjuntos aún por verificar. Commit de implementación consultable con `git log -1 -- src/lib/ticket-email.ts`.

Verificación final completada: lint/tipos pasaron después de los cambios de tests. `ecc1581` Ready en Vercel, deployment `FGt57C5AZpjdTQ6hsgPkZDed8y91`; botón Compartir PDF por WhatsApp presente en una boleta de la demo. Reenvío autorizado de una orden DEMO existente únicamente al propietario, sin emitir ni consumir boletas nuevas. Scheduler procesó el job en un intento: sent, payload con 1 PDF y 1 QR CID; Resend mostró Delivered para «Tus entradas y QR · Pase Central». Privilegio de lectura de email_payload_encrypted para authenticated comprobado false en Supabase. Evidencia privada `.local/verification/pdf-email-delivered.png`; helpers de diagnóstico permanecen ignorados. No se comprobó envío a un chat WhatsApp real ni lectura del correo por el destinatario.
## Mi perfil e invitaciones por rol y eventos (2026-10-13)

Añadido menú Mi perfil para todas las cuentas: nombre/teléfono/bio, foto privada normalizada con Sharp 0.35.5, quitar foto y consulta de permisos. API de avatar autenticada con validación/origen/límites; correo de identidad de solo lectura. Equipo y usuarios permite invitaciones de administrador global con rol y varios eventos, cola Resend, reenvío/revocación y aceptación transaccional con correo verificado. Organizador por evento se limita a event_staff y sus eventos; token/rol/eventos no se confían al cliente. Listado de personas de organizadores restringido a sus asignaciones.

Migración 004 aplicada en Supabase; cron actualizado para incluir invitaciones pendientes usando el script existente. Sin claves/cuentas nuevas. 53 Vitest y 7 Playwright pasaron; ensayo incluye foto privada, flujo de invitación multievento, rechazos de identidad/permiso, privacidad de tokens y estados. La primera pasada E2E pidió el avatar antes de terminar logout; se corrigió la espera de navegación y la segunda pasada pasó. Lint/tipos/build en verificación final. Guías y rutas en PROFILE_TEAM_SETUP.md, OPERATIONS.md y README. Publicación y ensayo conectado aún pendientes al registrar esta nota. Commit localizable con `git log -1 -- src/components/account.tsx`.

Verificación conectada: `10ec5c0` Ready en Vercel (`FLZvm8gBtHVMmGGTRYjQWkmc7VJP`), Mi perfil visible para la cuenta administrativa y formulario de invitaciones con varios eventos. Subida/renderizado/eliminación de PNG ficticio por UI contra Supabase comprobados; perfil restaurado sin foto y bucket avatars con cero objetos del ensayo, privado. Petición anónima a /api/profile/avatar dio 401. Roles cliente no pueden leer token ni correo cifrado de invitaciones (privilegios false). Invitación de ensayo solo al propietario con rol comprador/sin nuevos permisos: worker sent en un intento y Resend Delivered; queda pendiente para que el propietario pueda probar aceptación. No se invitó a terceros ni se creó cuenta nueva real.

Perfil adaptado a viewport de 390 px, con foto/selector que se acomodan en filas y prueba específica sin desbordamiento horizontal. Se aclara en UI el alcance de membresía de organizador de toda la organización frente a organizador por evento. Lint/tipos/build finales pasaron; el flujo de perfil/invitación se volvió a comprobar con CLI directo de Playwright porque npm en PowerShell interpretó --grep como opción de npm y no ejecutó el filtro. Evidencias privadas: profile-current.png, profile-photo-uploaded.png y team-invitations.png en .local/verification/. Ningún secreto/foto personal añadido a Git.

La pantalla de aceptación añade Usar otra cuenta (logout conservando token temporal) y Ahora no (descarta token de la pestaña sin conceder permisos ni revocar el correo). Evita que una invitación pendiente fuerce el retorno al flujo después de elegir aplazarla. Se mantienen la verificación de email y la asignación transaccional sin cambios.

Última revisión: `7d2bc86` Ready (`D57K9wfTAUoRat3mcjWAKUXXDsrk`). E2E ampliado verifica cambiar de cuenta, aplazar y volver a abrir la invitación antes de aceptar. El formulario de texto conserva cambios sin guardar al actualizar/eliminar foto: su clave depende de los datos de texto, no de la fecha actualizada por la foto; prueba de borrador añadida. Sin cambios adicionales de permisos/configuración externa.

Entrega final de código `cde70c3` Ready en Vercel (`9Fe7uLFAWkcD8MfVu6Ej7JUmREwL`). Lint, tipos y build pasaron después del ajuste de borrador; el flujo de perfil/invitación ampliado pasó nuevamente, incluidos cambio de cuenta, aplazar y borrador durante subida. Árbol limpio y cambios publicados en main; esta nota solo agrega evidencia documental posterior al despliegue.

# Edición de eventos, cupos y galería — 2026-10-13

Implementada edición de nombre/descripción/recinto/dirección/fechas/aforo, slug conservado. Localidades pueden editar nombre y capacidad incluso agotadas; cupo cero sin compromisos, rechazos por ventas/reservas/aforo, misma transacción/bloqueo que venta. Portada seleccionable y galería de hasta ocho fotos, JPG/PNG/WebP 4 MB, normalización Sharp, Storage privado y acceso público solo eventos publicados. No nuevas credenciales/cuentas, no avisos masivos ni WhatsApp automático. Guía detallada y mapa de implementación: EVENT_EDITING.md.

Migración 005 aplicada en Supabase staging mediante script existente, sin exposición de secretos. 59 pruebas Vitest, lint/tipos/build pasaron. E2E anterior: siete flujos existentes pasaron; nuevo flujo pasó en ejecución dirigida completa (edición/cupo cero/ampliación, dos fotos, portada, privacidad en borrador, publicación, miniaturas y eliminar portada). Dos primeras pasadas corrigieron únicamente aserciones de prueba: toast incluía botón de cerrar y formulario de fases conserva sus valores, por lo que se espera la fila creada. Commit localizable con `git log -1 -- src/components/event-editing.tsx`.

Verificación conectada de edición: `b45b3ff` Ready en Vercel (`D9BBybg1ngRPL8Wj72hb27rugvbd`). Borrador ficticio «Ensayo de edición y galería · DEMO» creado por UI, aforo cambiado de 10 a 12 y descripción multilínea guardada. Dos PNG de colores ficticios subidos, recodificados y renderizados desde Storage real; cambio de portada confirmado. RLS real bajo rol anon devuelve cero imágenes de ese borrador; petición anónima a cada ruta de imagen devuelve 404. Bucket privado, tres políticas Storage y RLS habilitado comprobados. Ensayo sin publicar ni vender/cobrar/enviar correos; no se modificaron eventos anteriores. Evidencia privada: `.local/verification/event-gallery-connected.png`. Ajuste visual: panel de publicación se alinea arriba para no estirarse con el editor/galería.

Entrega final de código `8c9f741` Ready en Vercel (`9UyJgKfALSB3hshmbAzN8vHmGP9P`); build final pasó tras ajustar alineación. Localidad ficticia reducida de tres cupos a cero y ampliada a siete mediante UI contra Supabase, tabla confirmó siete disponibles y cero comprometidas. Borrador de ensayo queda sin publicar ni precios/ventas para practicar; fechas, aforo y fotos son ficticios. Evidencia privada adicional: `.local/verification/event-capacity-connected.png`. Esta nota agrega evidencia documental posterior, sin cambios de configuración ni código funcional.

## Invitaciones para trabajadores, registro libre de compradores — 2026-10-13

Corrección solicitada: comprador deja de ser rol invitable. Equipo y usuarios ofrece administrador global, organizador por evento, Cajero / taquilla (opción inicial) y acceso; roles operativos requieren uno o varios eventos. UI/account.tsx, entrada Zod, servicio de invitaciones, correo y filtro de state actualizados. Registro normal/compra/Mis entradas no dependen de invitación. Migración 006 aplicada a Supabase: cero invitaciones de comprador pendientes, una retirada histórica auditada y CHECK laboral instalado. Registros históricos se conservan; no se eliminan cuentas ni compras ni se envían mensajes nuevos.

60 pruebas Vitest pasaron; lint, tipos y build pasaron. Dos E2E dirigidos pasaron: comprador reserva sin invitación y aceptación de invitación de cajero multievento, cambio de cuenta/perfil/foto. Aserciones verifican ausencia de opción customer y cajero predeterminado; API y PostgreSQL rechazan invitaciones de comprador. Guía actualizada: PROFILE_TEAM_SETUP.md; publicación verificada en la nota siguiente. Commit localizable con `git log -1 -- src/lib/invitations.ts`.

Publicación laboral verificada: código `e3af417` Ready (`G5dP1Q4KSJgnc8TJzzsxufvy8k6b`). Equipo y usuarios en la demo muestra «Invitar a tu equipo», Cajero / taquilla seleccionado inicialmente, cuatro roles laborales y selección multievento; no opción ni fila activa de invitación de comprador. Evidencia privada: `.local/verification/employee-invitations.png`. No se enviaron nuevas invitaciones reales ni se asignaron permisos durante la comprobación. Esta nota es evidencia posterior del despliegue.
## Limpieza de ensayos solicitada por el propietario — 2026-10-13

Inventario revisado: cuatro eventos DEMO, ocho órdenes/pagos y siete entradas; sin eventos ajenos al ensayo. Una cuenta Auth/perfil/admin y dos invitaciones (una admin pendiente) deben conservarse. Snapshot de BD cifrado y dos fotos ficticias cifradas exportados/verificados en .local/backups/; ningún secreto/archivo privado añadido a Git. CLI privado de mantenimiento con guardas staging/sandbox/lista exacta, respaldo obligatorio, preservación comprobada y eliminación transaccional. Limpieza aún pendiente de ejecución al registrar esta nota.

Confirmación nativa de eliminación de foto bloqueó Chrome y no eliminó datos. Escape cerró el aviso y restauró control; confirmación sustituida por alertdialog dentro de la página con Cancelar/Eliminar. 61 Vitest pasaron (incluido rollback por fallo de respaldo y rechazo de eventos reales); lint/tipos pasaron. E2E de galería comprueba cancelar y luego eliminar; build/publicación en verificación. Guía: TEST_DATA_RESET.md. Commit localizable con `git log -1 -- scripts/reset-test-data.ts`.
Limpieza conectada completada el 2026-10-13, autorizada por el propietario: retiro de ambas fotos mediante alertdialog comprobado; Storage event-images sin objetos y avatar personal conservado. --apply exportó/verificó snapshot y eliminó transaccionalmente cuatro eventos, cinco localidades, ocho fases, ocho órdenes/pagos, diez ítems, siete entradas/lecturas, dos cajas/movimientos, cuatro entregas y tres webhooks; asignación al evento eliminado retirada. Todas las tablas operativas verificadas en cero. Auth/perfiles/admin/membresía/organización intactos; dos invitaciones conservadas (una admin pendiente y el histórico revocado). Diez registros de auditoría de identidad/mantenimiento y límites temporales conservados; nombre organizacional normalizado a Pase Central. Wompi sigue sandbox; no se activaron cobros reales.

Backups privados verificados: .local/backups/test-reset-2026-10-13T23-58-56.550Z-prepare/ (database.enc y assets.enc) y test-reset-2026-10-14T00-08-33.068Z-apply/database.enc; timestamps de archivos en UTC. --apply comprueba que las cuentas Auth iniciales permanecen. Código c05bd62 Ready en Vercel (GQUSHXEfijftZxXvABYdBdw3NX43); build final y E2E de confirmación/cancelación pasaron. 62 Vitest tras añadir protección de invitación operativa pendiente; lint pasó. Catálogo administrativo verificado con 0 eventos, cuenta administrativa activa y enlace Crear evento; evidencia privada .local/verification/empty-events-after-reset.png. No se creó ningún evento nuevo real ni se enviaron correos durante la limpieza.
### Auditoría del ensayo retirada — 2026-10-13

Solicitud adicional del propietario: retirar también auditoría existente. Se revisaron diez filas restantes y negocio en cero; backup cifrado privado verificado antes de borrar. `.local/clear-audit.ts` eliminó solo esos UUID en una transacción; auditoría quedó en cero, con Auth/perfil/admin e invitaciones sin cambios (1/1/1/2). No se deshabilita auditoría futura ni se modifica código/permisos/RLS. Respaldo y significado de columnas en TEST_DATA_RESET.md. Tabla de auditoría vacía verificada en Reportes; evidencia privada .local/verification/empty-audit-after-reset.png; no se requieren nuevas pruebas de aplicación por tratarse solo de datos y documentación.
## Guía visible de códigos de auditoría — 2026-10-13

Reportes muestra operaciones y entidades en español; cada fila conserva código original y añade explicación. Guía de códigos desplegable con búsqueda por código/nombre/descripción, disponible con historial vacío. Catálogo audit-labels.ts cubre acciones emitidas por servicio, invitaciones, fotos, bootstrap/migración/mantenimiento; fallback explícito para códigos no catalogados. Interfaz audit-guide.tsx integrada en operations.tsx. Sin cambio de datos, roles ni dependencias; no se crean registros al consultar. Guía detallada AUDIT_GUIDE.md e índice operativo actualizados.

Lint/tipos y E2E dirigido pasaron: fila profile_updated traducida, entidad Cuenta de usuario, búsqueda de profile_photo_updated, código inexistente y contador de auditoría sin cambios al consultar. Build/publicación en verificación. Commit localizable con `git log -1 -- src/lib/audit-labels.ts`.
Verificación de guía conectada: `f1906db` Ready en Vercel (`62evQQuQJicDWY9wHuyEn2MLWdjW`). Reportes ofrece 42 definiciones; búsqueda de profile_photo_updated muestra Foto de perfil actualizada y su explicación. Auditoría y negocio continuaron vacíos; no se generaron filas ficticias para la demostración. Screenshot privado .local/verification/audit-operation-guide.png. Build final pasó; ajuste gramatical del contador singular aplicado después del ensayo, sin cambio de búsqueda ni registros.
## Analítica de ventas y audiencia — 2026-10-13

Vista general y Reportes comparten análisis del servidor con filtros por eventos (dos para comparar), año del evento, fechas de confirmación y audiencia vigente/con ingreso. Ranking, evolución diaria/anual, fases/localidades con consolidación opcional, canales/operadores, cobros, devoluciones, disponibilidad, reservas/caja y cobertura de género/edad. Captura voluntaria por entrada en web/taquilla con autorización, sin inferir datos del comprador; filas individuales privadas y agregados autorizados por evento. Se conservan últimas órdenes y aviso de email fallido en Vista general, exportaciones tradicionales y guía de auditoría en Reportes. Migración 007, nuevo endpoint/componentes/catálogos/pruebas y guía ANALYTICS.md; sin cuentas/servicios/claves nuevos.

Verificación: 71 Vitest y 11 E2E completos pasaron. Incluyen vinculación individual/idempotencia, consentimiento, omisión, confirmación web, RLS denegada, roles y organizador limitado, Bogotá, snapshots/devoluciones/cortesías/pago sin cupo, comparación/CSV privado y ancho móvil. Se corrigieron nombres accesibles de selectores tras el primer ensayo; segunda ejecución tuvo un timeout transitorio durante recarga de desarrollo mientras cambiaba el componente; ejecución final completa sin cambios concurrentes pasó (39.7 s). No se extrapola a hardware. Migración 007 aplicada en Supabase, lectura real del agregado en cero, cuentas/perfiles/admin/invitaciones conservados (1/1/1/2), auditoría cero y SELECT directo de order_attendees denegado a anon/authenticated. Ninguna compra ficticia cloud creada. Build/publicación y verificación visual conectada pendientes al escribir esta nota. Commit localizable con `git log -1 -- src/lib/analytics.ts`.
Verificación final local de analítica: lint y comprobación de tipos sin errores; build Next.js 16.4.0 completado e incluye /api/analytics. Publicación conectada en seguimiento. No hubo nuevas dependencias ni cambios de secretos.
Analítica conectada verificada: `f6f9fe4` Ready en Vercel (`ANdUbW6Qgby9XQT14Lm4dP41LBbW`), Vista general y Reportes visibles con datos del servidor vacíos y sesión administrativa conservada; filtro de audiencia respondió y API anónima devolvió 401. Screenshot privado .local/verification/analytics-connected-overview.png. CSV local probado; intento de descarga conectada cancelado por Chrome, sin afirmar descarga cloud. No se repoblaron datos de ensayo ni se generó auditoría al consultar. Detalle y definiciones: ANALYTICS.md.
## Cuentas, regalos y edición operativa — 2026-10-14

Registro con género/rango opcional/condiciones y callback por tipo al perfil; perfil con demografía y eliminación propia protegida, conservación de ventas/auditoría y revocación de accesos/QR. Compra protege correo verificado y permite regalo a cuenta existente/futura; Mis entradas acepta/rechaza/cancela/transfiere seleccionadas, vencimiento de 7 días y credenciales nuevas. Organizaciones admin, horarios apertura hora ligada a inicio/cierre con fecha, mínimo 18 editable (aceptado por propietario), COP formateado, fase Ambos y edición con snapshots. Menú contextual global desactivado, sin falsa promesa de seguridad. Migración 008, nuevos módulos/colas/componentes/catálogos de auditoría y 13 plantillas Auth españolas versionadas. Guía ACCOUNTS_TICKETS_2026-10-14.md.

82 Vitest y 14 E2E completos pasaron, junto a lint/tipos/build. Se ajustaron selectores accesibles de horarios y fixtures a campo hora; casos de regalo/transferencia/CSV/perfil/caja/galería/roles permanecen pasando. Pruebas aisladas locales; no generaron datos ficticios cloud. Antes de migrar se observaron un evento, una orden y una entrada creados por el propietario; deben preservarse. Migración/publicación/plantillas en verificación; no se prueba eliminación borrando su cuenta. Commit localizable con `git log -1 -- src/lib/transfers.ts`.
Revisión de seguridad de titularidad: orden coherente de bloqueos (perfil/eventos/entradas), KEY SHARE para permitir actualizaciones normales de perfil y REPEATABLE READ en documentos para no mezclar enlace antiguo con QR nuevo. Dos aceptaciones simultáneas y cierre de destinatario pendiente agregados a pruebas; validación de rango de edad compatible con cualquier mínimo configurado, sin asumir edad exacta. 84 Vitest, lint/tipos y build pasaron. Es un ensayo local serializado, no certificación multiconexión/hardware.

Migración 008 conectada aplicada; un evento/una orden/una entrada del propietario preservados, sin transferencias ficticias creadas. Dos cuentas/perfiles existentes, un admin y dos invitaciones conservados; vínculos Auth consistentes, 18 políticas de cuenta activa y SELECT de transferencias negado a anon/authenticated. Privilegio DELETE Auth del servidor comprobado sin borrar cuentas. Código inicial `4802ddd` Ready en Vercel (`AFyukvUYioQESoRUTWxB3HsVxNSM`); Mi perfil y Organizaciones verificados en Chrome. Plantillas Auth están en verificación; recepción real de emails y eliminación Auth no se afirman probadas con los datos del propietario.

Cierre de verificación: `7bd55d4` Ready (`J2ys9H3usJvex2ZqpRSfu4rdvq3x`). Trece plantillas Auth guardadas en español, conservando SMTP/interruptores; Site URL correcto y allowlist contiene destinos exactos signup/recovery en el mismo dominio, además de los existentes. Crear evento publicado muestra edad mínima 18 editable, apertura hora en fecha de inicio y cierre al día siguiente. Revisión final excluye órdenes/pagos/ítems del emisor del estado de quien solo recibe entradas; documento del receptor tampoco expone total financiero ni enlace de orden. Prueba de privacidad, 84 Vitest y 14 E2E (54.6 s), lint/tipos/build aprobados. Evidencia privada `.local/verification/account-event-controls.png`; no se crearon datos ficticios conectados, enviaron correos adicionales ni borraron identidades para verificar.

Publicación final del código `ff82c81` comprobada Ready en Vercel (`EpTmPEfKb99jQhxa9CMQruAHoHKq`, 2026-10-14). Plantilla de alta recargada y vista previa española confirmada; captura privada `.local/verification/spanish-account-email.png`. Comprobación SQL posterior mantiene 2 cuentas/perfiles, 1 administrador, 2 invitaciones y 1 evento/orden/entrada; transferencias 0, sin pruebas ficticias conectadas. Repositorio principal publicado, secretos y evidencia privada ignorados.

## Análisis visual — 2026-10-14

Solicitud: tortas/gráficos/colores y lectura más amable. React/SVG/CSS propios en analytics-charts.tsx y analytics.tsx: donas de género/canal/cobros con leyenda interactiva, línea por fechas reales y barras para eventos/años/fases/localidades/operadores/categorías/edades/accesos. Ranking responde al selector; tablas desplegables y CSV conservados. Cuatro KPI principales, ocho adicionales expandibles y alertas visibles; semáforo según significado y etiquetas, categorías demográficas neutrales. Sin datos ficticios cloud, nuevas dependencias, migraciones, cambios de fórmulas o permisos. Documentación ANALYTICS_VISUALS.md, decisiones/operación/índice actualizados.

Lint/tipos, 84 Vitest, 15 E2E (45.9 s) y build Next 16.4.0 pasaron. E2E verifica leyenda, filtros, tabla/tarjetas, móviles sin desbordamiento y datos vacíos/saldos negativos/incidencias/pendientes mediante mock exclusivamente local. Se ajustó selector al nuevo título de Vista general; no fallo de producto. Capturas analytics-charts.png y analytics-audience.png inspeccionadas visualmente, fixtures explícitamente DEMO. Publicación conectada pendiente de comprobación al registrar este avance.

Código `e038f2c` Ready en Vercel (`8vDKDjMKJWGCMUZxsZvmMvj6VL58`, 2026-10-14 09:16 Colombia). Chrome comprobó nuevo título, tarjetas/semáforo, gráficos con registros existentes del servidor y leyenda/punto seleccionables, sin insertar o modificar ventas. Evidencia privada `.local/verification/analytics-visual-connected.png`. No cambios de proveedores ni datos de prueba cloud; Wompi sigue sandbox. Commit de entrega localizable con `git log -1 -- src/components/analytics-charts.tsx`.

## Caja + acceso y edición de equipo — 2026-10-14

Casilla Incluir acceso en invitación de taquilla; concede roles existentes separados al aceptar, descripción española de correo, sin duplicar ni reactivar permisos retirados al reutilizar enlace. Usuarios y permisos permite reemplazar asignaciones directas por evento, global editar nombre/rol global con último admin protegido; gestores de evento invitan/editan solo dentro de su alcance. Advierte acceso heredado de organización/global. Comando team_update transaccional, lectura de directorio/invitaciones limitada y nuevos códigos de auditoría. Guía TEAM_PERMISSIONS.md, índice/decisiones/operación/guía perfil actualizados.

Lint/tipos, 90 Vitest, 17 E2E y build aprobados. Seis pruebas nuevas de reglas y dos E2E de permisos/alcance/casilla/móvil; pruebas antiguas de invitación actualizadas al alcance de gestor autorizado. Cambios finales de texto/auditoría no alteran el flujo; lint/tipos/90 Vitest/build repetidos pasaron. Migración 009 aplicada en Supabase, aditiva; no modifica roles de cuentas existentes. Datos actuales creados por propietario conservados, sin fixtures nuevos conectados ni invitaciones/correos enviados por el agente. Publicación/inspección de UI en verificación al registrar este avance.

Revisión de accesibilidad: diálogo nativo con foco confinado/Escape y error de guardado dentro de la ventana; evita ocultar el motivo detrás del modal. Dos E2E de equipo repetidos (10.3 s) verifican también rechazo visible de retirada del último administrador; lint/tipos/build pasaron. SQL conectada confirma migración 009 y EXECUTE del helper false para anon/authenticated; invitaciones anteriores mantienen include_access=false. No se cambiaron permisos reales durante la revisión.

Entrega `662bcae` Ready y revisión final `201f0a1` Ready (`5GbFKUsFv6txMrmrekXTM1zoavaa`, 2026-10-14 10:47 Colombia). Chrome en Equipo y usuarios muestra casilla Incluir acceso; editor abrió asignaciones actuales de una cuenta existente y se canceló sin guardar. Caja/acceso separados comprobados en UI. Captura privada sin filas de invitados `.local/verification/team-including-access.png`. No se enviaron nuevas invitaciones ni se modificaron permisos conectados en el ensayo. Repositorio principal publicado y documentación preservada; secretos/evidencia ignorados.

## Continuidad de invitación tras registrar — 2026-10-14

Diagnóstico del código: registro general + confirmación al perfil + token solo en sessionStorage podían perder el paso de aceptación al abrir otra pestaña. Registro ahora tiene contexto de equipo; callback/signup y login retoman invitación vigente propia desde email verificado de Supabase. Mi perfil ofrece continuar sin token local. Aceptación explícita por ID reutiliza verificación/transacción de invitación; registrar/confirmar no concede roles, correo ajeno/no verificado se rechaza y metadata pública no determina rol. Sin nueva cuenta para el invitado que ya se registró, ni pérdida de compras. Guía INVITATION_ONBOARDING.md e índice/operación/perfil actualizados.

Lint/tipos, 93 Vitest, 18 E2E y build pasaron. Casos nuevos de callback/login y aceptación propia sin token; E2E usa segunda pestaña, mismo user_id y rol admin solo tras aceptar; restaura fixture al cerrar. Datos/mensajes/roles de ensayo exclusivamente locales; no se activó la invitación de una persona real ni se envió correo adicional. No nuevas migraciones, claves o plantillas externas. Publicación/inspección de pantalla en verificación. Recomendaciones anteriores de compra de impresora conservadas en PRINTER_RECOMMENDATIONS.md, sin cambiar adaptador/hardware.

Código `709b9f6` Ready (`31VST2omVtCqXhQtb8J1zw5x1om3`, 2026-10-14 15:52 Colombia). Chrome comprobó encabezado de registro de equipo, aviso del mismo correo/continuación y botón contextual, sin introducir datos ni crear cuenta. Evidencia privada `.local/verification/invitation-onboarding-connected.png`; se volvió a Equipo y usuarios. Callback/Auth real con correo del invitado no se ensayó aceptando en su nombre: probado con mocks de proveedor y E2E local; se preservaron las cuentas/roles reales. Implementación y documentación publicadas en main.
