"use client";
import { useEffect, useRef, useState } from "react";
import type { Row } from "@/lib/db";
import { Field, useApp } from "./app";

export function OpenCashDialog({
  event,
  onClose,
}: {
  event: Row;
  onClose: () => void;
}) {
  const { run, busy } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="panel capacity-dialog"
      aria-labelledby="cash-opening-title"
      onCancel={onClose}
    >
      <h2 id="cash-opening-title">Abrir caja</h2>
      <p className="helper">
        {event.title} · La caja quedará a tu nombre para este evento.
      </p>
      <form
        className="section-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const values = Object.fromEntries(new FormData(e.currentTarget));
          const result = await run(
            { action: "cash_open", ...values, event_id: event.id },
            "Caja abierta. Ya puedes vender en efectivo.",
            setError,
          );
          if (result) onClose();
        }}
      >
        <Field name="opening_cash_cop" label="Fondo inicial" value={0} />
        <p className="helper">
          Indica el efectivo con el que empiezas para dar cambio. Puedes abrir
          con $ 0. No cuenta como venta.
        </p>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Abriendo caja…" : "Abrir caja y continuar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
