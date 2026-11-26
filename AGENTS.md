# AGENTS.md — Plataforma de boletería para fiestas

## 1. Objetivo y contexto

Construir una aplicación web para un organizador de fiestas en Colombia.

El primer lanzamiento debe permitir operar un evento real:
crear fiesta, configurar entradas y precios, vender online o en
taquilla, emitir boletas físicas y digitales, validar el ingreso con
Honeywell EDA51 y consultar ventas y asistencia.

El cliente puede organizar varias fiestas simultáneamente o durante
la misma semana. Cada evento debe mantener independientes sus cupos,
precios, ventas, boletas y accesos.

Propietario de la plataforma: José Demoya.
Idioma del producto: español.
Moneda inicial: COP.
Zona horaria de presentación: America/Bogota.

La fecha del primer evento y el aforo están pendientes. No inventarlos.

## 2. Forma de trabajar de Codex

- Revisar el repositorio antes de crear o modificar archivos.
- Si está vacío, implementar el proyecto desde cero.
- Si ya existe, conservar su estructura y reutilizar lo válido.
- Avanzar en tareas reversibles sin solicitar aprobación rutinaria.
- Preguntar solamente por decisiones que bloqueen trabajo real.
- Implementar flujos completos y verificables, no únicamente pantallas.
- Mantener este documento como fuente de alcance.
- Documentar decisiones técnicas en docs/DECISIONS.md.
- Actualizar docs/PROGRESS.md con avances y pendientes.
- No inventar credenciales, integraciones funcionando ni resultados de pruebas.
- No publicar, cobrar pagos reales o enviar mensajes a clientes sin
  autorización explícita.
- Utilizar datos ficticios exclusivamente en desarrollo.
- No mostrar datos de demostración como métricas reales.
- Al terminar una entrega, indicar qué funciona, cómo probarlo y
  qué depende de configuración externa.

## 3. Meta final

Evolucionar hacia una plataforma donde múltiples organizaciones
administren eventos, equipos, ventas, accesos y reportes.

Capacidades futuras:
- Registro y administración de organizaciones.
- Permisos por organización y evento.
- Promotores, descuentos y comisiones.
- WhatsApp automático.
- Transferencia de entradas.
- Reembolsos automatizados.
- Liquidaciones y conciliación avanzada.
- Control de acceso offline coordinado.
- Más pasarelas y dispositivos.
- Asientos numerados y mapas de recintos.
- Facturación mediante integración externa cuando corresponda.

Diseñar relaciones que permitan evolucionar, pero NO construir esas
capacidades antes de completar el MVP.

## 4. Alcance obligatorio del MVP

- Una organización inicial.
- Administrador global y organizador.
- Personal de taquilla y acceso asignado por evento.
- Cuenta de comprador y sección Mis entradas.
- Múltiples fiestas independientes.
- Localidades configurables, inicialmente General y VIP.
- Aforo total y cupo por localidad.
- Precios por fases y precio de taquilla.
- Venta online con una pasarela.
- Venta presencial con efectivo o transferencia verificada.
- Órdenes con múltiples entradas individuales.
- Consecutivo visible y serial de seguridad por boleta.
- QR único por entrada.
- Boleta digital descargable.
- Email automático con acceso a las entradas.
- Compartir por WhatsApp de forma manual.
- Impresión térmica de 80 mm.
- Validación online mediante EDA51.
- Dashboard consolidado y por evento.
- Reportes CSV.
- Cierre básico de caja.
- Cortesías autorizadas.
- Anulación de entradas y registro manual de devoluciones.
- Auditoría de operaciones sensibles.

Fuera del MVP:
- Onboarding de múltiples organizadores.
- Suscripciones SaaS.
- Asientos o mapas de teatros.
- Modo offline que autorice ingresos.
- Reingreso automático.
- Promotores y comisiones.
- WhatsApp automático.
- Wallet de Apple o Google.
- Redis, microservicios o backend Python separado sin necesidad concreta.

## 5. Stack inicial

- Next.js con App Router y TypeScript.
- Supabase: PostgreSQL, Auth y Storage.
- Tailwind CSS y componentes accesibles.
- Zod para validación de entradas.
- Wompi Checkout para pagos online.
- Adaptador de email transaccional.
- QZ Tray para impresión ESC/POS cuando se configure.
- Vitest para pruebas de reglas.
- Playwright para flujos críticos.

Usar versiones estables compatibles y fijarlas mediante lockfile.
Documentar versiones y requisitos del entorno.

Ejecutar pagos, emisión, cambios de cupo y check-in en servidor
mediante transacciones de PostgreSQL.

Las llamadas consecutivas desde JavaScript no equivalen a una
transacción de base de datos. Implementar funciones SQL transaccionales
o una conexión de servidor apropiada.

Las funciones privilegiadas no deben poder invocarse directamente por
un cliente sin autorización. Si usan SECURITY DEFINER, restringir
EXECUTE, fijar search_path y validar identidad y permisos.

## 6. Roles y autorización

Roles:
- platform_admin
- organizer
- box_office
- access_staff
- customer

