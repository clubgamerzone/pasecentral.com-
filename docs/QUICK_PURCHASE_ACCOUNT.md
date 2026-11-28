# Registro rápido durante la compra

Implementación local del 2026-11-27.

## Uso

En `/events/[slug]`, un visitante sin sesión elige cantidades y encuentra «Crear una cuenta rápida» en la misma tarjeta de compra: nombre, correo, contraseña, género (incluye preferencia de no responder), edad opcional y aceptación de condiciones. Reutiliza Supabase Auth y las mismas reglas del registro normal; no crea una identidad aparte ni asigna permisos administrativos. «Ya tengo cuenta» abre login con retorno al evento.

Si Supabase requiere confirmación, se muestra la instrucción de revisar el correo. El enlace de confirmación vuelve al evento con las cantidades elegidas. No reserva inventario ni cobra antes de confirmar identidad: precios y disponibilidad se vuelven a evaluar al continuar. Si el correo ya existe, se conserva la respuesta genérica y se ofrece iniciar sesión; no se reemplaza contraseña ni perfil.

Con sesión iniciada se muestra «Enviaremos tus entradas a ... el correo de tu cuenta», sin input de correo. La reserva envía el correo de actor; el servidor vuelve a imponer la identidad verificada. «Es un regalo» conserva su flujo independiente de destinatario, aceptación y retorno a siete días. El nombre del perfil prellena el comprador. Ningún QR se emite hasta la confirmación del pago.

## Código

- `src/components/purchase-account.tsx`: formulario y resultado de registro en compra.
- `src/components/buyer.tsx`: integración, entrega por correo de cuenta y recuperación de cantidades.
- `src/components/app.tsx`: login prioriza invitaciones y después un retorno de compra permitido; compatibilidad con callback por fragmento.
- `src/app/api/auth/route.ts`: registro admite `next` y lo incorpora al `emailRedirectTo` solo si es una ruta de evento autorizada.
- `src/app/auth/confirm/route.ts`: callback validado prioriza recuperación/invitación y después compra. Enlace inválido no inicia sesión.
- `src/lib/purchase-return.ts`: solo permite ruta local de evento; cantidades UUID/entero1–20 con máximo20 localidades. No transporta precios, email, nombre, contraseña ni tokens en la URL. Servidor recalcula precios, cupo y permisos.
- `globals.css`: separación y botones del registro rápido; reutiliza Field y estilos adaptables.

No hay migración ni biblioteca nueva. La selección no es una reserva y no se almacena ninguna contraseña en almacenamiento del navegador. En modo demo se usan cuentas ficticias, sin registro externo.

## Pruebas y configuración externa

Pruebas de retorno/confirmación en `tests/purchase-return.test.ts`, `tests/auth-recovery.test.ts`; validación de email forzado en `tests/accounts-transfers.test.ts`. Navegador: `tests/e2e/quick-account.spec.ts`, regresión `accounts-transfers`, `inactive-pricing` y `ui-layout`. Se ejecutan contra copia privada sin `.env`, servidor3100/PGlite aislado mediante `.local/playwright-web-regression.config.ts`; el formulario conectado y su respuesta de registro se simulan solo en la prueba, sin crear usuarios ni enviar mensajes externos.

Supabase debe permitir el origen/callback configurado en APP_URL, y su plantilla debe respetar la URL de redirección proporcionada por Auth. La recepción de un correo real y su enlace en otro dispositivo requieren ensayo conectado autorizado; las pruebas locales no demuestran esa entrega. Si abre login, el comprador puede usar el enlace «Ya tengo cuenta» que conserva su selección. Resultados en PROGRESS.md. Entrega local, sin publicación automática ni cambios en Supabase/Resend/Vercel.

### Compatibilidad de confirmación con plantilla de correo existente

La plantilla española de src/lib/auth-email-templates.ts usa SiteURL y TokenHash, sin propagar RedirectTo. Para conservar el evento incluso en ese enlace, el registro guarda purchase_return en metadatos Auth: exclusivamente ruta pública de evento y cantidades validadas, sin datos personales ni precios. El callback signup lee ese dato solamente después de verificar el token; vuelve a validarlo y mantiene prioridad de invitaciones/recuperación. No concede permisos ni confirma pagos. No requiere cambiar la plantilla ni configuración de SMTP. Prueba Auth cubre fallback y rechazo de metadatos externos/administrativos.
