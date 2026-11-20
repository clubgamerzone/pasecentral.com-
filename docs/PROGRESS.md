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

## Impresora conectada — 2026-11-18

Diagnóstico Windows de solo lectura: detectada STAR POS STAR-iF42 en USB002, estado PnP OK. Colas POS-80C/POSPrinter POS58 en USB001 y sin conexión; POS-58 en LPT1. No se cambió driver/puerto ni se imprimió. Guía docs/PRINTER_STAR_IF42.md; cola correcta, especificaciones de papel y prueba física siguen pendientes. Sin cambios cloud o datos de clientes.


### Controlador STARPOS asociado — 2026-11-18

Paquete oficial iDPRT/Seagull 12.1.0 descargado y firmas verificadas. Instalado INF original mediante elevación Windows y creada cola STAR POS STAR-iF42 (ZPL 203 dpi) en USB002, estado Normal/WorkOffline=false/cero trabajos. Driver compatible por emulación ZPL iDPRT iF4 203 dpi; sin coincidencia STARPOS exacta ni homologación física aún. Colas previas preservadas, sin cambiar impresora predeterminada ni imprimir. Fuentes, ruta privada, comandos, hash, límites y próximos pasos en docs/PRINTER_STAR_IF42.md. No cambios de código/cloud ni secretos guardados.


### Muestra de impresión 70 x 40 mm — 2026-11-18

Usuario autorizó una prueba con papel 7x4 y ribbon; interpretado como centímetros ancho×alto. Enviada una copia ZPL por Winspool RAW a STAR POS STAR-iF42 USB002, trabajo 2/429 bytes. Modo transferencia térmica, texto y QR de ensayo sin validez de ingreso; sin datos reales/cloud ni corte/calibración automáticos. Código privado y pasos en docs/PRINTER_STAR_IF42.md. Resultado físico/lectura Honeywell pendientes de confirmación del usuario.


### Error físico antes de imprimir STARPOS — 2026-11-18

Usuario informa muestra sin impresión/movimiento y LED rojo parpadeante. Fotos muestran tabla de estados y papel de marcas negras; cola Windows Normal/cero no certifica impresora lista. Se pide cerrar mecanismo/tapa, identificar parpadeo lento/rápido/fijo y FEED una vez. No nuevos trabajos/reset/calibración ciega. Detalle y fuentes en docs/PRINTER_STAR_IF42.md; impresión real sigue fallida, no homologada.


STARPOS: FEED pita, rojo rápido confirmado por usuario. Video oficial iF4 142 verifica calibración con pulsación corta del botón superior tras revisar recorrido y cerrar cabezal. Se indican pasos físicos; resultado aún pendiente, sin nuevos trabajos de impresión.


STARPOS: cartulina una capa confirmada, cierre listo. Prueba única continua 70x40 con ribbon enviada (trabajo 7), sin calibración ni guardado permanente. Esperando impresión física y estado LED; guía PRINTER_STAR_IF42.md.


STARPOS: último ensayo no imprimió, amarillo parpadeante. Destino USB002 STAR POS STAR-iF42 reconfirmado, driver iDPRT provisional no homologado. Video iF4 oficial 143: amarillo lento es pausa, reanudar FEED breve. No nuevos trabajos/reinstalación hasta observar resultado.


STARPOS imprimió TEST-002 tras salir de pausa (foto del propietario); transferencia USB/ZPL operativa, calidad débil/irregular y margen izquierdo recortado pendientes. Lanzadas preferencias del controlador instalado para inspección; sin cambios de densidad/velocidad ni otra impresión. QR físico no homologado. Detalle PRINTER_STAR_IF42.md.


STARPOS TEST-003 autorizada por listo: una muestra70x40 con ribbon, oscuridad15 absoluta/ajuste0, 50.8mm/s y margen izquierdo aumentado, enviada trabajo8 por RAW; sin cambio cloud ni boleta real. Confirmación física de calidad/QR pendiente. Guía PRINTER_STAR_IF42.md.


STARPOS TEST-003 físico: alineación lateral mejorada, QR más definido; transferencia aún irregular/débil. Pendiente identificar ribbon y comprobar montaje/contacto, sin nueva muestra automática ni homologación de lector. Foto/estado descritos en PRINTER_STAR_IF42.md.


2026-11-18: enviada una muestra fisica de prueba TEST-004 (trabajo 9), oscuridad 18 frente a 15 y misma velocidad 50.8 mm/s. Resultado fisico pendiente; procedimiento y script privado en docs/PRINTER_STAR_IF42.md. Sin cambios de aplicacion/cloud.