Permisos:
- platform_admin: acceso administrativo general.
- organizer: gestiona eventos y reportes de su organización.
- box_office: vende e imprime en eventos asignados.
- access_staff: valida ingresos en eventos asignados.
- customer: consulta sus órdenes y entradas.

Un usuario puede tener distintas asignaciones por evento.

Reglas:
- Denegar por defecto.
- Verificar permisos en servidor y en políticas RLS.
- No confiar en organization_id, user_id, event_id o rol enviados
  por el navegador.
- No permitir autoasignación de roles administrativos.
- Mantener service_role y secretos exclusivamente en servidor.
- Configurar Storage privado para documentos de entradas.
- Las rutas públicas solo exponen información de eventos publicados.

El rol del usuario y la categoría del comprador son conceptos diferentes.
Guardar buyer_category como clasificación opcional definida por el
organizador, sin conceder permisos.

El administrador inicial se crea mediante procedimiento de bootstrap
documentado, nunca mediante una ruta pública sin protección.

## 7. Modelo de datos mínimo

Implementar migraciones SQL versionadas.

Entidades principales:

organizations
- id, name, created_at

profiles
- id vinculado a auth.users
- name, phone, created_at

platform_admins
- user_id

organization_members
- organization_id, user_id, role

events
- id, organization_id, slug
- title, description, cover_path, venue_name, address
- starts_at, ends_at, admission_starts_at, admission_ends_at
- capacity, status, created_by, created_at

event_staff
- event_id, user_id, role, active

ticket_types
- id, event_id, name, capacity, active

pricing_phases
- id, ticket_type_id, channel
- name, price_cop, starts_at, ends_at, active

orders
- id, event_id, buyer_user_id nullable
- buyer_name, buyer_email, buyer_phone, buyer_category
- channel, status, reservation_expires_at
- subtotal_cop, fees_cop, total_cop
- created_by, created_at

order_items
- id, order_id, ticket_type_id, pricing_phase_id
- quantity, unit_price_cop, line_total_cop
- snapshot del nombre de localidad y fase

payments
- id, order_id, provider, method
- provider_transaction_id, reference
- amount_cop, currency, status
- verified_by, verified_at, created_at

tickets
- id, event_id, ticket_type_id, order_item_id
- owner_user_id nullable
- event_sequence, visible_number, security_serial
- credential_hash, credential_version
- status, issued_at, used_at nullable

check_in_attempts
- id, event_id, ticket_id nullable
- operator_id, device_id, gate_label
- result, attempted_at, request_id

cash_sessions
- id, event_id, operator_id
- opening_cash_cop, opened_at, closed_at
- declared_cash_cop, expected_cash_cop, difference_cop

cash_movements
- id, cash_session_id, payment_id nullable
- type, amount_cop, reason, created_by, created_at

refunds
- id, order_id, payment_id nullable
- amount_cop, status, reason, external_reference
- created_by, completed_at

delivery_jobs
- id, order_id, channel, status
- attempts, next_attempt_at, last_error, created_at

print_jobs
- id, ticket_id, operator_id
- status, is_reprint, created_at

audit_logs
- id, actor_id, action, entity_type, entity_id
- safe_metadata, created_at

payment_webhook_events
- id, provider, deduplication_key
- processing_status, received_at, processed_at

Agregar índices para relaciones, filtros frecuentes y búsqueda.

Restricciones:
- provider_transaction_id único cuando exista.
- security_serial único.
- event_sequence y visible_number únicos dentro del evento.
- Unicidad de membresías y asignaciones.
- Valores monetarios y cantidades no negativos.
- Cantidad de compra positiva.
- Fin posterior al inicio.
- Entradas siempre vinculadas a una orden, incluida cortesía.
- Integridad de event_id entre órdenes, localidades y entradas.

No usar números de punto flotante para dinero.
Guardar COP como enteros; convertir a centavos solo en el adaptador
cuando la pasarela lo requiera.

Guardar fechas en UTC y presentar en America/Bogota.

## 8. Estados

Eventos:
draft, published, sales_closed, finished, cancelled

Órdenes:
pending_payment, confirmed, expired, cancelled,
partially_refunded, refunded, needs_review

Pagos:
pending, approved, declined, error, voided

Entradas:
valid, used, cancelled

No mezclar estado de pago con estado de entrada.
Un reembolso parcial debe identificar qué entradas afecta.

Definir transiciones permitidas y rechazarlas en el servidor.
Mantener historial de cambios importantes.

## 9. Cupos, reservas y precios

- Las localidades comparten el límite total del evento.
- Las fases no crean inventario adicional.
- Evitar fases superpuestas para la misma localidad y canal.
- Calcular precio y cargos en servidor.
- Mostrar el total antes del pago.
- Guardar el precio aplicado en order_items.
- No modificar órdenes anteriores cuando cambia una fase.
- Reservar cupo temporalmente durante el checkout.
- Usar una duración configurable; valor inicial propuesto: 10 minutos.
- No permitir sobreventa con compras concurrentes.
- Cortesías también consumen aforo.
- Mantener precio de taquilla independiente del precio web.

Reservar inventario, confirmar venta y liberar reservas mediante
transacciones y bloqueos coherentes.

