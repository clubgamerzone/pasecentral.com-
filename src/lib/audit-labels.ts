export const auditOperations: Record<
  string,
  { label: string; description: string }
> = {
  admin_bootstrap: {
    label: "Administrador inicial creado",
    description:
      "Se habilitó la primera cuenta administrativa mediante el procedimiento privado de instalación.",
  },
  profile_updated: {
    label: "Datos de cuenta actualizados",
    description:
      "Una persona guardó cambios en su nombre, teléfono o descripción de perfil.",
  },
  profile_photo_updated: {
    label: "Foto de perfil actualizada",
    description: "Una persona agregó o cambió su foto de perfil.",
  },
  profile_photo_removed: {
    label: "Foto de perfil eliminada",
    description: "Una persona retiró su foto de perfil; su cuenta permanece.",
  },
  invitation_created: {
    label: "Invitación al equipo creada",
    description:
      "Se preparó una invitación con rol y alcance. No significa que la persona ya la aceptó.",
  },
  invitation_accepted: {
    label: "Invitación aceptada",
    description:
      "La persona aceptó con el correo confirmado y se activaron los permisos de la invitación.",
  },
  invite_resend: {
    label: "Reenvío de invitación solicitado",
    description:
      "Se puso nuevamente en cola el correo de una invitación vigente. No confirma su recepción.",
  },
  invite_revoke: {
    label: "Invitación revocada",
    description:
      "Se anuló una invitación pendiente para que su enlace no conceda permisos.",
  },
  buyer_invitation_retired: {
    label: "Invitación antigua de comprador retirada",
    description:
      "Registro histórico de la migración que retiró las invitaciones de comprador. Los compradores se registran sin invitación.",
  },
  organization_membership: {
    label: "Permiso de organización cambiado",
    description:
      "Se agregó o retiró el rol de organizador con acceso a toda la organización.",
  },
  staff_assigned: {
    label: "Asignación de trabajador cambiada",
    description:
      "Se asignó, activó o desactivó el rol de una persona en un evento.",
  },
  event_created: {
    label: "Evento creado",
    description:
      "Se creó un evento en borrador. No significa que ya esté publicado.",
  },
  event_updated: {
    label: "Datos del evento actualizados",
    description:
      "Se guardaron cambios de nombre, descripción, lugar, fechas o aforo.",
  },
  event_status_changed: {
    label: "Estado del evento cambiado",
    description:
      "Se publicó el evento, se cerraron o reabrieron ventas, se finalizó o se canceló.",
  },
  event_image_added: {
    label: "Imagen del evento agregada",
    description: "Se agregó una foto a la galería del evento.",
  },
  event_image_removed: {
    label: "Imagen del evento eliminada",
    description:
      "Se retiró una foto de la galería y se ajustó la portada si correspondía.",
  },
  event_cover_updated: {
    label: "Portada del evento cambiada",
    description: "Se eligió otra foto de la galería como portada.",
  },
  type_created: {
    label: "Localidad creada",
    description:
      "Se agregó un tipo de entrada, por ejemplo General o VIP, con su cupo.",
  },
  type_updated: {
    label: "Localidad actualizada",
    description:
      "Se modificó el nombre o cupo de una localidad, respetando ventas, reservas y aforo.",
  },
  phase_created: {
    label: "Fase de precio creada",
    description:
      "Se agregó un precio con canal y fechas de vigencia para una localidad.",
  },
  phase_active_changed: {
    label: "Fase de precio activada o desactivada",
    description:
      "Se habilitó o deshabilitó una fase. No modifica precios guardados en compras anteriores.",
  },
  reservation_created: {
    label: "Reserva de compra creada",
    description:
      "Se reservó cupo temporalmente para pagar. Todavía no confirma el pago ni emite entradas.",
  },
  box_office_sale: {
    label: "Venta en taquilla registrada",
    description:
      "Un operador autorizado confirmó el cobro presencial y se emitieron las entradas de la orden.",
  },
  complimentary_issued: {
    label: "Cortesía emitida",
    description:
      "Se emitieron entradas sin cobro con autorización. También consumen aforo.",
  },
  tickets_issued: {
    label: "Entradas emitidas",
    description:
      "Se generaron las entradas individuales de una orden autorizada, con sus identificadores y QR.",
  },
  payment_approved: {
    label: "Pago aprobado y verificado",
    description:
      "Se comprobó la aprobación del pago y se confirmó la orden. No indica conciliación bancaria.",
  },
  late_payment_no_capacity: {
    label: "Pago tardío sin cupo",
    description:
      "Llegó un pago aprobado después de vencer la reserva y ya no había cupo. La orden requiere revisión; no se emitieron entradas sobre el aforo.",
  },
  payment_reconciled: {
    label: "Pago consultado y conciliado",
    description:
      "Se consultó al proveedor y se procesó el estado real del pago. El resultado puede seguir pendiente o ser rechazado.",
  },
  manual_checkin: {
    label: "Validación manual de ingreso intentada",
    description:
      "Un operador intentó registrar ingreso manual con un motivo. El resultado puede ser aceptado o rechazado; este código por sí solo no confirma acceso.",
  },
  scan_unknown: {
    label: "QR no identificado",
    description:
      "Una lectura no correspondió a una entrada conocida y no autorizó el ingreso.",
  },
  cash_opened: {
    label: "Caja abierta",
    description:
      "Un operador abrió su caja para un evento y registró el fondo inicial.",
  },
  cash_movement: {
    label: "Movimiento de efectivo registrado",
    description:
      "Se registró una entrada o salida de efectivo con su importe y motivo.",
  },
  cash_closed: {
    label: "Caja cerrada",
    description:
      "Se registró el efectivo declarado y se calculó la diferencia frente al esperado.",
  },
  cancel_ticket: {
    label: "Entrada anulada",
    description:
      "Se invalidó una entrada vigente. Anularla no devuelve dinero automáticamente.",
  },
  replace_ticket: {
    label: "QR de entrada sustituido",
    description:
      "Se cambió la credencial de una entrada y se invalidó el QR anterior.",
  },
  manual_refund_recorded: {
    label: "Devolución manual registrada",
    description:
      "Se registró una devolución y sus entradas afectadas. No ejecuta automáticamente una devolución en Wompi.",
  },
  resend: {
    label: "Reenvío de entradas solicitado",
    description:
      "Se puso en cola otro correo con las mismas entradas. No crea entradas nuevas ni confirma recepción.",
  },
  revoke_share: {
    label: "Enlace de entrega sustituido",
    description:
      "Se invalidó el enlace compartido anterior y se generó otro. Los QR de las entradas permanecen.",
  },
  ticket_print: {
    label: "Impresión solicitada",
    description:
      "Se creó un trabajo de impresión. La solicitud no garantiza que la boleta haya salido físicamente.",
  },
  ticket_reprint: {
    label: "Reimpresión solicitada",
    description:
      "Se solicitó otra impresión de la misma entrada con los mismos identificadores.",
  },
  print_result: {
    label: "Resultado de impresión registrado",
    description:
      "Se guardó el estado del trabajo: enviado, confirmado o fallido. Enviado no equivale a impresión física confirmada.",
  },
  test_data_reset: {
    label: "Datos de ensayo retirados",
    description:
      "Un procedimiento privado autorizado limpió datos de prueba, conservando cuentas e invitaciones.",
  },
};
export const auditEntities: Record<string, string> = {
  event: "Evento",
  order: "Orden de compra",
  ticket: "Entrada",
  ticket_type: "Localidad",
  pricing_phase: "Fase de precio",
  cash_session: "Caja",
  refund: "Devolución",
  print_job: "Trabajo de impresión",
  checkin: "Intento de ingreso",
  profile: "Cuenta de usuario",
  invitation: "Invitación",
  organization: "Organización",
  payment: "Pago",
  system: "Mantenimiento del sistema",
};
export function auditOperation(code: string) {
  return Object.hasOwn(auditOperations, code)
    ? auditOperations[code]
    : {
        label: "Operación no catalogada",
        description:
          "Este código no tiene una definición disponible todavía. Conserva el código para consultar soporte.",
      };
}
export function auditEntity(code: string) {
  return Object.hasOwn(auditEntities, code) ? auditEntities[code] : code;
}