STARPOS TEST-004: foto comparativa confirma mejora visual del QR con D18 frente a D15; texto aun irregular. Pendiente lectura fisica EDA51 en campo de texto y calidad final. No nueva impresion. Detalle en docs/PRINTER_STAR_IF42.md.

2026-11-18 - STARPOS: enviada una muestra TEST-005, D21 frente a D18, misma velocidad 50.8 mm/s y diseno para comparacion. Trabajo 10, resultado fisico pendiente. EDA51 cargando, lectura aun pendiente. Ver docs/PRINTER_STAR_IF42.md.

2026-11-18 - STARPOS: enviada por solicitud una muestra TEST-006, oscuridad explicita 26 / 50.8 mm/s, trabajo 11. Resultado fisico y lectura EDA51 pendientes; detalles en docs/PRINTER_STAR_IF42.md.

STARPOS: fotos D21/D26 muestran texto y marco aun irregulares; propietario informa lectura de QR, sin precisar muestra/consistencia. No homologacion completa. Se detiene escalado de oscuridad; pendiente revisar ribbon/contacto y prueba de fuente mas ancha. Detalles docs/PRINTER_STAR_IF42.md.

2026-11-18 - STARPOS TEST-007 enviado tras revision fisica por propietario: letras mas anchas, texto repetido y tres bloques negros pequenos; D26/50.8 mm/s conservados, trabajo 12. Resultado fisico pendiente. Ver docs/PRINTER_STAR_IF42.md.

STARPOS TEST-007 fisico: tres bloques solidos con huecos, defecto tambien en fuente ancha. No es solo tipografia. Sin mas energia/pruebas automaticas; pendiente comparar consumibles conocidos compatibles y conocer historial de esta combinacion. Ver docs/PRINTER_STAR_IF42.md.

2026-11-18 - Consumibles recomendados provisionalmente para STARPOS: tag liso recubierto para transferencia termica + ribbon flat-head cera/resina APR6, alternativa AWX FH; pedir muestra y confirmar dimensiones/bobinado/espesor con proveedor. Guia docs/PRINTER_STAR_IF42.md. Sin compra ni compatibilidad fisica certificada.

STARPOS TEST-008: una copia diagnostica enviada (trabajo 13) tras cambio no especificado por propietario. D26/50.8mm/s explicitos; pendiente foto y conocer cambio. Detalles docs/PRINTER_STAR_IF42.md.

STARPOS TEST-009: enviada una copia con QR de prueba, D26/50.8mm/s, trabajo 14. Foto/lectura pendientes. Procedimiento en docs/PRINTER_STAR_IF42.md.

STARPOS: propietario identifica papel al reves como causa de calidad; foto TEST-009 mejora claramente. Pendiente registro vertical: continuo no sigue perforaciones, confirmar barras ahora inferiores y paso medido. No compra de consumibles confirmada necesaria. Detalle docs/PRINTER_STAR_IF42.md.

STARPOS: confirmados marcas inferiores/paso40mm; enviada configuracion ZPL de marca negra (trabajo15, sin imprimir). Pendiente calibracion fisica y foto de TEST-010 aun no enviado. Siguiente script no debe restaurar continuo. Ver docs/PRINTER_STAR_IF42.md.

STARPOS TEST-010: una copia con QR en modo marca negra enviada tras finalizacion de calibracion reportada (trabajo16). Pendiente foto entre perforaciones para verificar alineacion vertical; no declarar calibracion/registro aprobados por cola vacia. Ver docs/PRINTER_STAR_IF42.md.

STARPOS TEST-010: propietario informa impresion cruzando zona de corte; alineacion aun pendiente. Se requiere foto/medida de desfase para determinar offset y verificar registro, sin nuevo envio. Ver docs/PRINTER_STAR_IF42.md.

STARPOS TEST-011: enviada una copia con offset de referencia marca +20mm (^MNM,160), por perforacion central reportada. Trabajo17, resultado fisico/soporte de offset pendientes. No cambio de diseno ni energia. Ver docs/PRINTER_STAR_IF42.md.

STARPOS TEST-011 no alineado segun foto: diseno partido y blanco amplio. Offset20mm no resolvio; pendiente mapa fisico de marcas/perforaciones con regla antes de mas ajustes. Ver docs/PRINTER_STAR_IF42.md.

STARPOS: recibidas fotos frente/reverso, barras regulares; posible salto de boleta aun sin medir. Retirado offset20mm con ^MNM,0 (trabajo18, sin imprimir). Pendiente medir avance de una pulsacion FEED40/80mm. Guia docs/PRINTER_STAR_IF42.md.

