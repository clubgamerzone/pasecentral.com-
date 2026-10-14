# Mi perfil e invitaciones de equipo

Implementación del 2026-10-13. Acceso desde el menú **Mi perfil** (`/account/profile`) y **Equipo y usuarios** (`/admin/users`); también invitación dentro del equipo de un evento.

## Mi perfil

Todas las cuentas autenticadas editan su propio nombre, teléfono y biografía. Foto JPG/PNG/WebP de hasta 2 MB y 16 megapíxeles: el servidor valida firma/formato y usa Sharp 0.35.5 para orientar, recortar a 256×256 y convertir a PNG sin metadatos originales. Se puede eliminar la foto. El menú muestra la foto/nombre guardados; la sección Mis permisos informa acceso global o por evento.

Correo de acceso de solo lectura: cambiarlo requiere un flujo de verificación específico, no editar el texto de un perfil. Cambiar contraseña usa la recuperación existente, que el propio usuario completa. Perfil nunca modifica roles, identidad o datos de otra cuenta.

UI: `src/components/account.tsx` (`MyProfile`). Actualización de texto: comando `profile_update` en validation.ts/service.ts. Foto: `src/app/api/profile/avatar/route.ts`, normalización en avatar.ts. La ruta GET sirve únicamente la foto propia, con sesión y Cache-Control private/no-store; POST/DELETE requieren origen autorizado y límites por usuario. No hay parámetro de propietario confiado al cliente.

En Supabase: bucket **avatars** privado, ruta `UUID_USUARIO/UUID_ARCHIVO.png`, políticas RLS de lectura/subida/eliminación por propietario; lectura administrativa permitida en Storage. La app no usa URLs públicas ni necesita claves adicionales/service_role para fotos: usa la sesión Supabase verificada. En demo local guarda archivos privados en `.local/avatars`, ignorados por Git. Reemplazar/eliminar limpia la foto anterior; fallar antes de guardar perfil intenta limpiar el archivo nuevo.

## Invitar personas

Administrador global o administrador de evento introduce nombre, correo y rol del trabajador; el segundo solo selecciona eventos que administra y no puede invitar administradores globales. Cajero / taquilla, acceso y organizador por evento exigen seleccionar uno o varios eventos; administrador global concede acceso a toda la plataforma y se identifica expresamente en el formulario. Cajero / taquilla es la selección inicial, con casilla opcional **Incluir acceso (validar entradas con lector QR)**. Las invitaciones son exclusivamente para el equipo; cualquier comprador se registra libremente sin invitación. Los permisos se suman a los que ya tenga la cuenta, no se usan para degradar o retirar roles existentes.

El organizador **por evento** se guarda en event_staff y solo gestiona/consulta/opera sus eventos asignados. Las membresías de organizador por organización existentes conservan su alcance global dentro de esa organización; el formulario antiguo de membresía es una operación distinta. Una invitación no concede membresía de organización ni capacidad de crear fiestas ajenas.

1. Enviar invitación crea un registro pending y un correo persistente en cola.
2. Resend envía un enlace `/invite#TOKEN` válido por siete días; la app retira el fragmento y guarda temporalmente el token en sessionStorage de la pestaña para continuar tras login.
3. La persona crea una cuenta propia o inicia sesión con el **mismo correo**, confirma su correo y pulsa Aceptar invitación. La confirmación retoma la invitación propia; si ya se creó la cuenta, Mi perfil ofrece Continuar y activar permisos del equipo, incluso en otra pestaña sin token local. Flujo actualizado: INVITATION_ONBOARDING.md.
4. El servidor comprueba hash, destinatario desde Auth, email confirmado, vigencia, administrador creador todavía autorizado para todos los eventos y eventos existentes. Asigna todos los permisos y marca accepted en una transacción; repetir no duplica asignaciones ni vuelve a activar permisos retirados después. Incluir acceso genera roles separados box_office + access_staff para cada evento.
   Si inició sesión con otra cuenta, **Usar otra cuenta** cierra la sesión y conserva la invitación para el siguiente login. **Ahora no** borra el token temporal de la pestaña y vuelve a eventos sin conceder permisos; el enlace de correo continúa vigente hasta su vencimiento/revocación.
5. El administrador ve invitaciones y estado de envío; puede reenviar las pendientes vigentes o revocarlas. Vencidas requieren una invitación nueva. Revocar una invitación aceptada no retira permisos: usar las asignaciones/membresías correspondientes.

