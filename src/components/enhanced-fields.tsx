"use client";
import { useState } from "react";
import { Field } from "./app";
import type { Row } from "@/lib/db";
export function MoneyInput({
  id,
  name,
  value,
  required,
  disabled,
  readOnly,
}: {
  id: string;
  name: string;
  value?: string | number | readonly string[];
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const [digits, setDigits] = useState(value == null ? "" : String(value));
  const display =
    digits === "" ? "" : `$ ${Number(digits).toLocaleString("es-CO")}`;
  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) =>
          setDigits(e.target.value.replace(/\D/g, "").slice(0, 9))
        }
        required={required}
        disabled={disabled}
        readOnly={readOnly}
      />
      <input type="hidden" name={name} value={digits} disabled={disabled} />
    </>
  );
}
export const localDateTime = (v: string | Date) =>
  new Date(new Date(v).getTime() - 5 * 3600000).toISOString().slice(0, 16);
export function scheduleValues(values: Row) {
  const start = String(values.starts_at);
  values.admission_starts_at = `${start.slice(0, 10)}T${values.admission_starts_at}`;
  for (const k of [
    "starts_at",
    "ends_at",
    "admission_starts_at",
    "admission_ends_at",
  ])
    values[k] = new Date(`${values[k]}:00-05:00`).toISOString();
  return values;
}
export function EventSchedule({ event }: { event?: Row }) {
  const [start, setStart] = useState(
      event ? localDateTime(event.starts_at) : "",
    ),
    [open, setOpen] = useState(
      event ? localDateTime(event.admission_starts_at).slice(11) : "",
    );
  return (
    <>
      <Field
        name="minimum_age"
        label="Edad mínima de ingreso (0 = todas las edades)"
        type="number"
        defaultValue={event?.minimum_age ?? 18}
        min={0}
        max={100}
      />
      <label className="field">
        <span>Inicio del evento</span>
        <input
          name="starts_at"
          aria-label="Inicio del evento"
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
        />
      </label>
      <Field
        name="ends_at"
        label="Fin del evento"
        type="datetime-local"
        min={start || undefined}
        defaultValue={event ? localDateTime(event.ends_at) : undefined}
      />
      <label className="field">
        <span>Apertura de puertas</span>
        <input
          name="admission_starts_at"
          aria-label="Apertura de puertas"
          type="time"
          value={open}
          onChange={(e) => setOpen(e.target.value)}
          required
        />
        <small>En la fecha de inicio del evento.</small>
      </label>
      <Field
        name="admission_ends_at"
        label="Cierre de puertas"
        type="datetime-local"
        min={start && open ? `${start.slice(0, 10)}T${open}` : undefined}
        defaultValue={
          event ? localDateTime(event.admission_ends_at) : undefined
        }
      />
      <p className="helper full">
        Hora de Colombia (UTC−5). El cierre puede ser al día siguiente; debe
        ocurrir después de la apertura.
      </p>
    </>
  );
}