STARPOS: FEED avanza una boleta segun propietario (aproximado). Enviada muestra QR TEST-012 tras FEED con marca negra/offset0, trabajo19; pendiente posicion fisica. Ver docs/PRINTER_STAR_IF42.md.

STARPOS TEST-012 mejor alineado, marco superior aun cruza perforacion. Enviado TEST-013 con LT+4mm y marco mas corto para conservar margen inferior, trabajo20. Foto/consistencia pendientes; ver docs/PRINTER_STAR_IF42.md.

## Configuracion de papel en app (2026-11-18)
- Propietario confirma TEST-013 bien alineado; falta consistencia de tres copias y nuevo formato real de app.
- Selector en entradas con permiso de venta:80mm,70x40,70x100, preferencia local validada, controles de material/top/oscuridad. ZPL para STARPOS via QZ; ESC/POS80 conservado. Browser tiene plantillas de largo fijo con limites verificados en prueba de taquilla. PDF digital sin cambios. Guia docs/PRINT_PAPER_SETTINGS.md y mapa AGENTS/OPERATIONS/README.
- Next/eslint-config-next patch16.4.6 tras advisory critico, audit prod0. Playwright chromium instalado con npx playwright install chromium para version fijada.
- Verificacion parcial:97 Vitest, lint y tipos pasan; build16.4.6 pasa. Ensayo dirigido taquilla/PDF/acceso/caja con selector persistente y limites de ambos papeles pasa despues de corregir desborde de footer40mm. Regresion completa y build final pendientes en este punto; registrar abajo resultado final.
- Sin migraciones, cambios de cuentas/cloud ni nueva muestra fisica en esta entrega. QZ app-servidor-dispositivo y papel100 requieren pruebas externas. Scripts RAW privados no forman parte de la app ni se suben.

Verificacion final de esta entrega:97 pruebas Vitest,18 Playwright E2E (55.1s),lint,typecheck y build Next16.4.6 aprobados; npm audit --omit=dev:0 vulnerabilidades. Comprobaciones de navegador no homologan papel100 ni flujo QZ fisico. Publicacion pendiente hasta push/verificacion de proveedor; no afirmar desplegado por build local.

Commit de implementacion/verificaciones: feb5bd9 (Add ticket paper presets and STARPOS ZPL printing). El commit incluye documentacion de hardware y patch de seguridad. Proximo paso: sincronizar main y verificar despliegue; ensayo fisico QZ y papel grande siguen pendientes.

## Ensayo local previo a nuevas publicaciones
Por instruccion del propietario, nuevas pruebas/cambios se conservan localmente, sin push. Enviadas tres muestras consecutivas TEST-014-1/2/3 con plantilla fisica TEST-013 (trabajo21). Resultado fisico pendiente. Anterior push6480917 ya realizado antes de esta instruccion; no se afirma despliegue verificado.
Agregado tests/printer-adapter.test.ts: transporte QZ simulado, tres payloads ZPL distintos sin ESC/POS/corte, prevalidacion de orden antes de primer envio y recibo80 conserva ESC/POS. No acceso cloud ni impresion real desde ese test. Lint/typecheck pasan; suites y build final en curso.

Resultado local final:99 Vitest (6 archivos),18 Playwright (53.4s),lint,typecheck y build16.4.6 aprobados. No git push ni despliegue realizados en este ensayo. Cambios de pruebas/documentacion permanecen locales. TEST-014-1/2/3 enviadas, pendiente confirmacion del propietario sobre alineacion y lectura de tres QR; no marcar prueba fisica aprobada por cola vacia.

Confirmacion posterior del propietario: TEST-014-1/2/3 alineadas y sus tres QR leidos por Honeywell. Aprobado ensayo fisico consecutivo de plantilla RAW70x40; flujo QZ completo de app y papel70x100 siguen pendientes. Suites locales99+18,lint,tipos y build aprobados previamente. Sin nuevos pushes/despliegues.

## Red local y limpieza de ambos destinos (2026-11-18)
Por solicitud explicita del propietario y confirmacion ambos: limpiados2 eventos en PostgreSQL local y3 en Supabase staging/sandbox. Retiradas relaciones de ensayo cloud (6ordenes,11entradas,6pagos,2cajas,1transferencia). Respaldos cifrados verificados antes de eliminar; cuentas/permisos generales/invitaciones y objetos Storage conservados y comparados, sin cambios Auth. Sin borrar auditoria previa, archivos Storage o historiales externos; nuevas asignaciones por evento se deben crear. Herramienta privada exacta, no se debilito reset-test-data.ts. Detalles y limites de recuperacion: TEST_DATA_RESET.md.
Agregado npm run dev:lan (Next0.0.0.0:3000); APP_URL privado actualizado a IP LAN. Front/API mismo puerto. Regla firewall elevada TCP3000 solamente Private/LocalSubnet/node.exe, resultado confirmado. Login/API200, eventospublicos0, origen correcto sin sesion401 y origen ajeno403. Acceso real Honeywell por LAN pendiente de confirmacion, no probado desde dispositivo. Servidor queda ejecutandose. Guia de inicio/parada/IP/firewall: LOCAL_NETWORK.md. Sin nuevos pushes o despliegues.

