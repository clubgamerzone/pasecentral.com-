# Registro desde invitación y continuidad — 2026-10-14

## Problema observado

Una invitación laboral no creaba por sí sola una identidad Auth; la persona debía registrarse/confirmar y aceptar el rol después. La UI enviaba al registro general, y la confirmación volvía al perfil. El token laboral se conservaba únicamente en sessionStorage de la pestaña original: una confirmación en otra pestaña podía perder la continuidad y dejar una cuenta de comprador sin permisos activados. Se diagnosticó el recorrido en código; no se presume el correo o acciones exactas de la persona del caso.

## Flujo corregido

1. Enlace de invitación ofrece **Crear cuenta para aceptar la invitación** o **Ya tengo una cuenta**. Registro contextual dice «Crea tu cuenta para unirte al equipo» y «Crear cuenta y continuar con la invitación»; no pide elegir rol. Se usa el mismo correo invitado y contraseña propia/condiciones/datos de perfil.
2. Confirmar correo mediante Supabase retoma `/invite?confirmed=1` cuando existe invitación vigente/autorizada para el correo verificado del proveedor; otras cuentas continúan al perfil y recuperación conserva su ruta. No confía en next, rol o correo de parámetros externos.
3. Inicio de sesión normal también ofrece `/invite` desde respuesta del servidor si existe pendiente propia. **Mi perfil** muestra «Tienes una invitación pendiente al equipo» y **Continuar y activar permisos del equipo**. Sirve para la cuenta ya creada y no depende de conservar el token ni de usar la misma pestaña/dispositivo.
4. El usuario ve el rol pendiente y pulsa **Aceptar invitación**. En ese momento se asignan permisos de la invitación, con verificación de identidad/email/vigencia/creador/alcance y transacción existentes. Vuelve al perfil mostrando el rol activo. No se crean cuentas duplicadas ni se borran compras/perfil.

No se concede administración automáticamente por registrar, confirmar un correo o visitar una URL. Aceptación explícita se mantiene para mostrar el alcance antes de activarlo; el administrador define el rol, nunca el registro público. Si se usó otro correo, entrar con el invitado o solicitar nueva invitación al correcto. Vencida/revocada/sin autoridad del creador no aparece como pendiente activable. Un token de otra cuenta sigue rechazándose; se puede usar otra cuenta sin compartir contraseñas.

## Código y seguridad

- `invitations.ts`: pendingInvitation lee únicamente id/rol/include_access/vence de pendiente propia con email verificado y autoridad vigente. Sin tokens, correo de terceros o payload. `invite_accept_pending` permite retomar por ID y ejecuta las mismas comprobaciones/transacción que aceptación por token; UUID no concede autorización.
- `state.ts`: pending_invitation privado para actor verificado. `validation.ts` y `service.ts` despachan aceptación explícita por ID.
- `auth/confirm/route.ts`: distingue recuperación/perfil/invitación usando resultado verificado de Supabase; no cambios de plantillas, SMTP o allowlist. `/api/auth`: login retorna destino fijo `/invite` solo desde email confirmado de Supabase.
- `account.tsx`: aviso en perfil y aceptación sin token local; `app.tsx`: registro contextual y continuación. Token original todavía se quita de URL y conserva temporalmente en sessionStorage como alternativa; se elimina al aceptar/cancelar.

Usa Supabase Auth/PostgreSQL, Next.js y cola Resend existentes. Sin cuentas/claves/dependencias/migraciones nuevas. No solicita contraseñas por chat, no acepta invitaciones reales por terceros durante verificación, ni cambia roles conectados automáticamente al publicar.

## Verificación

Vitest: callback/signup/login, identidad verificada, UUID ajeno/no verificado denegado, estado sin credenciales y concesión solo tras aceptación. Playwright: cuenta existente, segunda pestaña sin token local, banner→invitación→admin con mismo user_id; restaura rol del fixture al terminar. Ensayos locales aislados, no cuentas/invitaciones cloud ficticias. Checks y publicación en PROGRESS.md; guías TEAM_PERMISSIONS.md y PROFILE_TEAM_SETUP.md.
