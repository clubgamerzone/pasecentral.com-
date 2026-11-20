# Verificación de correos y adjuntos — 2026-11-20

## Flujo esperado

| Origen | Destinatario y contenido | Momento |
| --- | --- | --- |
| Registro | Supabase Auth: confirmación en español, callback propio al perfil o invitación pendiente | Alta que requiere confirmación; no afirmar cuenta nueva ante respuesta neutra de correo existente |
| Recuperación | Supabase Auth: enlace al callback de recuperación y luego formulario de nueva contraseña | Solicitud aceptada por Auth; no modifica contraseña sin completar recuperación |
| Invitación de personal | Cola `team_invitations`: rol, eventos, incluir acceso si aplica y enlace privado de aceptación | Worker, sin conceder rol por enviar/registrarse |
| Compra online aprobada | Cola `delivery_jobs`: un PDF individual y QR CID por entrada al correo verificado del comprador | Tras pago verificado y emisión transaccional; nunca por retorno del checkout |
| Venta presencial con contacto | Misma cola y adjuntos al contacto solicitado | Tras cobro autorizado; venta física anónima sin email no solicita entrega digital |
| Compra para regalo | `account_notifications`: aviso de aceptación al destinatario y confirmación al comprador | Tras pago aprobado, sin adjuntar QR mientras está pendiente |
| Regalo o transferencia aceptada | `delivery_jobs` al titular receptor, con sus PDF/QR; aviso de aceptación al remitente | Tras aceptar con cuenta/correo verificados; renueva credencial |
| Rechazo/cancelación/vencimiento | Aviso de retorno al remitente; entradas con QR renovado disponibles en Mis entradas | Al resolver la transferencia |
| Reintento de entrega | Mismo snapshot cifrado y clave de idempotencia del trabajo | Backoff de la cola; no reemite entradas ni cambia identificadores |

El envío de un regalo no crea una cuenta ni envía un correo de registro automáticamente. El destinatario se registra si lo necesita, confirma su correo y acepta en Mis entradas. El enlace de creación de cuenta del aviso apunta ahora a `/login?register=1`.

## Plantilla PDF comprobada

`src/lib/ticket-email.ts` llama a `ticketPdf` para cada entrada individual. `src/lib/pdf.ts` genera una página de 70 × 80 mm con `renderTicketLayout` de `src/lib/ticket-layout.ts`: dos segmentos de 70 × 40, QR/consecutivo/precio/localidad/control arriba; logo del evento si se configuró, fecha, hora y dirección abajo. Comparte render con pantalla/impresión. No se cambió el diseño ni la configuración física aprobada.

Se generó un adjunto ficticio mediante el mismo `ticketEmail`, se abrió con pdf-lib (1 página, 70 × 80) y se renderizó con Poppler `pdftoppm` para revisión visual. Evidencia privada de desarrollo: `.local/verification/email-presentation/`; solo contiene fixture, sin entradas válidas ni datos personales. Las pruebas existentes de arte por evento y selección de impresión también pasaron. Los trabajos que ya iniciaron envío conservan su snapshot para que un reintento respete la idempotencia del proveedor; no se reescriben correos ya enviados.

## Correcciones de esta entrega

- Registro neutro con inicio/recuperación: `docs/SIGNUP_CLARITY.md`.
- El programador incluye las tres colas mediante `src/lib/delivery-scheduler.ts` y `scripts/configure-email-worker.ts`; la corrección remota ya autorizada está activa. Guía `EMAIL_SETUP_2026-10-13.md`.
- `ticketDocument(..., ownerOnly=true)` en `service.ts` se usa para entrega a un titular desde `delivery.ts`. Impide que sus permisos adicionales de administrador/taquilla amplíen los adjuntos a otras entradas de la orden. La vista administrativa mantiene su alcance habitual.
- `account-notifications.ts` lleva directamente al formulario de registro cuando hace falta una cuenta.

## Pruebas y evidencia

`tests/email-flows.test.ts` ejecuta compras, cobros, emisión, colas y worker contra PostgreSQL embebido; intercepta solamente HTTP de Resend, sin correos reales. Cubre compra múltiple, siguiente ciclo sin duplicación, taquilla, invitación, regalo sin adjuntos antes de aceptar, PDF después de aceptar y transferencia parcial a un administrador sin adjuntos ajenos. Comprueba un PDF de 70 × 80 y QR CID por entrada. Las pruebas de servicio conservan cobertura de error/reintento, snapshot cifrado y venta intacta; Auth comprueba callbacks y mensajes neutros.

Resultado conjunto: 134 pruebas Vitest en 13 archivos, 27 Playwright, lint, comprobación de tipos, build y diff-check aprobados. No se hicieron nuevas compras ni correos reales para esta revisión. Inspección remota de solo lectura: cron activo cada minuto, las tres colas incluidas, sin pendientes/fallidos y respuesta reciente de worker HTTP 200.

Las plantillas Auth en español se comprobaron en código y sus callbacks mediante pruebas; no se volvió a guardar SMTP/plantillas en el panel ni se provocó una nueva recuperación/alta real. Una respuesta `sent` de cola acredita aceptación por el proveedor, no llegada a inbox, apertura ni ausencia de spam. No se certifica hardware por pruebas de correo. Publicación en GitHub y referencia de commit se registran en PROGRESS.md después del envío autorizado.