Corregida carga por IP LAN: next.config.ts permite hostname APP_URL solo en desarrollo mediante allowedDevOrigins. Reproducida pantalla Preparando; tras reinicio Chromium renderiza catalogo vacio/login sin erroresJS. Tipos aprobados. Servidor dev:lan queda activo, sin nuevos pushes. Detalles LOCAL_NETWORK.md.

2026-11-19 - Revisada jerarquia de permisos con propietario: global, organizacion, evento,taquilla,acceso y comprador; diferencia entre membresia organizacion e invitacion organizer por evento documentada en TEAM_PERMISSIONS.md. Falta invitacion directa admin organizacion; asignacion manual a cuenta existente ya disponible para global. Solo aclaracion, sin cambios de permisos/usuarios ni push.

2026-11-19 - Confirmado por lectura: taquilla con email encola envio al emitir; scheduler cron activo cada minuto, cola vacia. Explicado compartir PDF manual PC/Android, limitacion WebShare en LAN HTTP y requisitos WhatsApp CloudAPI. Propietario conserva modelo roles actual. Sin mensajes ni compras de prueba, sin cambios de codigo/push. Ver OPERATIONS.md.

2026-11-19 - Implementadas opciones de aforo ilimitado, fin/cierre opcionales y apertura igual a inicio, campos condicionales en crear/editar. Adaptados API/transacciones/escaneo/transferencias/catalogo/reportes a NULL, manteniendo cupos de localidades. Migracion010 en Supabase con backup cifrado y filas verificadas sin cambios; sin fixtures cloud.102Vitest+19Playwright,lint,tipos y build aprobados. Mapa/pruebas/limites EVENT_OPTIONS.md; sin commit,push o deploy. Se reinicia servidor LAN para uso del propietario.

2026-11-19 - Enlace del evento con ejemplo /eventos/tuevento y alias /eventos compatible con /events. Vistas previas inmediatas de imagen, galeria administrativa miniatura200x120, gestion de errores/revocacion blobURL. Localidades ilimitadas en alta/edicion cuando evento ilimitado, guardas de cupo/venta/transicion. Migracion011 Supabase con backup y filas sin cambios.103Vitest+20Playwright,lint,tipos y build aprobados. Codigo y mapa EVENT_OPTIONS.md/EVENT_EDITING.md; sin commit,push ni deploy.

2026-11-19 - Corregido crypto.randomUUID no disponible en HTTP LAN. Helper browser-id.ts con getRandomValues seguro; comprador/taquilla/acceso usan UUIDcompatible, tokensQR servidor sin cambios.106Vitest y2E2E relevantes sin UUIDnativo,lint,tipos y build pasan; ChromiumLAN sin pageerrors. Sin compra cloud ni push. Guia LOCAL_NETWORK.md.

2026-11-19 - Organización visual global: paneles, etiquetas, controles, ayudas, tablas y acciones coherentes en formularios administrativos/operativos; cupo alineado con nombre, horarios en sección propia, estados vacíos y edición modal de localidad. Inspección de capturas Chromium1440/390: crear evento, localidades/precios, equipo, perfil, taquilla y reportes. Test de ancho/alineación agregado en ui-layout.spec.ts. Ajustado flujo automatizado para esperar cierre real del diálogo antes de completar fase (los controles de fondo son inertes mientras guarda). Resultado final106Vitest,21Playwright,lint,tipos y build aprobados. No nuevas pruebas físicas ni llamadas de escritura a Supabase en QA; base demo aislada. Guía UI_LAYOUT.md. Sin commit,push o despliegue; servidor LAN reiniciado para revisión del propietario.

2026-11-19 - Fases: interruptor Vender hasta el final del evento en alta/edición, fecha manual oculta al activar y mensaje para eventos sin fin. Final vinculado dinámicamente al evento, consultas venta/publicación y UI con final efectivo; validación de fechas y solapamientos preservada, compras históricas sin cambios. Migración012 aplicada a Supabase staging con respaldo cifrado verificado, fases existentes comparadas sin cambios.107Vitest+21Playwright,lint,tipos y build aprobados. Pruebas aisladas sin ventas cloud. Guía EVENT_OPTIONS.md; sin commit,push o despliegue. Servidor local reiniciado.

