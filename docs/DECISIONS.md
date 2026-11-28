# Decisiones técnicas · 2026-10-11

## Alcance y punto de partida

La carpeta solo contenía `AGENTS.md.txt`; no había aplicación, Git ni dependencias. Se conservó ese original y se creó `AGENTS.md` como guía activa. La instrucción posterior del usuario amplió la prioridad inicial a todo el MVP y autorizó subirlo a `clubgamerzone/pasecentral.com-`, rama `main`. No autorizó cobros reales ni envío de mensajes a clientes.

## Arquitectura

Next.js App Router con TypeScript, Tailwind y componentes semánticos. No se añadieron microservicios, Redis, asientos, offline ni onboarding SaaS. Las vistas comparten `src/components/app.tsx`; operación está en `operations.tsx` y comprador en `buyer.tsx`. Las rutas sugeridas funcionan a través de `src/app/[[...path]]/page.tsx`. Los endpoints específicos viven en `src/app/api/`.

`src/lib/validation.ts` define comandos Zod. `service.ts` autoriza con identidad verificada y contiene las reglas; `db.ts` ofrece una transacción verdadera de PostgreSQL para cada mutación. Producción usa `pg` contra Supabase y Auth de `@supabase/ssr`. No se usa una secuencia de REST calls como sustituto de transacciones.

PGlite es un **adaptador exclusivo de desarrollo** ante Docker inactivo y ausencia de credenciales. Ejecuta las mismas migraciones y reglas con almacenamiento persistente local. Solo admite un proceso por carpeta. Las pruebas concurrentes locales se serializan en su backend; verifican reglas, pero no certifican bloqueos bajo carga multiconexión de Supabase.

## Seguridad

- Roles administrativos salen de tablas del servidor; comprador es el rol implícito sin permisos administrativos. No se confía en IDs de usuario/organización enviados por el navegador.
- Toda escritura se hace mediante conexión SQL privilegiada exclusivamente en servidor y autorización dentro de la transacción. Revocados `INSERT/UPDATE/DELETE` para roles de navegador. RLS limita lecturas de tablas expuestas.
- Funciones auxiliares RLS con `SECURITY DEFINER` se limitan a devolver permisos para `auth.uid()`, tienen `search_path=public,pg_temp`, y `EXECUTE` restringido. No hay funciones públicas que emitan o validen entradas con privilegios.
- Hash SHA-256 del QR para validar; token de 256 bits generado con `randomBytes`. Token recuperable cifrado con AES-256-GCM y clave privada del servidor.
- El estado administrativo y CSV nunca incluyen token QR, hash, token cifrado ni enlace de entrega. PDF/QR solo se devuelven al dueño, taquilla autorizada o poseedor del enlace secreto revocable.
- Enlace de entrega en fragmento `#`: no llega en URL al servidor. Se verifica mediante POST JSON, sin logging del body. `Referrer-Policy: no-referrer` y `Cache-Control: no-store` para documentos y estado.
- Mutaciones del navegador requieren Origin exacto y cookies SameSite. Límites de solicitudes persistentes para comandos, documentos, autenticación y firma QZ.
- Demo solo en desarrollo y escuchando en loopback. No publicar sus usuarios, base, outbox o secretos.
- Storage Supabase crea bucket `tickets` privado sin políticas públicas. El MVP genera PDFs autorizados bajo demanda desde credenciales cifradas; no necesita subir documentos ni almacenar tokens en un bucket público.

## Cupos y estados

Cada reserva, confirmación, venta, acceso y cierre toma el bloqueo de la fila del evento. Los cambios de fase bloquean evento/localidad; el trigger evita superposiciones. Todas las órdenes guardan el precio aplicado. Aforo total y cupo por localidad se calculan juntos.

Reserva de diez minutos configurable entre uno y sesenta. El inventario deja de considerar las reservas vencidas usando hora de base de datos; no depende de cron ni temporizador cliente. Un pago tardío vuelve a comprobar stock bajo el mismo bloqueo. Sin cupo o con evento cancelado/finalizado queda `needs_review`, sin boletas.

Entradas anuladas/devueltas mantienen cupo consumido por decisión conservadora del MVP. No hay botón para reabrir ese inventario; tampoco se reutilizan consecutivos. La sustitución cambia únicamente la credencial y su versión, conserva número/serial y vuelve inválido el QR anterior.

Las compras/vendas usan UUID de idempotencia. Check-in usa UUID por intento y conserva resultado original para el reintento. Se rechaza un UUID ajeno a otro operador/evento. La nueva lectura de una boleta usada resulta `already_used`.

## Pagos y devoluciones

