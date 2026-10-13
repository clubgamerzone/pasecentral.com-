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

## 23. Índice de implementación del MVP (2026-10-11)

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
