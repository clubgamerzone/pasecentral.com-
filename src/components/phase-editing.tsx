"use client";
import { useState } from "react";
import type { Row } from "@/lib/db";
import { useApp, Field } from "./app";
import { localDateTime } from "./enhanced-fields";
export function EditPhase({ phase, eventId }: { phase: Row; eventId: string }) {
  const [open, setOpen] = useState(false);
  const { run, busy } = useApp();
  return (
    <>
      <button type="button" className="btn small" onClick={() => setOpen(true)}>
        Editar fase {phase.name}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Editar fase ${phase.name}`}
          className="image-confirm-backdrop"
        >
          <form
            className="panel"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              for (const k of ["starts_at", "ends_at"])
                values[k] = new Date(`${values[k]}:00-05:00`).toISOString();
              const r = await run(
                {
                  action: "update_phase",
                  event_id: eventId,
                  phase_id: phase.id,
                  ...values,
                },
                "Fase actualizada. Las ventas anteriores conservan su precio.",
              );
              if (r) setOpen(false);
            }}
          >
            <h2>Editar fase</h2>
            <div className="form-grid">
              <Field
                name="name"
                label="Nombre de la fase"
                defaultValue={phase.name}
              />
              <Field
                name="price_cop"
                label="Precio en COP"
                defaultValue={phase.price_cop}
              />
              <label className="field">
                <span>Canal</span>
                <select
                  name="channel"
                  aria-label="Canal"
                  defaultValue={phase.channel}
                >
                  <option value="web">Online</option>
                  <option value="box_office">Taquilla</option>
                  <option value="both">Ambos</option>
                </select>
              </label>
              <Field
                name="starts_at"
                label="Inicio de la fase"
                type="datetime-local"
                defaultValue={localDateTime(phase.starts_at)}
              />
              <Field
                name="ends_at"
                label="Fin de la fase"
                type="datetime-local"
                defaultValue={localDateTime(phase.ends_at)}
              />
            </div>
            <p>
              Hora de Colombia. No puede superponerse con otra fase activa para
              el mismo canal. “Ambos” aplica un mismo precio online y en
              taquilla.
            </p>
            <div className="buttons">
              <button
                type="button"
                className="btn"
                onClick={() => setOpen(false)}
              >
                Cancelar edición
              </button>
              <button className="btn primary" disabled={busy}>
                Guardar fase
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