Wompi: firma del checkout incluyendo expiración; checksum del webhook según propiedades dinámicas; consulta autenticada al proveedor para validar también campos que pueden no estar firmados. Deduplicación por transacción/estado consultado. Confirmación, pago y emisión dentro de la misma transacción. Una aprobación no se degrada por notificaciones de rechazo atrasadas. Devoluciones/void posteriores se concilian manualmente con el proveedor; no se implementó reembolso automático.

Venta física en efectivo necesita caja abierta. Transferencia requiere verificación explícita y referencia. Cortesía requiere organizador y motivo, consume aforo y siempre tiene orden. Email escrito por taquilla **no** vincula la cuenta del supuesto comprador.

Devolución manual registra referencia externa, importe y entradas afectadas. No envía dinero. Entradas usadas no son reembolsables por este flujo básico. Un pago tardío sin boletas admite devolución con selección vacía. Devolución de efectivo crea movimiento en la caja original abierta o caja abierta del responsable; si no existe, se exige abrir una. Cajas cerradas no se reescriben.

## Entrega e impresión

Resend por HTTP y cola SQL, clave de idempotencia por trabajo, seis intentos, espera creciente y recuperación de trabajos abandonados. Configurar scheduler es requisito del hosting. Adaptador inyectable permite probar fallos sin contactar un proveedor. Demo usa archivos privados de outbox y nunca envía emails reales.

BrowserPrintAdapter y QZTrayAdapter. QZ envía ESC/POS, exige impresora configurada y firma desde servidor. Registro de solicitado/enviado no equivale a confirmación física. Identificadores conservados en reimpresión. Se debe homologar un modelo real de 80 mm.

## Dependencias y verificación

Las versiones instaladas se fijaron en manifiesto y lockfile. `npm audit --omit=dev` no reportó vulnerabilidades en dependencias de ejecución. La auditoría completa reporta cinco avisos altos en la cadena de lint `braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next`; no hay parche compatible que `npm audit fix` pueda aplicar. Su propuesta forzada reduce Next ESLint a otra versión mayor; no se aplicó esa regresión. No ejecutar lint sobre repositorios o patrones no confiables. Revaluar la cadena en futuras actualizaciones.

Fuentes de integración consultadas: documentación oficial de Wompi Checkout y Eventos, enlazada en README. Para preview local se consultó la guía local de Sites; no se registró ni desplegó un Site porque la entrega solicitada es el repositorio Next.js. No se accedió a Firebase, cuentas Supabase/Wompi/Resend, ni paneles cloud externos en esta entrega.

## TLS y staging conectado (2026-10-13)

Supabase requiere CA explícita en la conexión observada. Se distribuye solo su certificado público en supabase/certificates, y DATABASE_SSL_CA se configura del lado servidor; nunca se usa rejectUnauthorized=false. DATABASE_POOL_SIZE permite limitar sesiones (tres para esta demo). APP_ENVIRONMENT=staging etiqueta los ensayos en UI, independientemente de APP_MODE=production, que únicamente selecciona Auth/SQL reales. Las pruebas conectadas están protegidas para ejecutarse solo en staging con Wompi sandbox, conservan auditoría y no borran filas financieras. Procedimiento y evidencia: docs/CLOUD_SETUP_2026-10-13.md.

## Acceso automático por QR (2026-10-13)

A petición del propietario se elimina la selección de evento de `/access`. Comando `scan_auto` en `src/lib/validation.ts` y `service.ts`: resuelve evento mediante hash de credencial y reutiliza check-in transaccional con bloqueo de evento/entrada, autorización, horario, estado e idempotencia. No acepta event_id del navegador. Un operador con varios eventos asignados puede admitir cualquiera; el aviso muestra el evento solo si está autorizado. QR desconocido sin evento se registra en auditoría `scan_unknown`, sin token, pues check_in_attempts requiere evento. Reintentos comprueban permiso vigente incluso para un resultado guardado.

En `Access` (`src/components/operations.tsx`), espera de 350 ms sin cambios para lectura sin sufijo, Enter/botón como alternativas y bloqueo de doble envío. Fallo de red conserva credencial/request_id y requiere reintento explícito para evitar bucles. Aviso accesible `role=alert` sin robar foco, cierre automático y resultado persistente; al comenzar otra lectura se retira la autorización anterior. El equipo todavía debe entregar texto mediante Wedge. No habilita ingreso offline.

## Boletas adjuntas por email y compartir PDF (2026-10-13)

