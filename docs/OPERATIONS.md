# Operación y dónde encontrar cada función

## Rutas

| Tarea                                | Pantalla                                               | Implementación                                                          |
| ------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Iniciar sesión / cuenta compradora   | `/login`                                               | `src/lib/auth.ts`, `src/app/api/auth/route.ts`, `components/app.tsx`    |
| Catálogo / detalle                   | `/events`, `/events/[slug]`                            | `Catalog`, `EventPurchase`                                              |
| Crear y publicar fiestas             | `/admin/events/new`, `/admin/events/[id]`              | `EventEditor`, comandos `create_event`, `event_status`                  |
| General/VIP y fases                  | `/admin/events/[id]/pricing`                           | `add_type`, `add_phase`, `phase_active`, trigger SQL                    |
| Personal por evento                  | `/admin/events/[id]/staff`, `/admin/users`             | `UserManagement`, comandos `staff`, `member`                            |
| Venta física                         | `/box-office`                                          | `BoxOffice`, `createOrder`, `issue` en `src/lib/service.ts`             |
| Caja                                 | `/box-office/cash-session`                             | `cash_open`, `cash_move`, `cash_close`                                  |
| Reserva y checkout                   | `/checkout/[orderId]`, `/checkout/result`              | `Checkout`, `src/lib/wompi.ts`, `settle`                                |
| Mis entradas / órdenes               | `/account`, `/account/tickets`, `/account/orders/[id]` | `Orders`, `state.ts`                                                    |
| PDF, QR y compartir                  | `/tickets/[orderId]` con fragmento secreto opcional    | `ticketDocument`, `api/tickets`, `pdf.ts`, `Tickets`                    |
| Acceso online                        | `/access`                                              | `Access`, `checkin`, `check_in_attempts`                                |
| Anulación / sustitución / devolución | `/admin/events/[id]/orders`                            | `cancel_ticket`, `replace_ticket`, `refund`                             |
| Dashboard / CSV / auditoría          | `/admin`, `/admin/reports`                             | `Dashboard`, `Reports`, `api/reports`, `csv.ts`                         |
| Email                                | emisión → cola, reenvío en órdenes                     | `src/lib/delivery.ts`, `scripts/delivery.ts`, `/api/worker`             |
| QZ Tray                              | boletas → impresión                                    | `src/lib/printer.ts`, `/api/printing/certificate`, `/api/printing/sign` |

Los componentes están bajo `src/components/`. Para buscar una regla concreta usa `rg "case \"nombre_del_comando\"" src/lib/service.ts`. Los comandos sensibles se validan en `src/lib/validation.ts`. El mapa es permanente para futuras conversaciones.

## Antes de abrir puertas

Confirma evento, horario de ingreso en Bogotá, localidad, precios, operadores asignados, aforo y red. Taquilla abre su caja con fondo contado. Acceso inicia sesión y configura etiqueta de puerta/dispositivo. En `/access` el QR identifica el evento en servidor; no hay selección manual. El operador solo admite eventos para los que tiene permiso. Si tiene varias asignaciones, puede admitir entradas de cualquiera de ellas: organizar las asignaciones según la puerta y revisar el evento mostrado en el resultado.

El Honeywell EDA51 debe escribir el QR en el campo enfocado como teclado. La lectura se envía automáticamente tras 350 ms sin cambios; Enter también envía, con protección frente a doble envío. El botón Validar entrada queda como alternativa y reintento. El aviso verde/rojo muestra resultado y evento autorizado, desaparece tras 2,5 segundos y conserva un resultado en pantalla. No exige cerrar el aviso para la siguiente lectura. El foco vuelve después de cada lectura. Verificar Wedge en el dispositivo real: la implementación web no configura el hardware. Lecturas vacías no autorizan nada.

Colores y texto deben coincidir: solo **Ingreso autorizado** permite paso. QR desconocido, entrada usada/anulada, horario cerrado, operador no autorizado o fallo de red deniegan ingreso. El resultado anterior se retira al empezar una lectura nueva para no confundirlo con una autorización pendiente. La consulta por serial no reemplaza el secreto: **Ingreso manual** solicita motivo y confirmación explícita, usa las mismas reglas y audita; busca en los eventos autorizados y usa el evento propio de la entrada.

Si se pierde una respuesta, vuelve a intentar la misma lectura sin cambiar el QR: se conserva `request_id`. Si se refresca completamente la página, se pierde ese UUID; el historial y el estado de entrada permiten supervisar la incidencia. No hay reingreso automático.

## Red y contingencia