El vencimiento y la confirmación de pago deben coordinarse para
evitar liberar un cupo mientras se confirma su venta.

Pago aprobado después del vencimiento:
- Si hay inventario, confirmar e emitir una sola vez.
- Si no hay inventario, marcar needs_review.
- No emitir por encima del aforo.
- Mostrar la incidencia al administrador para resolver devolución.
- Informar al comprador sin afirmar que ya tiene una entrada válida.

No depender únicamente de un temporizador del navegador para liberar cupos.

## 10. Pagos

Integrar Wompi mediante un adaptador PaymentProvider.

Responsabilidades:
- Crear referencia única de la orden.
- Generar parámetros y firma requeridos en servidor.
- Verificar autenticidad de webhooks según documentación vigente.
- Comprobar referencia, importe, moneda y transacción.
- Registrar eventos y procesarlos de forma idempotente.
- Manejar notificaciones repetidas o fuera de orden.
- Consultar el proveedor para reconciliar incidencias.
- No confirmar por parámetros de URL de retorno.

Emitir entradas únicamente después de pago aprobado y verificado,
cobro presencial autorizado o cortesía autorizada.

Inicialmente el comercio de la pasarela será el del organizador.
No implementar custodia de fondos ni repartos entre organizadores.

Transferencias presenciales:
- Requieren verificación del operador autorizado.
- Registrar referencia, importe y responsable.
- Una captura de pantalla no confirma automáticamente el pago.

No almacenar datos de tarjeta.

## 11. Serial, QR y emisión

Cada boleta posee tres identificadores:
1. Consecutivo visible para orden y soporte.
2. Serial aleatorio visible para identificación adicional.
3. Token QR secreto para validar acceso.

Ejemplo de número visible: FIE-026-000145.

El serial visible no será la credencial suficiente para ingresar.
No generar tokens a partir del consecutivo.

Generar tokens mediante un generador criptográficamente seguro, con
al menos 128 bits de entropía. Guardar su hash para la validación.

Si se necesita reconstruir el documento, proteger el token original
mediante cifrado de servidor o conservar el documento privado emitido.
No guardar el token en logs, analítica o respuestas administrativas generales.

Numeración:
- Única por evento.
- Asignada con control de concurrencia.
- No reutilizar números anulados.
- Admitir saltos; no prometer una secuencia contable sin huecos.

Una orden de tres entradas emite tres QR distintos.
La emisión debe ser idempotente y transaccional.

Físico y digital representan la misma entrada:
- Reimpresión: mismos identificadores.
- Reenvío: mismos identificadores.
- Sustitución: nueva credencial e invalidación de la anterior.

Registrar sustituciones y reimpresiones en auditoría.

## 12. Boleta digital y entrega

Mostrar:
- Evento, fecha, lugar y localidad.
- Número visible y serial.
- QR legible.
- Estado y condiciones breves de ingreso.

Permitir:
- Visualización en Mis entradas.
- Descarga de PDF.
- Email automático con enlace protegido.
- Reenvío autorizado.
- Compartir manualmente el enlace por WhatsApp.

Usar enlaces secretos revocables o acceso autenticado.
No exponer PDFs en buckets públicos.

Enviar emails mediante una cola persistente basada en delivery_jobs.
Los fallos de entrega no deben revertir un pago confirmado.
Reintentar sin emitir entradas nuevas.

El enlace enviado por WhatsApp concede acceso a la boleta: tratarlo
como información sensible. No publicarlo en logs.

Para taquilla:
- El contacto es necesario si se solicita entrega digital.
- Puede existir venta anónima física en efectivo.
- La cuenta del comprador solo se vincula mediante identidad verificada;
  no confiar en un email escrito por un operador para asignar propiedad.

## 13. Impresión

Homologar una impresora térmica de 80 mm con ESC/POS.

Implementar PrinterAdapter:
- BrowserPrintAdapter como alternativa con diálogo de impresión.
- QZTrayAdapter para integración local cuando esté configurada.

No prometer compatibilidad universal.
Documentar instalación, driver, firma y condiciones de uso de QZ Tray.

La plantilla debe incluir QR con margen blanco, contraste y tamaño
probados en papel real con el EDA51.

Registrar solicitud y resultado de impresión.
Distinguir trabajo enviado de impresión física confirmada cuando
el dispositivo no permita verificarlo.

Un fallo de impresión no duplica ni cancela la venta.
Permitir reimprimir con permisos y auditoría.

“qSerial” fue un typo del usuario: se refería al serial de la boleta.
No buscar ni integrar un producto llamado qSerial.

## 14. Acceso con Honeywell EDA51

Crear una pantalla web ligera para el navegador del EDA51.

Primera integración:
- Lector configurado como entrada de teclado.
- Campo preparado para recibir el QR.
- Soporte del sufijo Enter si está configurado.
- Recuperar foco después de cada lectura.
- Botones grandes y respuesta visual clara.
- Evitar funciones incompatibles con el navegador real del equipo.

Verificar esta integración con hardware; no asumir que está configurada.

El operador inicia sesión y selecciona un evento autorizado.
Mantener el evento activo visible para evitar confusiones.