`src/lib/invitations.ts`: creación, aceptación, revocación/reenvío y entrega. Comandos `invite_create`, `invite_accept`, `invite_resend`, `invite_revoke`; nunca confiar en rol/eventos aportados al aceptar. Los tokens se guardan como hash y cifrados; campos secretos/correo preparado no están en API state ni disponibles a roles cliente. Una invitación rechazada no crea ni cambia contraseñas. No automatizar invitaciones a terceros sin solicitud concreta del administrador.

El worker existente `/api/worker` procesa también invitaciones, con SKIP LOCKED, seis intentos, espera incremental, recuperación tras diez minutos e idempotencia por generación de envío. Resend aceptado se muestra como Correo enviado, no como leído/aceptado. Reenvío conserva el enlace vigente pero crea una generación nueva para el proveedor; revocación siempre impide aceptar aunque el correo ya estuviera en vuelo. Demo genera `.local/outbox/invite-ID-GENERACION.json` privado sin correo real.

## Configuración y pruebas

Migración: `supabase/migrations/004_profiles_invitations.sql`. Añade campos de perfil, tabla team_invitations con RLS y permisos de columnas, rol organizer en event_staff, función RLS can_event y bucket/políticas privadas. No añade secretos ni cuentas externas.

Aplicar antes de publicar con `node --env-file=.env.local --import tsx scripts/migrate.ts`. Actualizar el cron existente para despertar también con invitaciones pendientes: `node --env-file=.env.local --import tsx scripts/configure-email-worker.ts https://pasecentral-demo.vercel.app --apply`. Mantiene el token de worker en Vault y la comprobación de frontera net/Data API documentada en EMAIL_SETUP_2026-10-13.md.

Ejecutar lint, typecheck, Vitest y Playwright. Casos añadidos: edición propia sin autoasignar rol, normalización/rechazo de imágenes, admin obligatorio, cuenta de correo incorrecta/no confirmada, invitación revocada/vencida/administrador retirado, organizador limitado a un evento, varias asignaciones, columnas/filas secretas protegidas, foto privada por HTTP y aceptación desde enlace sin exponer fragmento. El ensayo con nuevas personas reales requiere su propio registro y confirmación; no se inventa un correo verificado ni se comparte contraseña.

Documentación y resultados: PROGRESS.md. Commit de implementación: `git log -1 -- src/components/account.tsx`.

Verificación de staging el 2026-10-13: carga/renderizado/eliminación de foto de prueba contra Storage privado comprobada; acceso anónimo rechazado 401, tokens cifrados no legibles por authenticated. Invitación propia de rol comprador enviada por scheduler en un intento y Resend confirmó Delivered; no añade permisos ni cambia roles actuales. Aceptación para varios eventos y edición de perfil verificadas en Playwright, con viewport de 390 px. Primer despliegue de la implementación `10ec5c0` Ready; revisiones de UI posteriores se identifican por el comando de Git anterior. Para invitar otra persona, completar datos del formulario y seleccionar su alcance; nadie ajeno fue invitado automáticamente durante el ensayo.
### Corrección del alcance de invitaciones (2026-10-13)

Por instrucción del propietario se retira el rol comprador de UI, validación API y nuevas escrituras PostgreSQL. Migración `006_employee_invitations_only.sql` revoca invitaciones de comprador pendientes, registra auditoría y añade CHECK de roles laborales. Los registros históricos se conservan, pero no se muestran en la lista activa ni se pueden aceptar como compradores. El CHECK usa NOT VALID solo cuando existen registros históricos de ese rol; aplica a toda nueva escritura y se valida inmediatamente en una base sin legado. No elimina cuentas ni entradas ni cambia permisos ya existentes. No envía correos para informar esta corrección. El ensayo histórico de correo propio de comprador descrito arriba quedó retirado; no es el flujo actual.

Pruebas: comprador normal reserva sin invitación; API y PostgreSQL rechazan crear invitación customer; UI no ofrece Comprador y selecciona cajero; E2E acepta invitación de cajero para varios eventos. Registro/Auth conserva acceso normal para compras y Mis entradas. Implementación: `account.tsx`, `validation.ts`, `invitations.ts`, filtro de `state.ts` y migración 006. Aplicar con el script de migraciones existente; resultados/commit en PROGRESS.md.