Solicitud del propietario: recibir QR y cada boleta sin tener que abrir un enlace. `src/lib/ticket-email.ts` genera HTML escapado, QR PNG con Content-ID y PDF individual con `pdf-lib`/`qrcode`. Resend recibe base64, sin URLs de PDFs públicos. Se conserva enlace privado para estado y descarga; las imágenes CID pueden ser bloqueadas por el cliente de correo. Límite interno de 35 MB en contenido base64 de adjuntos para dejar margen al límite documentado de Resend de 40 MB.

`delivery.ts` prepara y cifra el payload una sola vez por trabajo (migración 003), para que una fecha de creación PDF o cambio de datos no altere el payload en un reintento idempotente. Acceso SQL a la nueva columna denegado a authenticated; estado administrativo solo devuelve campos seguros de la cola. Payload cifrado contiene credenciales de boletas y no debe exportarse. Reenvío crea un job nuevo, nunca entradas nuevas. Un PDF entregado no se revoca al revocar el enlace: el servidor sigue comprobando estado/versión del QR.

`Tickets` en buyer.tsx prepara el PDF antes del clic para conservar la activación exigida por Web Share. Permite compartir archivos en móviles compatibles y muestra descarga/adjuntar Documento en escritorio. La API nativa ofrece destinos; no fuerza WhatsApp ni certifica que el usuario envió. WhatsApp automático aplazado explícitamente por el propietario hasta disponer de número/integración empresarial. Fuentes: https://resend.com/changelog/embed-images-using-cid, https://resend.com/docs/api-reference/emails/send-email, https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share y https://whatsappbusiness.com/policy/.

## Perfil e invitaciones con permisos limitados (2026-10-13)

Se usa perfil local de PostgreSQL para nombre/teléfono/bio/foto y correo de identidad de Supabase Auth como fuente verificada. Solo se modifica el perfil propio; foto privada con sesión RLS, normalización Sharp y sin metadatos. No se añaden service_role o claves nuevas. Bucket avatars y API de imagen separada de documentos de boletas.

Invitaciones propias con Resend y cola persistente permiten asignar varios eventos antes de existir la cuenta, sin manipular contraseñas ni conceder rol desde metadata de signup. Hash/cifrado del token, destinatario confirmado desde Auth y transacción al aceptar. Organizador en event_staff permite alcance por evento; la membresía de organización existente conserva su alcance. El administrador global puede invitar roles globales, advertidos en UI. Reenvío genera clave de idempotencia nueva; revocar invalida aceptación sin borrar historial. Detalles de archivos, configuración, sesión y pruebas en PROFILE_TEAM_SETUP.md.

# Edición segura y galería (2026-10-13)

La solicitud del propietario agrega edición de eventos y cupos vendidos/agotados; las mutaciones comparten bloqueo transaccional del evento con venta y vencimiento. Se mantiene la regla de aforo compartido y no se reescriben snapshots históricos. Cupo cero permitido cuando no existen compromisos. Slug público estable. Descripción plana y galería máxima de ocho imágenes normalizadas con Sharp, Storage privado y lectura pública solo mientras el evento está publicado. No usar bucket público ni nuevas llaves de servicio; sesión Supabase y RLS por evento. Guía: EVENT_EDITING.md.

## Invitaciones exclusivamente laborales (2026-10-13)

Comprador es toda persona registrada que compra; no necesita ni recibe invitación. Se retira customer del comando/formulario de invitación, con restricción de base para nuevas escrituras y revocación auditada de pendientes antiguas. Históricos se conservan sin exposición en equipo ni posibilidad de aceptar; cuentas/ventas no se modifican. Roles invitables: platform_admin, organizer por evento, box_office (Cajero / taquilla) y access_staff, con múltiples eventos para los operativos. Ver PROFILE_TEAM_SETUP.md.

## Reiniciar fixtures conservando identidad (2026-10-13)

El propietario autoriza eliminar registros de ensayo, incluidos registros financieros ficticios, para comenzar eventos propios. Es una limpieza excepcional de staging/sandbox, no una corrección de ventas reales. Se usa CLI privado con lista exacta de eventos DEMO, comprobación de invitaciones dependientes, respaldo cifrado verificado y transacción con bloqueos. Se conservan Auth/perfiles/invitaciones/roles generales, seguridad e integraciones. Se retiran asignaciones a eventos eliminados. Pagos siguen en sandbox hasta activación comercial explícita. Guía: TEST_DATA_RESET.md.

## Auditoría comprensible (2026-10-13)

El propietario no encontraba las definiciones de los códigos internos. La tabla usa nombres/explicaciones en español conservando códigos originales para soporte; catálogo completo consultable y buscable dentro de Reportes, disponible con auditoría vacía. No se modifican operaciones, registros ni autorizaciones; códigos futuros desconocidos no se interpretan automáticamente. Fuente única: audit-labels.ts; guía AUDIT_GUIDE.md.