Resultados:
- accepted
- already_used
- cancelled
- wrong_event
- outside_admission_window
- unknown_ticket
- unauthorized

Las excepciones de red o servidor deben mostrarse como error:
nunca como ingreso aprobado.

Validar y marcar utilizada en una sola transacción.
Dos escaneos simultáneos deben producir una sola aceptación.

Usar request_id idempotente por intento.
Si la respuesta se pierde después de registrar el ingreso, un reintento
del mismo request_id debe devolver su resultado original.

Registrar operador, evento, dispositivo configurado, puerta y hora.
El identificador de dispositivo ayuda a auditoría; no sustituye
autenticación ni permisos.

No habilitar ingreso offline en el MVP.
No almacenar un listado local para aprobar sin conexión.
Documentar conexión de respaldo y contingencia supervisada.

Consulta manual:
- Buscar por número o serial con permisos.
- Confirmación explícita para ingreso manual.
- Aplicar la misma transacción y reglas del escaneo.
- Auditar el motivo.

## 15. Dashboards y caja

Dashboard del organizador:
- Consolidado de todas sus fiestas.
- Filtros por evento y periodo.
- Boletas vendidas, cortesías y disponibilidad.
- Reservas pendientes.
- Ventas confirmadas.
- Cobros por medio de pago.
- Ventas por fase, localidad y canal.
- Ventas por operador.
- Ingresos registrados y porcentaje de asistencia.
- Rechazos y duplicados.
- Anulaciones, devoluciones e incidencias.

Dashboard global:
- Los mismos indicadores.
- Administración de usuarios y configuración.
- Alertas operativas.

No llamar “dinero recibido en banco” a ventas o pagos aprobados.
Diferenciar ventas, cobros y conciliación.
Si la comisión real no está disponible, mostrarla como pendiente
o estimada de forma explícita.

Caja:
- Apertura y cierre por operador y evento.
- Fondo inicial.
- Movimientos de efectivo.
- Efectivo esperado y declarado.
- Diferencias y observaciones.
- Separar efectivo de transferencias y pagos online.

CSV:
- Ventas.
- Asistentes.
- Cierres de caja.
- Pagos pendientes e incidencias.

Proteger exportaciones y prevenir fórmulas maliciosas en CSV.

## 16. Pantallas y rutas sugeridas

Públicas:
- /events
- /events/[slug]

Comprador:
- /login
- /account
- /account/tickets
- /account/orders/[id]

Administración:
- /admin
- /admin/events
- /admin/events/new
- /admin/events/[id]
- /admin/events/[id]/pricing
- /admin/events/[id]/orders
- /admin/events/[id]/staff
- /admin/reports
- /admin/users

Operación:
- /box-office
- /box-office/cash-session
- /access

Pagos:
- /checkout/[orderId]
- /checkout/result
- /api/webhooks/wompi

La pantalla de retorno debe consultar el estado real de la orden.
Si está pendiente, mostrarlo sin emitir una confirmación falsa.

## 17. Seguridad y operación

- RLS en tablas expuestas.
- Autorización explícita en rutas y funciones.
- Validación de datos de entrada.
- Protección CSRF donde corresponda.
- Límites de solicitudes en operaciones sensibles.
- Secretos exclusivamente en servidor.
- No registrar QR, contraseñas o datos financieros sensibles.
- Auditoría sin edición desde la aplicación.
- No borrar registros financieros para “corregir” ventas.
- Copias de seguridad y recuperación documentadas.
- Separar ambientes de desarrollo y producción.
- Aviso de privacidad y condiciones de compra configurables.
- Diferenciar ticket de acceso de documento fiscal.
- No inventar requisitos tributarios; dejar la definición fiscal
  pendiente de confirmación del cliente y su contador.

## 18. Plan de implementación

Entrega 1: base
- Inicializar proyecto.
- Configurar Supabase local.
- Migraciones, RLS y datos ficticios.
- Login y roles.
- Administración de varias fiestas y localidades.
- README con instalación.

Entrega 2: primer flujo completo
- Venta presencial.
- Cupos y precios.
- Cobro registrado.
- Emisión con consecutivo, serial y QR.
- Boleta descargable.
- Validación online.
- Impresión mediante diálogo y adaptador preparado para QZ Tray.

Entrega 3: venta online
- Cuenta de comprador.
- Reserva y checkout.
- Wompi sandbox.
- Webhooks verificados.
- Mis entradas.
- Email y reintentos.
- WhatsApp manual.

Entrega 4: operación
- Dashboard.
- Caja.
- CSV.
- Anulaciones.
- Registro de devoluciones.
- Auditoría e incidencias.

Entrega 5: lanzamiento
- Prueba con impresora real.
- Prueba con EDA51 real.
- Pruebas concurrentes.
- Ensayo con organizador y operadores.
- Documentación de operación y recuperación.

No esperar credenciales externas para construir la base.
Crear adaptadores de desarrollo claramente identificados.
Nunca habilitar pagos simulados o verificaciones ficticias en producción.

## 19. Pruebas obligatorias

