"use client";
import { useEffect, useRef } from "react";
import { Field, useApp } from "./app";
export type PreprintActionTarget = {
  eventId: string;
  batchId: string;
  ticketId?: string;
  name: string;
  operation: "deactivate" | "delete";
};
export function PreprintActionDialog({
  target,
  onClose,
  onDone,
}: {
  target: PreprintActionTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, busy } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const deleting = target.operation === "delete";
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="panel capacity-dialog no-print"
      onCancel={onClose}
      aria-labelledby="preprint-action-title"
    >
      <h2 id="preprint-action-title">
        {deleting ? "Eliminar" : "Desactivar"}{" "}
        {target.ticketId ? "boleta" : "lote"}
      </h2>
      <p>
        <strong>{target.name}</strong>
      </p>
      <p className="notice error">
        {deleting
          ? "Se eliminarán las boletas sin venta y sus credenciales QR. Sus números no se volverán a utilizar. La auditoría y el historial de impresión se conservan. No se pueden eliminar boletas vendidas."
          : "Se desactivarán definitivamente las boletas pendientes. No podrán venderse, activarse ni usarse para ingresar. Se libera su cupo; las boletas ya vendidas no se modifican."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const reason = String(new FormData(e.currentTarget).get("reason"));
          const r = await run(
            {
              action: deleting ? "preprint_delete" : "preprint_block",
              event_id: target.eventId,
              batch_id: target.batchId,
              ticket_id: target.ticketId,
              reason,
              ...(deleting ? { confirmed: true } : {}),
            },
            deleting
              ? "Boletas eliminadas del inventario"
              : "Boletas desactivadas",
          );
          if (r) onDone();
        }}
      >
        <Field
          name="reason"
          label={
            deleting ? "Motivo de la eliminación" : "Motivo de la desactivación"
          }
          required
        />
        <label className="ticket-print-choice">
          <input type="checkbox" required disabled={busy} />
          Entiendo que esta acción no se puede deshacer
        </label>
        <div className="buttons">
          <button className="btn danger" disabled={busy}>
            {deleting
              ? "Eliminar definitivamente"
              : "Desactivar definitivamente"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