# Analítica de ventas y audiencia individual (2026-10-13)

Solicitud del propietario: ampliar vista general/reportes con ventas generales y por evento, fases más vendidas, ranking/comparación anual y composición del público. Se comparte componente y endpoint de agregados autorizados, con snapshot SQL REPEATABLE READ; no se calcula demografía en cliente a partir del estado administrativo. Género y edad voluntarios se registran por entrada con consentimiento y rangos amplios, sin nombres/DOB. Datos antiguos quedan desconocidos. RLS/REVOKE impide leer filas demográficas directamente y las respuestas/exportaciones contienen agregados. Migración 007 aditiva, sin nueva limpieza cloud. Definiciones de ventas, fechas, inventario, cobertura, devoluciones y límites en ANALYTICS.md. No se estima utilidad ni medios específicos de Wompi que no estén registrados.

## Ampliación autorizada de cuentas y entradas — 2026-10-14

El propietario amplía alcance a organizaciones/transferencias/regalos antes pospuestos. Aceptación con identidad verificada y plazo 7 días; destinatario de regalo puede registrarse, transferencia solo a cuenta existente. Titularidad cambia atómicamente y rota QR/revoca enlaces, conserva inventario/emisión/historial. Demografía del perfil se copia a la propia entrada, no a todos los acompañantes; snapshots anteriores se restauran al cancelar transferencia. Eliminar cuenta propia anula sin reembolsar, anonimiza perfil y elimina Auth conservando actor financiero mediante FK separable; RLS restrictive active_account niega JWT antiguo. Último admin/cajas/Storage ajeno protegen operación. No service_role nuevo ni SQL cliente.

Apertura de puertas en fecha inicial con campo hora; cierre permite día siguiente, edad mínima editable (aceptado por propietario) y zona Colombia. Fase both comparte precio, compite con ambos canales, edición conserva snapshots. Bloquear contextmenu cumple preferencia de interfaz y no es control de seguridad contra inspección. Plantillas Auth españolas y callbacks por tipo verifican sesión antes de perfil/recuperación. Código, servicios, pruebas y límites en ACCOUNTS_TICKETS_2026-10-14.md.

## Análisis visual — 2026-10-14

Gráficos React/SVG/CSS propios sobre los agregados autorizados existentes, sin biblioteca/proveedor de tracking adicional. Tortas para distribución, barras para comparar y línea con eje temporal real; tablas/CSV conservados. Verde/amarillo/rojo se interpretan según significado, no signo numérico de forma indiscriminada: incidencias positivas son rojas, reservas pendientes amarillas y faltantes negativos rojos. Categorías demográficas distinguidas sin juicio ni inferencia. Cero/sin base neutral; cupo bajo tiene umbral explícito 10% del total filtrado; no inventar metas o datos. Guía: ANALYTICS_VISUALS.md.

## Gestión ampliada de equipo — 2026-10-14

Casilla Incluir acceso persiste intención, acepta dos roles existentes box_office/access_staff y no crea un rol combinado especial. Edición por evento reemplaza asignaciones directas atómicamente, conserva otras y alerta sobre herencia global/organización. Gestores de evento pueden invitar/editar dentro de todos sus eventos autorizados; no editar nombres/globales ni administrador global. Solo global edita nombre/rol global, sin retirar último admin. Invitación aceptada nunca se reaplica después de retirar roles; creador se revalida en worker/aceptación. RLS restringe invitaciones al alcance completo y helper privilegiado no es ejecutable por clientes. Guía TEAM_PERMISSIONS.md; migración 009 aditiva, ninguna asignación existente modificada al desplegar.

2026-11-18 - STARPOS IF4: ante solicitud del propietario se ensaya un incremento de oscuridad 15 a 18 en una sola muestra RAW (TEST-004), manteniendo 50.8 mm/s y formato para comparacion. No escalar automaticamente si persiste transferencia irregular; comprobar ribbon/cartulina/montaje. Sin homologacion de QR ni cambio de preferencias Windows confirmado. Detalles: docs/PRINTER_STAR_IF42.md.

2026-11-18 - Impresion: segundo incremento solicitado por propietario, D18 a D21 en una copia TEST-005 manteniendo velocidad/diseno. No cambiar fuente simultaneamente para distinguir efecto de energia; si persiste transferencia irregular comprobar montaje/material antes de otro incremento. Lectura EDA51 sigue pendiente.