Probar al menos:
- Separación entre dos fiestas.
- Permisos de comprador, taquilla y acceso.
- Restricciones RLS.
- Precio vigente por fase y canal.
- Conservación del precio en órdenes anteriores.
- Reservas y ventas concurrentes sin sobreventa.
- Confirmación simultánea con vencimiento de reserva.
- Pago tardío sin cupo.
- Webhook duplicado y fuera de orden.
- Una orden con varias entradas.
- Reimpresión sin duplicación.
- Sustitución que invalida el QR anterior.
- Dos lectores intentando usar el mismo QR.
- Reintento tras respuesta perdida del check-in.
- Entrada anulada o de otro evento.
- Fallo de email sin pérdida de la venta.
- Cierre de caja consistente.

Ejecutar lint, comprobación de tipos, pruebas relevantes y build.
No marcar una prueba de hardware como aprobada sin ejecutarla.

Objetivo inicial propuesto de rendimiento:
respuesta de acceso en menos de dos segundos en una red estable.
Medirlo con dispositivos y carga representativa; no asumirlo cumplido.

## 20. Entregables del repositorio

- Código de la aplicación.
- AGENTS.md.
- README.md.
- .env.example sin secretos.
- Lockfile.
- supabase/migrations/.
- Seed de desarrollo.
- Pruebas de flujos críticos.
- docs/DECISIONS.md.
- docs/PROGRESS.md.
- docs/OPERATIONS.md.
- docs/LAUNCH_CHECKLIST.md.

README debe explicar:
- Requisitos.
- Instalación.
- Variables de entorno.
- Base de datos local.
- Migraciones y seed.
- Bootstrap administrativo.
- Ejecución.
- Pruebas.
- Configuración de Wompi sandbox.
- Configuración de email.
- Configuración y prueba de impresión.
- Preparación del EDA51.

Si faltan servicios externos, indicar qué funciona localmente y
qué requiere sus credenciales.

## 21. Información pendiente del cliente

- Fecha y aforo del primer evento.
- Nombre comercial y diseño.
- Tipos de entrada y precios.
- Cuenta comercial de Wompi.
- Modelo de impresora y sistema operativo de taquilla.
- Versión de Android y navegador del EDA51.
- Cantidad de taquillas, lectores y puertas.
- Conectividad del recinto.
- Dominio y remitente de email.
- Categorías de comprador.
- Condiciones de cancelación y devoluciones.
- Definición fiscal.

Estas preguntas no bloquean iniciar el proyecto.
Usar configuración y datos ficticios claramente identificados
hasta contar con respuestas.

## 22. Primera instrucción de ejecución

Comenzar con la Entrega 1 y continuar con la Entrega 2.

Primero inspeccionar el repositorio, definir un plan corto e implementar.

Prioridad:
tener un flujo local ejecutable donde el organizador crea dos fiestas,
taquilla vende una entrada, el sistema genera su serial y QR, y acceso
la valida una sola vez con datos persistentes.

No detenerse en una propuesta, maqueta o listado de tareas.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Visualización de Análisis y Vista general: `src/components/analytics-charts.tsx`, `analytics.tsx` y estilos en globals.css; tortas/línea/barras, indicadores por significado y tablas desplegables. Uso, colores, pruebas y límites: `docs/ANALYTICS_VISUALS.md` (2026-10-14).

## 23. Índice de implementación del MVP (2026-10-11)

Continuidad de invitación después de registro/confirmación (2026-10-14): pendiente propia por identidad verificada en servidor, callback/login retoman /invite, aviso en Mi perfil y aceptación explícita por ID sin token local. No concede roles al registrar ni requiere cuenta nueva. Código invitations.ts/state.ts/auth/confirm/api/auth/account.tsx/app.tsx; guía docs/INVITATION_ONBOARDING.md.

Equipo ampliado (2026-10-14): invitación de cajero con Incluir acceso y edición transaccional de permisos por usuario/evento por gestores autorizados; global controla nombre/rol global con último admin protegido. Código team-editor.tsx/team.ts/invitations.ts, migración 009; guía docs/TEAM_PERMISSIONS.md. No cambia roles existentes al migrar.

La guía original se conserva en AGENTS.md.txt como referencia histórica. Este AGENTS.md es la fuente activa de alcance.

- Instalación, variables, versiones y acceso a Supabase/Wompi/email: README.md.
- Decisiones, seguridad, transacciones y límites del adaptador demo: docs/DECISIONS.md.
- Avances, pruebas ejecutadas y pendientes: docs/PROGRESS.md.
- Mapa de rutas y funciones, impresión, EDA51, operación y recuperación: docs/OPERATIONS.md.
- Requisitos externos antes del primer evento real: docs/LAUNCH_CHECKLIST.md.
- UI: src/components/app.tsx, operations.tsx y buyer.tsx; rutas App Router en src/app/.
- Reglas y transacciones: src/lib/service.ts y db.ts; entrada Zod en validation.ts.
- Migraciones/RLS: supabase/migrations/; bootstrap privado: scripts/bootstrap.ts.
- Pruebas: tests/service.test.ts y tests/e2e/flows.spec.ts; CI: .github/workflows/ci.yml.

Después de cada cambio documentar dónde quedó la función, cómo accederla, librerías o servicios usados, pasos de ejecución/prueba, resultados, límites y commit. No guardar secretos, QR, enlaces de entrega ni datos personales.

