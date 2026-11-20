# Registro con correo existente (2026-11-20)

## Comportamiento y ubicación

En `/login?register=1`, enviar el formulario no confirma por sí solo que se haya creado una cuenta. Supabase puede devolver una respuesta deliberadamente neutra para un correo confirmado existente. No se debe interpretar esa respuesta como una segunda cuenta, ni consultar públicamente si existe un correo.

`src/app/api/auth/route.ts` normaliza espacios/mayúsculas del correo antes de limitar solicitudes y llamar a Auth. Tanto una respuesta satisfactoria como los códigos de duplicado `user_already_exists` y `email_exists` devuelven el mismo mensaje condicional: confirmar por correo si es una cuenta nueva, o iniciar sesión/recuperar contraseña si ya existe. Los demás errores siguen siendo errores; iniciar sesión nunca trata un duplicado como éxito. Esta ruta no sobrescribe perfiles, contraseñas ni roles por un intento de alta.

`src/components/app.tsx`, componente `Login`, sustituye el formulario enviado por «Continúa con tu cuenta», con botones de inicio de sesión, recuperación y uso de otro correo. Al desmontar el formulario se elimina la contraseña introducida de ese formulario. El flujo de invitación usa la misma respuesta neutra, sin asegurar «Cuenta creada» ni conceder permisos al registrarse.

Referencia del proveedor: https://supabase.com/docs/reference/javascript/auth-signup.

## Verificación y límites

- `npx vitest run tests/auth-recovery.test.ts`: 14 pruebas aprobadas; respuestas nuevas/ocultas/códigos duplicados indistinguibles, normalización y errores de inicio de sesión preservados.
- `npx playwright test tests/e2e/signup.spec.ts`: flujo aislado con Auth interceptado, sin enviar correo ni crear cuentas reales. Verifica pantalla posterior, eliminación del campo de contraseña y acceso a inicio/recuperación.
- Lint, comprobación de tipos y build: ver registro de esta entrega en PROGRESS.md.
- Una consulta privada de solo lectura confirmó una única identidad y un único perfil para el caso reportado, sin cambios recientes en el perfil. No se guardan datos personales en esta guía.
- Cambios locales, sin commit/push/despliegue en esta entrega. No equivale a verificar entrega de un correo real ni modifica configuración de Auth.