2026-11-18 - Impresion: prueba unica TEST-006 con D26 solicitado por propietario, mismo diseno/velocidad. Se fija energia en RAW para reflejar el valor solicitado, sin asumir que defaults Windows se apliquen. No concluir mejora ni escalar sin evidencia fisica.

2026-11-18 - Diagnostico impresora: tras persistir huecos a D26, mantener energia/velocidad y comparar tipografia de proporciones normales con bloques solidos pequenos en tres posiciones (TEST-007). Permite separar apariencia de fuente y transferencia irregular sin asumir averia. No incremento de oscuridad ni ajustes mecanicos.

STARPOS: comprobar cara imprimible del material antes de diagnosticar transferencia/consumibles. Propietario resolvio calidad invirtiendo papel (TEST-009). Para alinear cortes, verificar marcas inferiores tras inversion y paso real antes de offsets/calibracion; modo continuo usado hasta ahora no registra perforaciones.

## Papel por puesto de taquilla (2026-11-18)

Selector por navegador, no esquema de BD: recibo80 heredado, STARPOS70x40 y concierto70x100. Separar ESC/POS de ZPL por perfil para no enviar comandos incompatibles. Mantener PDF digital/QR original, permisos/auditoria actuales. Formatos ZPL codifican texto como UTF8 hexadecimal y calculan QR con margen blanco segun contenido. Perfil40 incorpora ajuste+4mm confirmado por propietario en TEST-013; no extrapolar al papel100. Configuracion avanzada validada; no guardar EEPROM ni cortar/calibrar remotamente. Browser no configura sensor/energia. QZ firmado depende de instalacion/certificado/nombre autorizado ya previstos, sin afirmar que flujo completo este homologado.
Seguridad detectada durante verificaciones: npm audit identifico next16.4.0 vulnerable; actualizados next y eslint-config-next a16.4.6 (patch), lockfile fijado. Audit de dependencias de produccion posterior:0 vulnerabilidades. No se ejecuto actualizacion automatica mayor ni se cambiaron credenciales.

Red local: un puerto Next3000 para frontend/API, origen exacto APP_URL en IP LAN y firewall limitado a red privada/subred local, sin backend separado ni exposicion PostgreSQL. Modo demo localhost no se relaja. Limpieza de ensayos ejecutada por CLI privado sobre inventario exacto autorizado en ambos destinos, backup cifrado y comparacion de identidades/invitaciones; mantener Storage y auditoria para recuperacion. Guias LOCAL_NETWORK.md y TEST_DATA_RESET.md.

2026-11-19 - Opcionales de evento: NULL expresa aforo global ilimitado o finales no definidos, sin sentinelas. Cupos por localidad y transacciones permanecen. Apertura igual a inicio se deriva de valores guardados, no otra columna redundante. Si no hay cierre de puertas se usa fin del evento; sin ambos el operador finaliza/cancela para cerrar acceso. Totales con ilimitados no generan ocupacion/disponibilidad finita inventada. Migracion010 aplicada con respaldo, sin alterar filas existentes. Guia EVENT_OPTIONS.md; codigo no publicado.

2026-11-19 - Enlace del evento es slug web con ejemplo /eventos; alias publico conserva /events sin migrar slugs. Miniaturas cliente no equivalen a archivo guardado: mostrar estado/error. Localidad NULL ilimitada solo permitida con padre ilimitado; impedir volver padre a finito hasta acotar hijos. Migracion011 no cambia cupos existentes; detalles EVENT_OPTIONS.md.

2026-11-19 - IDs cliente deben soportar HTTP LAN de ensayo: usar crypto.randomUUID cuando exista y UUIDv4 con getRandomValues si falta; no Math.random ni sustitucion de tokensQR servidor. Aislar en browser-id.ts y probar ausencia de API nativa en comprador/taquilla/acceso. LOCAL_NETWORK.md contiene causa,verificacion y limites.

## Organización visual compartida (2026-11-19)

Se unifican etiquetas, controles, ayudas, espacios y acciones para todos los formularios bajo .content. Las opciones de horarios se agrupan en fieldset; el cupo se alinea antes de su interruptor. Edición de localidad usa dialog nativo para no ensanchar tablas y conservar foco/Escape. Estilos de esta entrega limitados a pantalla, preservando plantillas de impresión. Guía UI_LAYOUT.md. Sin servicios nuevos ni publicación.

## Final dinámico de fases de precio (2026-11-19)

`pricing_phases.ends_at IS NULL` significa hasta fin del evento, no fecha desconocida. Resolver en servidor mediante final del evento y, sin final, sin límite temporal mientras las ventas sigan publicadas. No copiar una fecha fija para que editar el evento actualice automáticamente la fase. Trigger de solapamiento trata NULL como infinito para reservar el tramo restante del canal y evitar conflictos por extensiones futuras. Migración012 conserva filas; documentación EVENT_OPTIONS.md.

