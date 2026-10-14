# Definiciones de operaciones de auditoría

En **Reportes → Auditoría de operaciones → Guía de códigos de operación** se consulta el catálogo completo. Buscar por código exacto, nombre en español o palabra como caja, invitación o perfil. La guía permanece disponible con historial vacío y consultarla no añade registros. La tabla muestra nombre legible, código original y explicación; las entidades también se presentan en español. El identificador corto de entidad sirve para reconocer el registro afectado, no es una credencial.

Ejemplos:

| Código | Significado |
| --- | --- |
| profile_updated | Se guardaron cambios de nombre, teléfono o descripción de la cuenta. |
| profile_photo_updated | Se agregó o cambió la foto de perfil. |
| profile_photo_removed | Se retiró la foto; la cuenta continúa existiendo. |
| invitation_created | Se preparó una invitación al equipo; todavía no indica aceptación. |
| invitation_accepted | Se aceptó con correo confirmado y se activaron los permisos. |
| organization_membership | Se agregó o retiró permiso de organizador en toda la organización. |
| admin_bootstrap | Se habilitó el administrador inicial por el procedimiento privado. |
| buyer_invitation_retired | Histórico de retiro de invitaciones de comprador; el comprador se registra libremente. |
| test_data_reset | Un procedimiento autorizado retiró datos de ensayo. |
| box_office_sale | Se confirmó una venta presencial autorizada. |
| reservation_created | Reserva temporal; no implica pago aprobado ni emisión. |

**Operación** es la acción realizada; **Entidad** es el registro afectado; **Responsable** es la persona que ejecutó la acción o Sistema cuando fue automático. Intento manual de ingreso no equivale a acceso aprobado; solicitud de impresión no equivale a impresión física; solicitud de reenvío no equivale a correo entregado. La definición específica lo indica.

Fuente única del catálogo de códigos y entidades: `src/lib/audit-labels.ts`. Interfaz de búsqueda: `src/components/audit-guide.tsx`; presentación del historial: `src/components/operations.tsx`. Catálogo construido leyendo acciones emitidas por service.ts, invitations.ts, endpoints de fotos, bootstrap, mantenimiento y migración de invitaciones. Al añadir otra operación, agregar su definición aquí en el catálogo; un código desconocido se muestra como Operación no catalogada conservando su valor original, sin inventar significado.

React/Next.js existentes; sin librerías nuevas, migración, permisos adicionales ni secretos. No modifica ni crea filas de audit_logs; la limpieza anterior permanece. Prueba E2E `auditoría explica operaciones…` verifica traducción de una fila, búsqueda, ausencia de resultados y que consultar la guía no añade auditoría. Resultados/commit: PROGRESS.md.