Prueba Wi-Fi/datos de respaldo en cada puerta, cuenta del supervisor y dispositivo de reemplazo antes del evento. Sin conexión la pantalla muestra error y **no aprueba offline**. Suspende la fila, restablece red y consulta al supervisor; no uses una lista local para aprobar entradas sin sincronización. Un procedimiento excepcional fuera del sistema debe ser definido y supervisado por el organizador, con conciliación posterior y sin presentar el estado offline como autorización del sistema.

## Caja y cobros

Cada caja pertenece a evento y operador. Efectivo esperado = fondo + ventas en efectivo + entradas manuales − salidas − devoluciones de efectivo. Transferencia y Wompi se reportan por separado, sin sumarse a billetes esperados. El cierre guarda declarado, esperado, diferencia y observaciones.

No corregir ventas borrando filas. Anula entradas con motivo o registra devolución externa. Para reembolso efectivo con caja original cerrada, abre caja del responsable autorizado para ese evento. La devolución no cambia el cierre anterior. El MVP no integra conciliación bancaria: cobros aprobados no equivalen a saldo recibido en banco.

## Pago tardío e incidencias

`needs_review` indica pago aprobado sin entradas válidas, por cupo o estado del evento. Confirma referencia en Wompi y resuelve devolución manual; selecciona cero boletas si nunca se emitieron. Registra importe/ref. bancaria y razón. No emitir nuevas entradas encima del aforo. Si Wompi reporta VOIDED o devolución después de aprobación, revisar y registrar resolución manual; no asumir que un webhook revierte una entrada ya entregada.

Reserva vencida libera disponibilidad por consulta SQL, aunque la orden aún pueda verse pendiente hasta otra mutación. La pantalla de checkout muestra vencimiento y no ofrece pago si venció. Nunca confirmar por parámetros `id`, `status` o `transaction` de una URL de retorno.

## Emails y enlaces

El cron/worker es obligatorio en el hosting. Las ventas no dependen de que Resend responda. En reportes/órdenes revisa fallos; corrige remitente/dominio/clave y reintenta email. El reenvío genera trabajo nuevo, no QR nuevos. Revocar enlace invalida únicamente el acceso por el enlace anterior; sustitución de QR es una operación distinta y auditada.

El correo incluye cada QR incrustado mediante CID y un PDF individual por entrada; conserva el enlace protegido para consultar el estado actual. La cola cifra y congela el payload del primer intento, incluidos adjuntos, para reintentar sin cambiar datos bajo la misma clave de idempotencia. `003_email_attachments.sql` restringe lectura de esa columna; no se expone en `/api/state`. No copiar outbox o documentos a issues, chats públicos, Git o logs. Revocar un enlace no borra PDFs recibidos: anular o sustituir la credencial es lo que impide utilizar su QR.

**Compartir PDF por WhatsApp** prepara un documento con todas las entradas (una página por entrada). En un móvil con Web Share de archivos se abre el menú del sistema y el usuario selecciona WhatsApp y destinatario, confirma y envía. La aplicación no puede elegir WhatsApp por el usuario ni comprobar la entrega a su chat. Si el navegador no permite archivos, descarga el PDF y muestra cómo adjuntarlo como Documento en WhatsApp Web. `wa.me` no adjunta archivos locales automáticamente. No compartir PDFs con quienes no deban utilizar las entradas.

El propietario aplazó WhatsApp automático el 2026-10-13: tiene cuenta empresarial Meta pero todavía no WhatsApp Business/remitente configurado. No hay casilla de promesa de envío automático, cola WhatsApp ni mensajes automáticos habilitados. Para activarlo posteriormente se requiere Business Platform/Cloud API, número remitente habilitado, consentimiento del destinatario, plantilla aprobada y verificación de entregas/costos; la app WhatsApp Business por sí sola no integra este backend.

## Impresión

Desde la orden emitida, descarga PDF o imprime con navegador a 80 mm. Verifica escala, cortes, contraste y margen blanco QR en papel. Reimprimir conserva entrada y su estado. Un fallo de papel no duplica ni cancela venta. El navegador solo registra trabajo enviado: cancelación del diálogo puede producir ese estado sin hoja impresa; debe verificarse físicamente.

QZ Tray exige servicio local activo, driver y nombre de impresora homologados, certificado y firma de servidor. El frontend usa ESC/POS con QR y corte; compatibilidad y codificación deben probarse en el modelo real. No hay compatibilidad universal garantizada. Los secretos PEM aceptan saltos de línea reales o `\n` escapados de variables del hosting.

## Privacidad y recuperación

Guardar backups PostgreSQL mediante procedimiento del proveedor; proteger también `TICKET_ENCRYPTION_KEY`. Guardar copias privadas del outbox solo en desarrollo si se necesitan. No subir dumps o secretos al repositorio. Probar restauración en un ambiente aislado antes del evento, manteniendo identidad Supabase y correspondencia de claves. Una restauración antigua puede perder ingresos/pagos recientes: conciliar con proveedor y auditoría antes de reabrir puertas.