2026-11-19 - Taquilla permite Abrir caja en diálogo sin navegar: evento fijo, fondo inicial COP, confirmación, cancelación/Escape y error local con reintento. Conserva datos y cantidades de venta; usa cash_open y controles existentes, sin migración. Flujo E2E taquilla ampliado aprobado (cancelación/error/reintento/apertura/venta/PDF/acceso/cierre); captura móvil revisada, lint/tipos/build pasan. Sin prueba física ni operaciones cloud. Documentado OPERATIONS.md; sin commit/push/deploy. Servidor LAN reiniciado.

2026-11-19 - Revisión visual ampliada: organizaciones en tarjetas con formularios/acciones separados y resumen de eventos; catálogo y Mis eventos con cabecera, búsqueda y tarjetas alineadas; paleta global de acciones principales/secundarias/destructivas, foco y deshabilitados. Ajustes de encabezados, resúmenes, tablas y móvil compartidos. ui-layout.spec.ts cubre12 pantallas a1440/390, revisión visual organizaciones/catálogo/caja/acceso/entradas. Guía UI_LAYOUT.md; resultados finales al terminar validación. Sin servicios nuevos ni escrituras cloud.

Resultado segunda revisión UI: captura/ancho/alineación de12 pantallas en escritorio y móvil aprobado. Suite completa20 aprobadas y1 interrumpida por Fast Refresh al ajustar ruta superior durante la corrida; repetida esa prueba sin cambios de código: aprobada (8s). Los21 flujos quedaron verificados, incluida impresión/PDF y operación taquilla/acceso. Lint,tipos y build aprobados. No se repitieron pruebas físicas. Servidor LAN reiniciado; sin commit,push o despliegue. Se corrigieron además delimitadores Markdown de códigos técnicos en DECISIONS/AGENTS, sin cambiar decisiones.

2026-11-19 - Organizaciones muestra nombres/correos de administradores actuales mediante membresías existentes y perfiles autorizados. No se crea principal ni se altera ningún permiso por decisión del propietario. Estado vacío explícito; sin migración/escrituras cloud. Código ticket-wallet.tsx y globals.css, guía UI_LAYOUT.md.
Verificación administradores por organización: lint,tipos,build y prueba UI de12 pantallas a1440/390 aprobados. Captura móvil revisada: nombre/correo dentro de su tarjeta, sin desbordamiento. Sin mutaciones de datos o permisos, sin commit/push/deploy. Servidor LAN reiniciado.

2026-11-19 - Enviada una muestra fisica TEST-015 solicitada por propietario: RAW70x40/QR de prueba, trabajo2/449bytes aceptado, parametros alineados previos conservados. No afirmar salida fisica por aceptacion del spooler. Detalles PRINTER_STAR_IF42.md; sin escrituras cloud o push.

2026-11-19 - Nueva muestra TEST-016 solicitada con oscuridad16 explicita; trabajo4/449bytes aceptado por spooler, una copia70x40. Calidad fisica pendiente del propietario; detalles PRINTER_STAR_IF42.md. Sin cambios de app/cloud/push.

2026-11-19 - Lentitud al navegar: comprobado state global27 consultas/4474–4328ms con un evento, más recarga completa por enlaces HTML y montaje de App. Implementado layout persistente bajo (platform), next/link interno, actualización no bloqueante con descarte de respuestas obsoletas; permisos leídos en conjunto y grupos SQL JSON parametrizados. Nueva medición13 consultas/2375–2227ms de state (sin Auth/HTTP).108Vitest,22Playwright (incluye navegación sin documento nuevo con state retenido y permiso equivalente a can),build,tipos y lint aprobados. Cambio inicial de ruta obligó regenerar tipos Next; no error persistente. Guía NAVIGATION_PERFORMANCE.md. Sin migración/push/deploy/fixtures cloud, primera carga aún depende de Auth/red/Supabase. Se reinicia LAN para uso del propietario.
Verificación LAN anónima Eventos→Login:106ms, mismo documento,0 erroresJS; detalle NAVIGATION_PERFORMANCE.md. No equivale a latencia autenticada o de Honeywell.
2026-11-19 - Aclarado historial/búsqueda al llegar: gestores tienen Ventas y entradas, taquilla sin historial propio aún; acceso manual por número/serial con permiso específico y conexión. Búsqueda por comprador/documento pendiente, no se almacenan documentos. Mapa y límites OPERATIONS.md; solo revisión, sin código o permisos nuevos.