## Apertura de caja contextual (2026-11-19)

Taquilla abre una sesión desde diálogo nativo para el evento activo y el operador autenticado usando el mismo comando cash_open de Caja. No navegar ni duplicar estado de venta; refrescar estado servidor al éxito. Cancelación sin escritura y error dentro del modal con valor conservado. Sin nuevas dependencias/migraciones. Ver OPERATIONS.md.

2026-11-19 - Jerarquía visual compartida: verde principal, azul secundario, rojo destructivo y gris deshabilitado; conservar etiquetas explícitas y foco. Organizaciones usa tarjetas y panel de alta separado, catálogo conserva arte existente y ordena búsqueda/metadatos/precio/CTA. Ajustes en media screen para no alterar papel/QR. Pruebas visuales por rutas con datos demo aislados; guía UI_LAYOUT.md. Sin nuevas dependencias ni cambios de reglas.

## Navegación sin reiniciar aplicación (2026-11-19)

App pasa a layout compartido src/app/(platform)/layout.tsx con catch-all bajo el mismo grupo; URLs sin cambio. next/link para navegación interna, descargas y enlaces externos conservados. Estado se actualiza en segundo plano y descarta respuestas obsoletas, siempre con autorización de mutaciones en servidor. state.ts agrupa lecturas con parámetros y calcula permisos equivalentes a can(), evitando N consultas por evento. Medición staging un evento27→13 consultas,4.3–4.5s→2.2–2.4s para state sin Auth/HTTP. Pruebas/alcance/límites en NAVIGATION_PERFORMANCE.md.

## Boleta doble integrada (2026-11-19)

Cada entrada mantiene una identidad, pero ocupa dos tramos70x40: QR/precio/localidad/fase en control superior; arte/datos como parte para el cliente debajo. PNG raster común para pantalla/PDF/ZPL/ESC-POS, precio del snapshot de venta y arte por evento privado normalizado. Migración013 agrega tabla pequeña bytea con RLS sin permisos de navegador, evita depender de sesión Storage para que el worker genere PDF. El render no crea entradas ni modifica credenciales. Preferencias v2 cargan nuevo default70x40/+4mm/oscuridad16 sin heredar receipt80 de v1; selección futura se recuerda. Detalles y límites TICKET_DOUBLE_LAYOUT.md. Sin impresión real ni push/despliegue en esta entrega.

2026-11-19 - Corrección de confirmación de impresión: cancelar Chrome no se puede distinguir de imprimir desde window.print. Navegador ahora queda requested y pide resultado encima de las boletas, sin decir enviada; No se imprimió / cancelé registra failed y Papel impreso y verificado registra confirmed. QZ registra submitted solo al aceptar trabajo y todavía exige verificación física. No migración ni cambios de registros históricos. Implementación buyer.tsx y prueba de taquilla; guía TICKET_DOUBLE_LAYOUT.md.

2026-11-19 - Apertura de impresión: sustituido bucle de registro individual + refresh global por print_batch_request atómico (1–500 IDs únicos) y omisión de refresh solo en comandos de impresión. Todos los eventos autorizados antes de insertar trabajos/auditoría; filas bloqueadas en orden para reimpresiones por lote. Mantiene registro previo a window.print, resultado manual y sin cambios de credenciales/plantilla. Guía TICKET_DOUBLE_LAYOUT.md; sin migración, dependencias o despliegue.

2026-11-19 - Registro de papel vía navegador: el driver puede sobrescribir el modo del equipo y window.print no aplica tracking de PrintSettings. Preferencias de este usuario guardadas con sensor de marcas y origen0, desplazamiento+4solo en CSS; QZ conserva su propia configuración explícita. Advertencia permanente en PrintOptions y verificación PDF Chromium. No dar por homologada salida por PDF ni por guardar preferencias. Detalle PRINTER_STAR_IF42.md.

2026-11-19 - Perfil boleta doble TEST-019 aceptado por propietario: oscuridad26y50.8mm/scon marcaoffset0/LT32. Default70x40deappahora26; preferenciasv3heredanv2conservando papel/top/trackingy oscuridadpersonalizada, soloantiguo16de70x40seactualiza26. No equivalencia de preferenciaswebconWindowsni nueva homologaciónChrome/QZ. PRINT_PAPER_SETTINGS.md y PRINTER_STAR_IF42.md.

