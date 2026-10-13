# Mi perfil e invitaciones de equipo

Implementación del 2026-10-13. Acceso desde el menú **Mi perfil** (`/account/profile`) y **Equipo y usuarios** (`/admin/users`); también invitación dentro del equipo de un evento.

## Mi perfil

Todas las cuentas autenticadas editan su propio nombre, teléfono y biografía. Foto JPG/PNG/WebP de hasta 2 MB y 16 megapíxeles: el servidor valida firma/formato y usa Sharp 0.35.5 para orientar, recortar a 256×256 y convertir a PNG sin metadatos originales. Se puede eliminar la foto. El menú muestra la foto/nombre guardados; la sección Mis permisos informa acceso global o por evento.

Correo de acceso de solo lectura: cambiarlo requiere un flujo de verificación específico, no editar el texto de un perfil. Cambiar contraseña usa la recuperación existente, que el propio usuario completa. Perfil nunca modifica roles, identidad o datos de otra cuenta.

UI: `src/components/account.tsx` (`MyProfile`). Actualización de texto: comando `profile_update` en validation.ts/service.ts. Foto: `src/app/api/profile/avatar/route.ts`, normalización en avatar.ts. La ruta GET sirve únicamente la foto propia, con sesión y Cache-Control private/no-store; POST/DELETE requieren origen autorizado y límites por usuario. No hay parámetro de propietario confiado al cliente.

En Supabase: bucket **avatars** privado, ruta `UUID_USUARIO/UUID_ARCHIVO.png`, políticas RLS de lectura/subida/eliminación por propietario; lectura administrativa permitida en Storage. La app no usa URLs públicas ni necesita claves adicionales/service_role para fotos: usa la sesión Supabase verificada. En demo local guarda archivos privados en `.local/avatars`, ignorados por Git. Reemplazar/eliminar limpia la foto anterior; fallar antes de guardar perfil intenta limpiar el archivo nuevo.

## Invitar personas

Administrador global introduce nombre, correo y rol. Taquilla, acceso y organizador por evento exigen seleccionar uno o varios eventos; comprador no concede permisos operativos; administrador global concede acceso a toda la plataforma y se identifica expresamente en el formulario. Los permisos se suman a los que ya tenga la cuenta, no se usan para degradar o retirar roles existentes.

El organizador **por evento** se guarda en event_staff y solo gestiona/consulta/opera sus eventos asignados. Las membresías de organizador por organización existentes conservan su alcance global dentro de esa organización; el formulario antiguo de membresía es una operación distinta. Una invitación no concede membresía de organización ni capacidad de crear fiestas ajenas.

1. Enviar invitación crea un registro pending y un correo persistente en cola.
2. Resend envía un enlace `/invite#TOKEN` válido por siete días; la app retira el fragmento y guarda temporalmente el token en sessionStorage de la pestaña para continuar tras login.
3. La persona crea una cuenta propia o inicia sesión con el **mismo correo**, confirma su correo y pulsa Aceptar invitación. Si la confirmación abre otra pestaña, volver a abrir el enlace original de invitación y entrar con la cuenta confirmada.
4. El servidor comprueba hash, destinatario desde Auth, email confirmado, vigencia, administrador creador todavía autorizado y eventos existentes. Asigna todos los permisos y marca accepted en una transacción; repetir no duplica asignaciones.
5. El administrador ve invitaciones y estado de envío; puede reenviar las pendientes vigentes o revocarlas. Vencidas requieren una invitación nueva. Revocar una invitación aceptada no retira permisos: usar las asignaciones/membresías correspondientes.

`src/lib/invitations.ts`: creación, aceptación, revocación/reenvío y entrega. Comandos `invite_create`, `invite_accept`, `invite_resend`, `invite_revoke`; nunca confiar en rol/eventos aportados al aceptar. Los tokens se guardan como hash y cifrados; campos secretos/correo preparado no están en API state ni disponibles a roles cliente. Una invitación rechazada no crea ni cambia contraseñas. No automatizar invitaciones a terceros sin solicitud concreta del administrador.

El worker existente `/api/worker` procesa también invitaciones, con SKIP LOCKED, seis intentos, espera incremental, recuperación tras diez minutos e idempotencia por generación de envío. Resend aceptado se muestra como Correo enviado, no como leído/aceptado. Reenvío conserva el enlace vigente pero crea una generación nueva para el proveedor; revocación siempre impide aceptar aunque el correo ya estuviera en vuelo. Demo genera `.local/outbox/invite-ID-GENERACION.json` privado sin correo real.

## Configuración y pruebas

Migración: `supabase/migrations/004_profiles_invitations.sql`. Añade campos de perfil, tabla team_invitations con RLS y permisos de columnas, rol organizer en event_staff, función RLS can_event y bucket/políticas privadas. No añade secretos ni cuentas externas.

Aplicar antes de publicar con `node --env-file=.env.local --import tsx scripts/migrate.ts`. Actualizar el cron existente para despertar también con invitaciones pendientes: `node --env-file=.env.local --import tsx scripts/configure-email-worker.ts https://pasecentral-demo.vercel.app --apply`. Mantiene el token de worker en Vault y la comprobación de frontera net/Data API documentada en EMAIL_SETUP_2026-10-13.md.

Ejecutar lint, typecheck, Vitest y Playwright. Casos añadidos: edición propia sin autoasignar rol, normalización/rechazo de imágenes, admin obligatorio, cuenta de correo incorrecta/no confirmada, invitación revocada/vencida/administrador retirado, organizador limitado a un evento, varias asignaciones, columnas/filas secretas protegidas, foto privada por HTTP y aceptación desde enlace sin exponer fragmento. El ensayo con nuevas personas reales requiere su propio registro y confirmación; no se inventa un correo verificado ni se comparte contraseña.

Documentación y resultados: PROGRESS.md. Commit de implementación: `git log -1 -- src/components/account.tsx`.