2026-11-19 - Propuesta visual de boleta doble solicitada: una entrada consume dos tramos70x40 consecutivos, comprador/control, total70x80, misma credencial y un solo ingreso. Artefactos docs/design/boleta-doble-v1.html/png, guía BOLETA_DOBLE.md. HTML/CSS con qrcode/Playwright existentes, datos solo de muestra. Revisado render y ajustado solapamiento de texto; sin impresión ni cambio de plantilla activa. Integración vista idéntica/default70x40 y ensayo físico pendientes de revisión del diseño por propietario. Sin push/deploy.
2026-11-19 - Corrección de boleta doble por propietario: QR solo arriba, talón de control retenido; abajo sin QR, información de evento/dirección como recuerdo. Propuesta02 HTML/PNG en docs/design, versión01 conservada como historial. Vista revisada tras ajustar márgenes; sin impresión, cambios de app o push. Guía BOLETA_DOBLE.md.
2026-11-19 - Propuesta03 boleta doble: logo Retrofest adaptado a monocromo con imagegen integrado ocupa bloque junto a QR, reemplaza Escanear al ingresar. HTML/PNG y logo en docs/design; prompt LOGO_RETROFEST.md. Campo admin Logo para boletas separado de portada solicitado y registrado pendiente de implementación tras revisión de diseño. Sin impresión, cambios de app/Storage/usuarios o push.
2026-11-19 - Propuesta04 boleta: equipos de sonido B/N junto al QR superior, mensaje ¡A LA CALLE CON TODO! en lugar de Retener al ingresar; logo trasladado al recuerdo inferior. Arte adaptado con imagegen integrado y copiado en docs/design, prompt/flujo LOGO_RETROFEST.md; HTML/PNG v4 renderizados y revisados tras ajustar pie. Sin impresión, cambios de app, Storage/cloud o push. BOLETA_DOBLE.md es mapa vigente.
2026-11-19 - Propuesta05 boleta: precio/localidad/fase y ubicación arriba junto al QR para conteo de talones; logo/equipos abajo en recuerdo. HTML/PNG v5 en docs/design, render revisado; activos B/N previos reutilizados. Integración deberá usar precio histórico aplicado, no fase actual. Sin impresión, cambio app/cloud/push. Guía BOLETA_DOBLE.md.
2026-11-19 - Propuesta06 boleta: se quitó cabecera Recuerdo del comprador y se unieron logo/equipos en composición superpuesta B/N con imagegen integrado; mitad superior QR/precio conservada. HTML/PNG v6 y arte en docs/design, render revisado; prompt LOGO_RETROFEST.md, alcance BOLETA_DOBLE.md. Sin impresión, app/cloud/push.

2026-11-19 - Integrado diseño06 aprobado de boleta doble: render raster único pantalla/PDF y mapas ZPL/ESC-POS, dos tramos70x40 por persona y defaultnuevo preferenciasv2 (+4mm,oscuridad16), arte/frase por evento separado de portada y precio/phase/localidad del snapshot histórico. Migración013 privada/RLS aplicada en staging con respaldo cifrado y eventos existentes sin cambios; arte aprobado configurado solo en evento Retrofest verificado. No emisión/venta/email/prueba cloud ficticia.110Vitest+23Playwright,lint,tipos,build y diff-check aprobados; capturas desktop/mobile de emisión revisadas, PDF70x80porpersona y bits reconstruyen misma imagen comprobados. Render conectado de orden existente:5entradas/5páginas/10segmentos, sin crear entradas ni imprimir o exponer credenciales. Sin nuevas dependencias, commit,push o despliegue. Guía TICKET_DOUBLE_LAYOUT.md; reiniciar LAN y recargar para ver vista nueva. Ensayo físico de parejas y QZ sigue pendiente.
Ajuste final: Ctrl+P de comprador usa misma composición con4 páginas40mm para2 entradas, y vista70x100 respeta ajuste vertical. Flujos de comprador y taquilla repetidos:2/2 aprobados; lint y tipos pasan. Sin imprimir. Compilación final y reinicio LAN a continuación.
Compilación final aprobada. Se deja npm run dev:lan activo para revisar la boleta actualizada. Sin cambios adicionales de hardware, GitHub o despliegue.

2026-11-19 - Aclarada vista previa de impresión: dos páginas40mm por entrada,10 tramos para5 entradas. Captura desplazada no prueba recorte; comprobar página completa/tamaño/escala/márgenes antes del ensayo. Sin imprimir ni cambiar configuración/código. Guía TICKET_DOUBLE_LAYOUT.md.