El software funciona con PostgreSQL embebido persistente en desarrollo. La demo está prohibida en producción. El lanzamiento comercial requiere credenciales, pruebas Supabase/Wompi/email, impresora/EDA51 y ensayo; no marcar esos pendientes como verificados por una prueba local.
- Configuración de cuentas y datos necesarios para demo conectada: docs/SERVICE_SETUP.md (2026-10-12).
- Conexión Supabase con TLS, pruebas SQL concurrentes, Vercel staging publicado, Auth y webhook Wompi sandbox: docs/CLOUD_SETUP_2026-10-13.md (2026-10-13). Dominio de ensayo: https://pasecentral-demo.vercel.app; email y hardware pendientes.
- Conexión real Supabase/Wompi/Vercel, certificado TLS y ensayo multiconexión: docs/CLOUD_SETUP_2026-10-13.md.
- Resend, DNS HostGator, SMTP Auth, claves de boletas y scheduler: docs/EMAIL_SETUP_2026-10-13.md; configuración repetible: scripts/configure-email-worker.ts.
- Ensayo de comprador, taquilla, caja, Wompi sandbox, impresión y lector Honeywell: docs/TEST_REHEARSAL.md (2026-10-13); hardware y checkout completo siguen pendientes de ejecución.
- Cambio autorizado por el propietario (2026-10-13): `/access` identifica evento por QR sin selector y valida automáticamente; botón manual opcional, aviso de resultado/evento, permisos por evento y sin ingreso offline. Decisión y prueba: docs/DECISIONS.md y docs/OPERATIONS.md.
- Correo con QR incrustados y PDF individual: src/lib/ticket-email.ts, delivery.ts y migración 003; compartir PDF mediante Web Share/fallback en buyer.tsx. WhatsApp automático aplazado por el propietario el 2026-10-13. Guía: docs/OPERATIONS.md.
- Mi perfil, fotos privadas e invitaciones de admin con rol/varios eventos: src/components/account.tsx, src/lib/invitations.ts y avatar.ts, /api/profile/avatar, migración 004. Guía y configuración: docs/PROFILE_TEAM_SETUP.md. Invitado acepta desde cuenta con correo confirmado; organizador por evento no obtiene membresía global.
- Edición de eventos/localidades agotadas y galería con portada: src/components/event-editing.tsx, comandos de service.ts, rutas /api/events/[eventId]/images y /api/event-images/[imageId], migración 005 y Storage privado event-images. Operación, pruebas y límites: docs/EVENT_EDITING.md.
- Invitaciones exclusivas para trabajadores (corrección del propietario 2026-10-13): comprador se registra libremente, no es rol invitable. Roles invitados: administrador, organizador por evento, Cajero / taquilla y acceso. Migración 006 revoca pendientes antiguas de comprador y bloquea nuevas. Guía: docs/PROFILE_TEAM_SETUP.md.
- Limpieza privada de fixtures autorizada por el propietario (2026-10-13): scripts/reset-test-data.ts y src/lib/test-reset.ts; staging/sandbox, lista exacta de eventos DEMO, respaldo cifrado obligatorio y preservación de cuentas/invitaciones. Sin endpoint público ni ejecución automática. Guía: docs/TEST_DATA_RESET.md.
- Definiciones de auditoría dentro de Reportes → Auditoría de operaciones → Guía de códigos de operación: src/lib/audit-labels.ts (catálogo), src/components/audit-guide.tsx y operations.tsx. Nombres en español, búsqueda y código original conservado; no crea registros. Guía: docs/AUDIT_GUIDE.md.
- Analítica ampliada en Vista general y Análisis/reportes: src/components/analytics.tsx, src/lib/analytics.ts y /api/analytics; comparación de eventos/años, fases/localidades, canales/operadores, ventas/cobros/devoluciones y audiencia opcional por entrada. Migración 007 y captura attendee-fields.tsx en web/taquilla; datos individuales privados, no inferir demografía histórica. Guía y definiciones: docs/ANALYTICS.md.
- Ampliación explícita del propietario 2026-10-14 (prevalece sobre exclusiones originales): organizaciones administrables, registro/perfil con género y edad opcional/condiciones, eliminar cuenta propia, regalar/transferir entradas con aceptación y retorno a 7 días; QR renovados y permisos/RLS revocados. Apertura horaria en día de inicio, cierre al día siguiente permitido, edad mínima editable 18 por defecto, canales Ambos y edición de fase/COP formateado. Correo Auth en español y callback al perfil, menú contextual desactivado sin prometer impedir inspección. Migración 008 y guía: docs/ACCOUNTS_TICKETS_2026-10-14.md.

- Papel seleccionable en entradas (2026-11-18): src/components/print-options.tsx, src/lib/print-settings.ts y ticket-zpl.ts; recibo80 ESC/POS, STARPOS70x40/70x100 ZPL y plantillas navegador, ajustes por navegador. Guia docs/PRINT_PAPER_SETTINGS.md e historial fisico docs/PRINTER_STAR_IF42.md. TEST-013 alineado segun propietario; formato grande y flujo QZ completo requieren ensayo fisico.