Desarrollo PGlite: detener **todos** los procesos que usan la misma carpeta antes de copiar/mover `.local`. Las pruebas Vitest usan memoria; Playwright usa `.local/e2e-*`, nunca la base de trabajo.

Por defecto las vistas detalladas de auditoría y trabajos muestran los registros más recientes; la base conserva el historial. Los reportes del MVP se generan en servidor para eventos administrados y neutralizan fórmulas CSV. Medir crecimiento y paginación/exports antes de volumen comercial grande.

## Documentación de cambios futuros

Después de cada modificación actualizar `docs/PROGRESS.md` y `docs/DECISIONS.md`: función añadida, ubicación, forma de acceder/ejecutar, dependencias/cloud usados, comandos de pruebas y resultados, límites y commit relacionado. Mantener `AGENTS.md` como alcance y primer índice. Nunca documentar secretos ni afirmar pruebas externas no ejecutadas.

# Recuperación de acceso (2026-10-13)

En `/login` usar **Olvidé mi contraseña** → introducir correo → pedir enlace nuevo → abrir el correo en el mismo navegador → elegir y confirmar contraseña de al menos 10 caracteres → iniciar sesión de nuevo. No compartir contraseñas ni enlaces. Si el enlace venció, repetir la solicitud; no reenviar un enlace antiguo. El SMTP predeterminado de Supabase es limitado; configurar SMTP propio para compradores reales. La contraseña de Auth es distinta de PostgreSQL.

Código: `src/components/recovery.tsx`, acciones `forgot`/`reset` en `src/app/api/auth/route.ts`, callback `src/app/auth/confirm/route.ts`; redirect exacto configurado en Authentication → URL Configuration. El propietario realiza los cambios de contraseña. Evidencia y límites en `CLOUD_SETUP_2026-10-13.md`.

Alternativa desde el panel Supabase: Authentication → Users → seleccionar la cuenta → Overview → Reset password → **Send password recovery**. Abrir el correo más reciente, elegir la contraseña en Pase Central y volver a iniciar sesión. El panel observado no ofrece un campo para escribir directamente otra contraseña. No usar Database → Reset database password: esa opción cambia PostgreSQL, no la cuenta de la aplicación.

Los enlaces del dashboard utilizan el flujo implícito y llegan al Site URL con credenciales en el fragmento. `src/components/app.tsx` elimina ese fragmento antes de hacer solicitudes, lo intercambia mediante la acción `recovery` del API Auth y abre `/reset-password` solamente tras verificación de identidad por Supabase. Tokens inválidos no conceden sesión. No guardar ni compartir URLs de recuperación.
## Mi perfil e invitaciones

Menú Mi perfil → `/account/profile`: nombre, teléfono, biografía, foto privada y consulta de permisos para cualquier rol. Equipo y usuarios → `/admin/users`: administrador global invita por correo con rol y varios eventos, consulta estado y puede reenviar/revocar invitaciones pendientes. El invitado crea/inicia su propia cuenta del correo invitado, confirma correo y acepta; no enviar contraseñas al administrador. Guía técnica/operativa y diferencia entre organizador por evento/organización: PROFILE_TEAM_SETUP.md.
# Edición de eventos y contenido

Consultar [EVENT_EDITING.md](EVENT_EDITING.md) para editar datos/aforo desde Eventos → Administrar, modificar localidades agotadas y cargar portada/galería. Requiere rol gestor del evento; cupos no pueden quedar bajo ventas/reservas. PDF ya enviados no se actualizan al cambiar fecha/lugar y no se envía aviso masivo automático.
## Invitar trabajadores

Equipo y usuarios → Invitar a tu equipo: introducir nombre/correo, elegir Cajero / taquilla (por defecto) y marcar uno o varios eventos. También permite administrador global, organizador por evento y acceso. El trabajador crea/inicia su propia cuenta y acepta con correo confirmado. Los compradores se registran normalmente y compran sin invitaciones. Las antiguas invitaciones de comprador pendientes se revocan al aplicar migración 006; no se borran cuentas ni compras. Detalles: PROFILE_TEAM_SETUP.md.
## Reinicio excepcional de ensayos

Guía privada: TEST_DATA_RESET.md. No usar DELETE/TRUNCATE indiscriminado ni reiniciar usuarios; scripts/reset-test-data.ts exige entorno staging/sandbox, lista exacta de todos los eventos DEMO y respaldo cifrado. No corre automáticamente al publicar. Eliminar prueba no activa pagos comerciales. Asignar trabajadores a los eventos nuevos; invitaciones globales/cuentas permanecen.