2026-11-19 - Corregido resultado del diálogo de impresión en buyer.tsx: volver de window.print no registra submitted ni presume envío; trabajo queda solicitado y operador elige Papel impreso y verificado o No se imprimió / cancelé. Panel junto a botones, reimpresión bloqueada hasta resolver, resultados parciales preservados si falla registro. QZ conserva submitted solo tras recibir trabajo; sigue exigiendo comprobación física. Prueba Playwright de taquilla/PDF/acceso/caja aprobada, con diálogo simulado y verificación de cancelación, reintento y estados terminales; lint, tipos y build aprobados. Sin impresión física, migración, cambio de datos cloud, commit/push/deploy. Guía TICKET_DOUBLE_LAYOUT.md y decisión documentadas.

2026-11-19 - Optimizada espera antes de abrir impresión: una llamada print_batch_request por selección en buyer.tsx, lote transaccional con validación de IDs/permisos y auditoría en service.ts/validation.ts; app.tsx ya no recarga state en comandos de impresión. Antes se repetía comando y recarga completa por cada boleta (logs LAN aprox1.8–1.9s+2.6–2.7s por ciclo); no se midió aún nuevo tiempo contra impresora/Chrome real. Botón Preparando impresión.61 pruebas de servicio, flujo Playwright taquilla/PDF/acceso/caja, lint, tipos, build y diff-check aprobados. Sin impresión física, migración, cambios de datos cloud, commit/push/deploy. Guía TICKET_DOUBLE_LAYOUT.md; servidor LAN reiniciado para probar tras Ctrl+F5.

2026-11-19 - Diagnóstico de cortes por perforación en foto física: preferencias efectivas del usuario confirmaron70x40peroMaterialContinuo; se cambió mediante UI Seagull a No continuo, Sensor de marcas y ajuste superior explícito0mm para no duplicar desplazamiento web. Reabierto y comprobado guardado; sin impresión, calibración, EEPROM o alteración de plantilla/credenciales. Get-PrintConfiguration muestra defaults globales50.8distintos del usuario: no atribuir causa a ese tamaño sin UI. PrintOptions incorpora advertencia visible paraChrome/QZ. E2E taquilla/PDF/acceso/caja aprobado incluyendo PDF generado por Chromium de2páginas70x40porpersona, tolerancia1punto para redondeo de caja;lint,tipos,build ydiff-checkaprobados. Primera aserción de100mmfue demasiado estricta por0.505puntos, ajustada y repetida correctamente. Nuevo registro físico sigue pendiente de1entrada/2páginas. Guías PRINTER_STAR_IF42.md y TICKET_DOUBLE_LAYOUT.md. Sin cambios cloud, commit/push/deploy; LAN reiniciado.

2026-11-19 - TEST-017 solicitado: enviada1boletadoble/2tramos70x40 por Windows GDI/driver con render de app y QR ficticio, noRAW. PrintDocument retornó correctamente, salida física/alineación/lectura pendientes del propietario. Detalles y scripts PRINTER_STAR_IF42.md. No modificación de app, venta/emisión/cloud, GitHub, EEPROM o nueva calibración.

2026-11-19 - TEST-017 rechazado físicamente por propietario:solo un tramo visible, texto/QR con huecos y perforación en encabezado. Cola vacía; preview local sin papel genera2páginas/2callbacks, no confirma salida física. Enviada una sola comparación TEST-018 RAW con GFA generado por plantilla actual,2formatos70x40,D16/PR2/marcaoffset0/LT32, trabajo7/89811bytesaceptado. Resultado físico pendiente; no declarar driver/browser solucionados o QZ homologado. Detalles PRINTER_STAR_IF42.md. Sin cambios de app/cloud, energía/calibración/EEPROM o push.

2026-11-19 - Propietario confirma cortes de TEST-018 correctos; letras aún deficientes. Revisión del ZPL histórico TEST-014 confirmóD26/50.8mm/s/marcaoffset0/LT32, comparado conD16deTEST-018. Enviada1boletadobleTEST-019conD26, alineación intacta, trabajo8/89811bytesaceptado; contraste/lectura aún pendientes. Sin cambios de preferencias app, driver, calibración/EEPROM, cloud o push. Guía PRINTER_STAR_IF42.md.

2026-11-19 - Propietario aprueba TEST-019comoPERFECTA. Guardado perfil70x40dobleD26/PR2/marcaoffset0/LT32; default/presetpequeñoactualizados ypreferenciasv3conrecuperacióndev2solo16→26en70x40,preservandoalineaciónyotrosmateriales. ReferenciavisibleenPrintOptions.7/7pruebasdeimpresión/adaptador,lint,tipos,buildydiff-checkaprobados. Sinotraimpresión,cloud,commits,pushodeploy. GuíasPRINT_PAPER_SETTINGS.md/PRINTER_STAR_IF42.md. Límite:aprobaciónfísicaRAWnoequivaleatestChrome/QZ ni lectura adicionalEDA51.