2026-11-20 - Selección separada de visualización: PaperTickets mantiene todas las tarjetas y emite en print-only solo subconjunto del operador; buyer pasa mismos IDs al registro y QZ. PDF/compartir no cambia de alcance y lo indica UI. Numeración usa tickets.event_sequence existente en emisión transaccional, no índices de impresión ni contador alterno; encabezado común destaca número por evento, cortesías incluidas, anulaciones no reciclan. Guía TICKET_SELECTION.md. Sin migración ni renumeración/rotación de QR.

## Inventario físico con venta posterior (2026-11-20)

Por autorización del propietario, papel sin vender vive en tablas separadas de tickets/órdenes: no crear cortesías ni órdenes falsas para preimprimir. Se aparta cupo y consecutivo al preparar, se congela precio del lote y se convierte un apartado en venta únicamente con pago autorizado. createOrder/issue reciben contexto interno validado para conservar token/serial/número; nunca se activa desde check-in. Estado stock/activated/blocked del inventario es distinto de valid/used/cancelled de la entrada vendida. Bloquear pendientes libera cupo sin cancelar ventas ni reciclar números. TriggersSQL protegen apartado frente a instancias viejas mientras el código permanece local; un sitio antiguo puede necesitar conciliación si intenta confirmación tardía incompatible. Esquema014servidor/RLSsinpermisoscliente, auditoría y documentos privados; guía PREPRINTED_TICKETS.md. No agregar webhook/cuentas externos ni activar offline. Publicación y ensayo hardware siguen separados.

2026-11-20 - Desactivar conserva inventario blocked y libera cupo; eliminar destruye credenciales y registros sin venta con auditoría retenida. No permitir borrado de ventas ni lotes que contengan activadas; el último pendiente eliminado retira su lote vacío. Migración015desacopla historial de impresión (FKSETNULL+snapshotvisible) y guarda solicitudes eliminadas sin QR para evitar recreación por reintentos. Bloqueo evento→lote/boletas serializa con activación. Controles visibles en documento e inventario, permisos de gestor y confirmación explícita. Guía PREPRINTED_TICKETS.md.

2026-11-20 - Activación del scheduler debe observar todas las colas que consume deliver(), incluidas account_notifications además de delivery_jobs/team_invitations. Condición compartida delivery-scheduler.ts ejecutada en pruebas SQL para evitar omisión del flujo de regalos sin PDF previo. Parche al cron existente preserva endpoint,Vault,horario y autenticación; reenvío de avisos reales exigió autorización explícita del propietario, obtenida antes de aplicar. Regalar no crea cuentas/passwords. Guía EMAIL_SETUP_2026-10-13.md y resultado de cola/provider separados de entrega al inbox.

# Registro sin afirmación falsa de cuenta nueva (2026-11-20)

Conservar la respuesta neutra de Supabase para no revelar públicamente cuentas existentes. No usar consultas públicas de existencia ni cambiar identidad/contraseña/perfil al intentar registrarse de nuevo. La API normaliza correo y trata códigos de duplicado como respuesta neutra solo en signup; la UI ofrece iniciar sesión/recuperar tras enviar y elimina la afirmación «Cuenta creada» incluso en invitaciones. Implementación, pruebas y límites: SIGNUP_CLARITY.md.

2026-11-20 — La entrega por correo a un titular usa alcance exclusivo de propiedad, aunque también tenga permisos administrativos. Los permisos de operación no amplían sus adjuntos personales. No cambiar snapshots de envío iniciado durante una revisión de diseño: los reintentos conservan cuerpo e idempotencia. Guía y cobertura de compra/taquilla/regalo/invitación: EMAIL_FLOW_VERIFICATION.md.
2026-11-20 — Los textos de boletas se convierten a contornos con fuentes incluidas y licenciadas antes de rasterizar. No depender de fuentes del sistema en serverless: la comprobación local no evidenció los cuadrados que aparecieron en Vercel. Verificar también artefactos de tracing y salida remota. Guía TICKET_FONT_RENDERING.md.
2026-11-26 — Preparar endpoint independiente para webhook de producción; delegar al mismo procesador autenticado e idempotente solo con entorno completo production. No cambiar configuración de ensayo a live sin acordar corte de datos: cuenta aprobada y disponibilidad de llaves no acreditan que tickets previos o recaudo para terceros sean comerciales/autorizados. Vercel Hobby observado requiere elegir hosting de uso comercial. Guía WOMPI_CUTOVER_2026-11-26.md.

- Producción separada (2026-11-26): decisión expresa del propietario de conservar los ensayos en su base y crear otra para ventas reales. No copiar identidades o ventas sandbox.15migraciones sin seed, TLS/RLS verificados; SMTP y13plantillas Auth configurados. Reservas de secretos LIVE todavía inactivas en Vercel. Procedimiento, ubicaciones y pendientes: docs/PRODUCTION_DATABASE_2026-11-26.md.

