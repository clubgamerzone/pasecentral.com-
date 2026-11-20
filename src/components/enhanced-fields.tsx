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
  values.admission_starts_at = values.admission_same_start
    ? start
    : `${start.slice(0, 10)}T${values.admission_starts_at}`;
  delete values.admission_same_start;
  for (const k of [
    "starts_at",
    "ends_at",
    "admission_starts_at",
    "admission_ends_at",
  ])
    values[k] = values[k]
      ? new Date(`${values[k]}:00-05:00`).toISOString()
      : null;
  return values;
}
export function EventCapacity({ event }: { event?: Row }) {
  const [unlimited, setUnlimited] = useState(
    event ? event.capacity === null : false,
  );
  return (
    <div className="field capacity-control">
      {unlimited ? (
        <>
          <span className="control-label">Aforo total</span>
          <div className="capacity-status">Sin límite de aforo</div>
          <input type="hidden" name="capacity" value="" />
        </>
      ) : (
        <Field
          name="capacity"
          label="Aforo total"
          type="number"
          min={1}
          max={1000000}
          defaultValue={event?.capacity ?? undefined}
        />
      )}
      <label className="event-option">
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
        />
        Aforo ilimitado
      </label>
      {unlimited && (
        <small>
          Sin límite total del evento. Se conservan los cupos de cada localidad.
        </small>
      )}
    </div>
  );
}
export function TicketCapacity({
  unlimitedAllowed,
  capacity,
  label,
  unlimitedLabel = "Cupo ilimitado de la localidad",
  minimum = 1,
  maximum = 1000000,
}: {
  unlimitedAllowed: boolean;
  capacity?: number | null;
  label: string;
  unlimitedLabel?: string;
  minimum?: number;
  maximum?: number;
}) {
  const [unlimited, setUnlimited] = useState(capacity === null);
  return (
    <div className="field capacity-control">
      {unlimitedAllowed && unlimited ? (
        <>
          <span className="control-label">{label}</span>
          <div className="capacity-status">Entradas sin límite de cupo</div>
          <input type="hidden" name="capacity" value="" />
        </>
      ) : (
        <Field
          name="capacity"
          label={label}
          type="number"
          min={minimum}
          max={maximum}
          defaultValue={capacity ?? undefined}
        />
      )}
      {unlimitedAllowed && (
        <label className="event-option">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
          />
          {unlimitedLabel}
        </label>
      )}
    </div>
  );
}
export function EventSchedule({ event }: { event?: Row }) {
  const [hasEnd, setHasEnd] = useState(Boolean(event?.ends_at));
  const [hasClose, setHasClose] = useState(Boolean(event?.admission_ends_at));
  const [sameOpen, setSameOpen] = useState(
    !event ||
      new Date(event.starts_at).getTime() ===
        new Date(event.admission_starts_at).getTime(),
  );
  const [start, setStart] = useState(
      event ? localDateTime(event.starts_at) : "",
    ),
    [open, setOpen] = useState(
      event ? localDateTime(event.admission_starts_at).slice(11) : "",
    );
  return (
    <fieldset className="form-section full">
      <legend>Horarios y acceso</legend>
      <div className="form-grid">
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
        <div className="field schedule-option">
          <label className="event-option">
            <input
              type="checkbox"
              checked={hasEnd}
              onChange={(e) => setHasEnd(e.target.checked)}
            />
            Definir fin del evento
          </label>
          {hasEnd && (
            <Field
              name="ends_at"
              label="Fin del evento"
              type="datetime-local"
              min={start || undefined}
              defaultValue={
                event?.ends_at ? localDateTime(event.ends_at) : undefined
              }
            />
          )}
        </div>
        <div className="field schedule-option">
          <label className="event-option">
            <input
              name="admission_same_start"
              type="checkbox"
              checked={sameOpen}
              onChange={(e) => setSameOpen(e.target.checked)}
            />
            Apertura de puertas: misma hora de inicio del evento
          </label>
          {!sameOpen && (
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
          )}
        </div>
        <div className="field schedule-option">
          <label className="event-option">
            <input
              type="checkbox"
              checked={hasClose}
              onChange={(e) => setHasClose(e.target.checked)}
            />
            Definir cierre de puertas
          </label>
          {hasClose && (
            <Field
              name="admission_ends_at"
              label="Cierre de puertas"
              type="datetime-local"
              min={
                sameOpen
                  ? start || undefined
                  : start && open
                    ? `${start.slice(0, 10)}T${open}`
                    : undefined
              }
              defaultValue={
                event?.admission_ends_at
                  ? localDateTime(event.admission_ends_at)
                  : undefined
              }
            />
          )}
        </div>
        <p className="helper full">
          Hora de Colombia (UTC−5). El cierre puede ser al día siguiente; debe
          ocurrir después de la apertura.
        </p>
      </div>
    </fieldset>
  );
}

export function PhaseEnd({
  event,
  phase,
  label = "Fin · Colombia",
}: {
  event?: Row;
  phase?: Row;
  label?: string;
}) {
  const [untilEnd, setUntilEnd] = useState(Boolean(phase?.ends_with_event));
  const [manualEnd, setManualEnd] = useState(
    phase?.ends_at
      ? localDateTime(phase.ends_at)
      : event?.ends_at
        ? localDateTime(event.ends_at)
        : "",
  );
  return (
    <div className="field capacity-control">
      {!untilEnd && (
        <Field
          name="ends_at"
          label={label}
          type="datetime-local"
          value={manualEnd}
          onChange={(e) => setManualEnd(e.target.value)}
        />
      )}
      <label className="event-option">
        <input
          name="ends_with_event"
          type="checkbox"
          checked={untilEnd}
          onChange={(e) => setUntilEnd(e.target.checked)}
        />
        Vender hasta el final del evento
      </label>
      {untilEnd && (
        <p className="helper">
          {event?.ends_at
            ? `Las ventas de esta fase terminan el ${new Date(event.ends_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })}, hora de Colombia. Se actualizará si cambias el fin del evento.`
            : "Sin fin del evento definido: la fase seguirá abierta hasta que cierres las ventas o finalices el evento."}
        </p>
      )}
    </div>
  );
}