2026-11-19 - Propietario reporta lag y borde amarillo tras detener interacción. Diagnóstico de solo lectura: muestra breve sin saturación general de CPU y ~39GBRAMlibresde64GB; no identifica causa definitiva de lag/GPU. Persistía helper codex-computer-use tras última captura. Reiniciado únicamente kernel node_repl de esta sesión: proceso helper dejó de existir, verificado por consulta de procesos, sin cerrar Chrome/juego/servidor ni mover mouse. Windows.Graphics.Capture muestra borde amarillo mientras captura (Microsoft Learn screen-capture); desaparición visual y mejora de fluidez requieren observación del usuario, no volver a capturar para verificar porque reactivaría indicador. No cambios de app/cloud/push. Para futuras sesiones, liberar kernel al terminar control nativo.

2026-11-20 - Selección de impresión por entrada en orden: ver todas/seleccionar subconjunto, registrar/enviar solo IDs elegidos, bloquear selección hasta resolver resultado, PDF compartido/descargado sigue completo con aviso. Consecutivo persistido event_sequence ahora explícito en documento y encabezado BOLETA N.º000005del control, independiente de entrega/reimpresión; misma credencial, ninguna emisión/migración.71Vitest+2Playwright,lint,tipos,buildydiff-checkaprobados; UI móvil y render revisados. Sin impresión, control/captura PC, cambios cloud, commit/push/deploy. Guía TICKET_SELECTION.md; pendiente físico/QZ y despliegue autorizado.

2026-11-20 - Implementado inventario de boletas preimpresas sin activar por autorización del propietario. Nuevo menú /box-office/preprints: lotes1–100con precio/localidad congelados y responsable, impresión selectiva privada, consulta QR y cobro explícito para activar, bloqueo de pendientes con liberación de cupos. Reserva cupo sin crear ventas/pagos/entradas; activación transaccional reutiliza createOrder/caja/issue y mantiene QR/serial/consecutivo. Acceso rechaza not_activated; después venta acepta1vez. DefensaSQLde cupo ante versiones anteriores, permisos/RLS y auditoría. Migración014 aplicada en staging/sandbox con respaldo cifrado y filas existentes intactas;0lotesprueba,0grantscliente,2triggersverificados.123Vitest/25Playwright,lint,tipos,build,diff-checkaprobados; retoque UI/limpieza repitió61servicio+1E2Eaprobados. Guía PREPRINTED_TICKETS.md. Sin impresión/correos reales, captura/controlPC, emisiónpruebascloud,commit/push/deploy. Hardware/QZ/carga externa pendientes.

2026-11-20 - Ampliado inventario preimpreso: acciones Desactivar/Eliminar para lote e individuo en vista previa y listado, diálogo con motivo/confirmación, eliminación física solo sin venta y protección atómica de lotes mixtos. Mantiene auditoría/impresión/consecutivos; borra secretos del QR y evita recreación por reintento mediante tombstone. Migración015enstaging/sandboxconrespaldo y filas existentes preservadas,0borrados/0desactivacionesdelpropietario.61servicio+13preprints y2E2Erelevantes aprobados,lint,tipos,build,diff-check; móvil revisado. GuíaPREPRINTED_TICKETS.md. Sin impresión, captura/controlPC,commit/push/deploy.

## Envío a GitHub autorizado (2026-11-20)
El propietario solicita enviar el trabajo acumulado a GitHub, levantando la restricción previa de mantenerlo sin push. Incluye UI/operación de eventos y organizaciones, navegación, boleta doble/selección/numeración, arte por evento e inventario preimpreso con activación/desactivación/eliminación; migraciones010–015 y guías correspondientes. Verificación final conjunta:126Vitest/11archivos,26Playwright,lint,tipos,build y diff-check aprobados. Escaneo de patrones de credenciales sin hallazgos en candidatos; .env.local,.local/backups,datos locales,node_modules y test-results excluidos porGit. Sin nueva impresión, modificación de ventas/lotes del propietario o control/captura del escritorio. Destino origin/main del repositorio configurado. Referencia de commit y resultado de envío se documentan tras registrar la implementación. Un push no prueba despliegue ni ensayo físico/QZ; mantener límites de las guías.

Commit de implementación de esta entrega: 5edb7dc (Complete event operations, double tickets and preprinted inventory). Registra los95archivos validados y las migraciones010–015. El commit de documentación siguiente conserva esta referencia; destino autorizado origin/main. Verificación de envío mediante git ls-remote y comparación con HEAD, sin equiparar GitHub con despliegue o homologación hardware.