- Aforo/horarios opcionales (2026-11-19): EventCapacity/EventSchedule en enhanced-fields.tsx, migración010, validación/stock/acceso/reportes con NULL. Aforo ilimitado conserva cupos de localidad; apertura igual a inicio, fin/cierre opcionales con campos ocultos. Guía y pruebas: docs/EVENT_OPTIONS.md. Código solo local; migración aplicada a Supabase staging compartido.

- Enlace del evento, alias /eventos, miniaturas al seleccionar archivos y localidades ilimitadas bajo evento ilimitado (2026-11-19): operations.tsx, app.tsx, EventDetails/EditTicketType, TicketCapacity, service/validation y migracion011. Guia docs/EVENT_OPTIONS.md; codigo solo local, SQL staging aplicado con respaldo.

- Organización visual global (2026-11-19): estilos compartidos de formularios/tablas/acciones, horarios agrupados y edición modal de localidad. Mapa y verificación: docs/UI_LAYOUT.md.

- Fases de precio hasta el final del evento (2026-11-19): PhaseEnd en enhanced-fields.tsx, alta/edición de fase, state/service y migración012. Interruptor oculta final manual; final dinámico o cierre manual si evento sin fin. Guía docs/EVENT_OPTIONS.md. Código local; SQL staging aplicado con respaldo sin cambiar fases existentes.

- Apertura de caja desde Taquilla (2026-11-19): botón Abrir caja en Cobro y emisión, diálogo nativo cash-opening.tsx con fondo inicial y confirmación; conserva venta en preparación y reutiliza cash_open. Guía docs/OPERATIONS.md. Solo local.

- Segunda revisión UI global (2026-11-19): organizaciones en ticket-wallet.tsx, catálogo/búsqueda/ruta activa en app.tsx, paleta de botones y distribución compartida en globals.css; 12 pantallas con capturas escritorio/móvil. Guía docs/UI_LAYOUT.md. Solo local.

- Administradores actuales por organización (2026-11-19): nombres y correos en tarjetas /admin/organizations, Organizations en ticket-wallet.tsx; solo membresías actuales, sin designar principal ni cambiar permisos. Guía docs/UI_LAYOUT.md.

- Navegación/performance (2026-11-19): App persistente en src/app/(platform)/layout.tsx y catch-all del grupo, next/link, actualización de estado en segundo plano y consultas state por lotes. URLs intactas. Diagnóstico, tiempos medidos, pruebas y límites: docs/NAVIGATION_PERFORMANCE.md. Solo local, sin migración.

- Boleta doble en revisión (2026-11-19): propuesta docs/design/boleta-doble-v1.html/png, dos tramos70x40 por entrada con perforación intermedia, mismo QR y copia comprador/control. Alcance e integración pendiente: docs/design/BOLETA_DOBLE.md. Aún no modifica plantilla activa ni imprime.
- Corrección boleta doble (2026-11-19): propuesta02 vigente docs/design/boleta-doble-v2.html/png; QR solo en talón superior de acceso, recuerdo con datos del evento abajo sin QR. Misma entrada y consecutivo/serial en ambas partes; aún en revisión visual, sin imprimir ni modificar app.
- Boleta doble propuesta03 (2026-11-19): logo de evento junto al QR superior, recuerdo abajo; artefactos docs/design/boleta-doble-v3.html/png y logo Retrofest B/N. Campo Logo para boletas administrable por gestor de evento queda pendiente de integración. Guía docs/design/BOLETA_DOBLE.md.
- Boleta doble propuesta04 (2026-11-19): QR/equipos de sonido del afiche arriba, logo/datos en recuerdo abajo y mensaje ¡A LA CALLE CON TODO!; sin Retener al ingresar. Artefactos docs/design/boleta-doble-v4.html/png. Diseño aún en revisión, sin impresión o integración activa.
- Boleta doble propuesta05 (2026-11-19): talón superior con QR, localidad/fase, precio grande y ubicación para contar por valor; logo/equipos en recuerdo inferior. docs/design/boleta-doble-v5.html/png; precio histórico de venta al implementar. Solo propuesta visual, sin imprimir.
- Boleta doble propuesta06 (2026-11-19): sin etiqueta Recuerdo del comprador, composición superpuesta logo/equipos abajo, QR/precio arriba. Artefactos docs/design/boleta-doble-v6.html/png y retrofest-composicion-bw-v1.png; continúa revisión visual sin imprimir.

- Boleta doble integrada (2026-11-19): render común ticket-layout.ts, PDF y API tickets, PaperTickets en pantalla/browser, ZPL GFA doble y raster ESC/POS; default70x40 dos tramos, precio histórico. Arte/frase administrables en TicketArtEditor y API /api/events/[eventId]/ticket-art, migración013 privada. Guía docs/TICKET_DOUBLE_LAYOUT.md. Arte Retrofest aprobado configurado en su evento; código solo local, sin imprimir.

- Confirmación de impresión corregida (2026-11-19): navegador no marca submitted al regresar de window.print, pide confirmar papel o No se imprimió / cancelé; QZ mantiene transporte separado de resultado físico. Tickets en buyer.tsx, guía docs/TICKET_DOUBLE_LAYOUT.md. Sin cambios de schema o impresora.

