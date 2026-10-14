# Equipo: caja y acceso independientes — 2026-10-14

## Dónde y cómo

**Equipo y usuarios** (`/admin/users`) y **Mis eventos → evento → Equipo** muestran invitaciones, Usuarios y permisos, asignación directa y membresías de organización cuando corresponda.

Al invitar **Cajero / taquilla**, marcar **Incluir acceso (validar entradas con lector QR)** para conceder caja y acceso en todos los eventos seleccionados. Desmarcada concede únicamente caja adicional; no retira accesos previos. Las invitaciones suman permisos tras aceptación desde el correo verificado y duran siete días. Compradores siguen registrándose libremente. El correo español menciona el lector cuando está incluido.

**Editar permisos de [persona]** abre permisos por evento independientes: Administrador de evento (incluye ventas y acceso), Cajero / taquilla y Acceso / lector QR. Guardar reemplaza las asignaciones directas de esa persona en los eventos mostrados; desmarcar todo las desactiva. Los otros eventos permanecen. No elimina cuenta, entradas, ventas o auditoría. Actualizar la pantalla del trabajador/lector para ver el menú nuevo; servidor vuelve a verificar permisos en cada operación, aunque su pantalla anterior permanezca abierta.

El editor usa diálogo nativo con foco confinado y cancelación por Escape. Durante guardado no se cancela el envío ya iniciado; los errores de servidor se muestran dentro del diálogo (por ejemplo, último administrador), sin ocultarse detrás del fondo. `App.run` admite callback opcional de error para este formulario, manteniendo el aviso general existente.

Administrador global puede editar nombre de usuario y permiso de administrador global, además de todos los eventos. Último administrador global protegido; aviso al editarse uno mismo. Administrador de evento solo modifica asignaciones en los eventos que administra, no nombres/roles globales ni cuentas de administrador global. Usuarios ajenos solo se incorporan mediante invitación verificada; no se muestra el directorio completo a gestores de evento. Correo de acceso/contraseñas/demografía no se editan desde esta ventana.

**Permisos heredados:** administrador global o membresía de organizador conserva acceso aunque se retiren casillas de evento; la ventana lo indica. Membresía de organización se retira por administrador global en Organizadores de toda la organización, operación distinta. Cajas abiertas y operaciones ya registradas no se borran al retirar rol; coordinar cierre antes de retirar taquilla.

## Implementación

- `src/components/account.tsx`: casilla y alcance de invitación; solo lista eventos administrados y roles autorizados.
- `src/components/team-editor.tsx`: lista, edición de nombre/global/eventos y avisos de herencia; `operations.tsx` lo integra en ambas pantallas. Estilos adaptables en `src/app/globals.css`.
- `src/lib/team.ts`: comando `team_update` validado en `validation.ts` y despachado desde `service.ts`. Bloqueos de perfil/tabla de administradores/eventos en orden consistente; valida todos los eventos antes de cambiar. Guarda roles y auditoría en una transacción. Último administrador y cuentas eliminadas protegidos.
- `invitations.ts`: persistencia/aceptación de include_access, control de gestores y worker español/idempotente. Invitación aceptada no reactiva roles al repetir el enlace. Creador debe conservar alcance al enviar/aceptar.
- `state.ts`: campos de equipo de perfiles activos y herencia; invitaciones solo si se administran todos sus eventos. No expone invitaciones parcialmente ajenas ni tokens/payload cifrado.
- `supabase/migrations/009_team_permissions.sql`: boolean include_access solo para box_office (default false conserva invitaciones anteriores); RLS de lectura por gestor de todos los eventos. Función `app_private.inviter_authorized` SECURITY DEFINER con search_path fijado, EXECUTE revocado de PUBLIC/anon/authenticated: solo servidor/worker. No hay DML directo de permisos para navegador.
- `audit-labels.ts`: `team_permissions_updated`, nombres españoles. Metadata guarda IDs/roles y si cambió nombre; no nombre/correo ni credenciales.

No agrega paquetes, cuentas, claves o servicios. PostgreSQL/Supabase Auth, Resend y Vercel existentes; lector sigue autorizándose con roles de evento en servidor/RLS. Migrar con `node --env-file=.env.local --import tsx scripts/migrate.ts`; no mostrar/subir .env.local. Las migraciones no conceden nuevos roles a las personas existentes, ni envían invitaciones automáticamente.

## Verificación

`tests/service.test.ts`: seis casos nuevos de inclusión/retiro/idempotencia, permisos por evento, invitador retirado, edición atómica, alcance global/último admin/herencia, estado/RLS y EXECUTE privado. `tests/e2e/team.spec.ts`: casilla para cajero, edición/retiro de lector manteniendo caja/cuenta, móvil sin desbordamiento, gestor limitado sin controles globales. E2E y unidades solo usan PostgreSQL local/fixtures; no envían correo a trabajadores reales ni cambian roles conectados.

Ejecutar lint/tipos/Vitest/E2E/build; evitar build mientras corre E2E. Estado, resultados y commit en PROGRESS.md. Guía anterior de Auth/fotos/cola/Resend: PROFILE_TEAM_SETUP.md.