- Corte aislado a live y dominio propio (2026-11-26): conservar secretos canónicos anteriores como rollback antes de ventas; PASE_CONFIG_PROFILE=live selecciona de forma estricta reservas del proyecto nuevo, sin fallback. Pro y dominio adquiridos por propietario; pasecentral.app vinculado, Auth actualizado. Configuración, pruebas, límites y recuperación: docs/PRODUCTION_DOMAIN_2026-11-26.md.

## Venta rápida de preimpresas por lectura — 2026-11-26

El propietario solicitó eliminar los clics de consulta y confirmación en el recorrido de venta preimpresa. La pantalla de activación inicia en venta rápida: recibir el pago y escanear equivale a registrar la venta al precio del lote; evento identificado por QR, aviso de resultado y foco para siguiente lectura. Efectivo exige caja abierta por evento/operador. Transferencia exige referencia y verificación individual previa, que se limpian al completar cada venta. No se aprueba una transferencia automáticamente ni se registra ingreso al activar. Se conserva alternativa manual con datos/contacto y correo. Reutiliza transacción, autorización y claves idempotentes existentes; sin migración. Código y operación: docs/PREPRINT_QUICK_SALE.md. Cambio exclusivamente local hasta ensayo del propietario.

## Puestos rápidos y prioridad web — 2026-11-26

Por instrucción del propietario, lector/venta de preimpresas vive dentro de Taquilla; menú Preimpresas administra lotes. Lectores usan resultado del comando sin recarga general; metadatos mínimos en respuesta autorizada permiten una petición por activación. El campo se vacía también al rechazar duplicados, mientras un reintento recuperable conserva la solicitud en memoria. Se bloquea impresión de usadas/anuladas en UI y servidor, incluso con selección antigua. Apertura repetida de caja es idempotente y no cambia su fondo. Primera APK nativa DEV instalada y acceso observado; continuar APK queda aplazado explícitamente hasta terminar revisión web. Guías docs/PREPRINT_QUICK_SALE.md, TICKET_SELECTION.md y ANDROID_TERMINAL.md. No publicación en este trabajo local.

## Inicio y boletas personales — 2026-11-27

Comprador sin capacidad operativa inicia en Mis entradas con carrusel horizontal. El destino depende de permisos reales, no del rol/etiqueta con que se registró. Personal conserva su puesto y consulta únicamente sus boletas desde Ver mis tiquetes. Preview/PDF personal comprueba titularidad en servidor y no usa permisos administrativos para mostrar boletas ajenas. QR grande de acceso en tarjeta digital, sin copiar toda la plantilla de impresión en la portada del wallet; imagen cargada bajo demanda y caché solo en memoria. Guía docs/BUYER_WALLET.md; entrega de desarrollo, no publicada automáticamente.

# Formularios adaptables — 2026-11-27

La edición de fase usa diálogo nativo como caja/localidades para aislar foco y evitar herencia de `nowrap` desde tablas. `Field` y las etiquetas `.field` comparten distribución vertical y columnas con mínimo cero; los interruptores conservan flex. Los términos enlazados de registro/compra forman un único bloque textual junto a su casilla. Sin cambios de reglas de venta ni impresión; guía y reproducción en docs/FORM_LAYOUT.md. Cambios locales pendientes de publicación.

## Venta con fases desactivadas — 2026-11-27

Desactivar una fase retira su precio del canal; la localidad solo se ofrece para venta pagada si existe otra fase activa y vigente del mismo canal. Cortesías autorizadas conservan independencia de fases. UI y payload excluyen selecciones sin precio elegible; servidor mantiene validación transaccional existente. Código buyer.tsx/operations.tsx, regresión inactive-pricing.spec.ts y resultados en PROGRESS.md. No modifica documentos o compras anteriores.

## Registro rápido en compra — 2026-11-27

Visitantes pueden registrarse desde el evento reutilizando Supabase Auth, confirmación y reglas existentes de perfil/condiciones. El retorno admite exclusivamente `/events/[slug]` con cantidades (sin precios, identidad ni secretos); no reserva cupo ni confirma compras durante registro. Recuperación e invitaciones conservan prioridad. Usuario conectado ve el correo de cuenta como información, sin campo repetido; servidor impone correo verificado. Regalos conservan aceptación separada. Archivos, ejecución y dependencia de configuración del correo: docs/QUICK_PURCHASE_ACCOUNT.md. Sin migración o publicación en este cambio.