- Apertura de impresión optimizada (2026-11-19): registro atómico print_batch_request en service.ts/validation.ts, una solicitud desde buyer.tsx y sin refresh global en app.tsx para comandos de impresión. Auditoría y permisos conservados; guía TICKET_DOUBLE_LAYOUT.md.

- Diagnóstico de corte/perforación desde Chrome (2026-11-19): guía PRINTER_STAR_IF42.md; preferencias del usuario70x40conSensor de marcas y origen0, CSS aplica desplazamiento. PrintOptions advierte configuración independiente Windows/QZ; E2E verifica paginación PDF de Chromium, alineación física nueva pendiente.

- Perfil físico TEST-019 aprobado por propietario (2026-11-19): doble70x40, oscuridad26/50.8mm/s/marcaoffset0/+4mm. Defaultsrc/lib/print-settings.ts y preferenciasv3 que actualizan16antiguo del papelpequeño conservando demás ajustes. Guías PRINT_PAPER_SETTINGS.md/PRINTER_STAR_IF42.md; QZ/Chrome aún requieren prueba propia.

- Seleccionar boletas para impresión y consecutivo destacado (2026-11-20): buyer.tsx/print-options.tsx, helper ticket-number.ts, encabezado ticket-layout.ts y secuencia existente devuelta en ticketDocument. Guía docs/TICKET_SELECTION.md, pruebas y límites físicos; sin nuevo contador o migración.

- Boletas preimpresas activadas al vender (2026-11-20): /box-office/preprints, src/components/preprints.tsx y src/lib/preprints.ts, API /api/preprints y migración014. Lote reserva cupos/consecutivos sin venta, precio congelado, impresión privada, asignación y bloqueo; activación con pago/caja mantiene QR y acceso consume una sola vez. SQL/RLS/idempotencia y guía docs/PREPRINTED_TICKETS.md. Código local; migración staging respaldada sin alterar filas existentes o crear fixtures.

- Desactivar/eliminar preimpresas (2026-11-20): src/components/preprint-actions.tsx, controles en documento buyer.tsx/PaperTickets e inventario preprints.tsx. Comando preprint_delete y migración015: elimina solo sin venta, preserva impresión/auditoría y nunca recicla números; solicitudes eliminadas no recrean lotes. Guía docs/PREPRINTED_TICKETS.md. Schema staging respaldado, sin borrar/desactivar lotes existentes; código local.

- Scheduler de avisos de regalo corregido (2026-11-20): src/lib/delivery-scheduler.ts, scripts/configure-email-worker.ts y tests/delivery-scheduler.test.ts incluyen account_notifications. Cron existente actualizado con permiso y respaldo;2avisosaceptadosporproveedor/sinduplicarentradas. Guía docs/EMAIL_SETUP_2026-10-13.md. Código local pendiente de nuevo envío a Git.
- Claridad de registro con correo existente: `src/app/api/auth/route.ts` y `Login` en `src/components/app.tsx`; respuesta neutra sin afirmar alta, opciones de inicio/recuperación y normalización de correo. Pruebas y límites en `docs/SIGNUP_CLARITY.md` (2026-11-20).
- Revisión integral de correos y PDF doble (2026-11-20): `docs/EMAIL_FLOW_VERIFICATION.md`, `tests/email-flows.test.ts`; entrega al titular usa `ticketDocument` con alcance exclusivo de propiedad para no adjuntar entradas ajenas aunque sea administrador. PDF individual de 70×80 con dos segmentos; registro directo en avisos de cuenta. Pruebas, diagnóstico remoto de solo lectura y límites en la guía.
- Texto de boletas sin dependencia de fuentes del servidor (2026-11-20): `src/lib/ticket-font.ts` convierte Noto Sans incluida en `assets/fonts/` a trazos con opentype.js antes de Sharp; tracing explícito en next.config.ts. Guía `docs/TICKET_FONT_RENDERING.md` con incidente de cuadrados en Vercel y pruebas.
- Preparación Wompi live (2026-11-26): ruta local `/api/webhooks/wompi/production` reutiliza procesador firmado con guardia de entorno; guía `docs/WOMPI_CUTOVER_2026-11-26.md`. Comercio aprobado observado en Chrome; hosting comercial, modelo de recaudo y corte de datos pendientes de decisión. No equivale a activación real.
- URL pública sin demo (2026-11-26): alias `pasecentral.vercel.app` agregado en Vercel; migración completa de APP_URL/Auth/worker/webhooks pendiente de sesión Supabase. Estado y continuidad: `docs/URL_CHANGE_2026-11-26.md`; conservar alias anterior hasta completar transición.

- Base separada de producción preparada (2026-11-26):15migraciones sin seed, TLS y33tablas RLS; Auth/SMTP y13plantillas españolas guardadas. Variables LIVE reservadas en Vercel, sin corte ni cobros. Estado actual y continuidad del administrador: docs/PRODUCTION_DATABASE_2026-11-26.md; prevalece como estado posterior a las notas de preparación anteriores.
