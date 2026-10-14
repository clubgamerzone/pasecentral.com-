"use client";
import { ageBands, genders, type Attendee } from "@/lib/demographics";
import type { Row } from "@/lib/db";
export function attendeeItems(
  quantities: Record<string, number>,
  people: Record<string, Attendee>,
  consent: boolean,
) {
  return Object.entries(quantities)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, n]) => n > 0)
    .map(([ticket_type_id, quantity]) => ({
      ticket_type_id,
      quantity,
      ...(consent
        ? {
            attendees: Array.from(
              { length: quantity },
              (_, n) =>
                people[`${ticket_type_id}:${n}`] ?? {
                  gender: null,
                  age_band: null,
                },
            ),
          }
        : {}),
    }));
}
export function AttendeeFields({
  types,
  quantities,
  people,
  onChange,
  consent,
  onConsent,
  skipFirst = false,
}: {
  types: Row[];
  quantities: Record<string, number>;
  people: Record<string, Attendee>;
  onChange: (p: Record<string, Attendee>) => void;
  consent: boolean;
  onConsent: (v: boolean) => void;
  skipFirst?: boolean;
}) {
  return (
    <details style={{ margin: "20px 0" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Datos opcionales de cada asistente
      </summary>
      <p className="helper" style={{ margin: "12px 0" }}>
        Ayudan a conocer el público del evento. Una compra puede incluir
        personas diferentes. No pedimos nombres ni fechas de nacimiento;
        omitirlos no afecta la compra. Indica la edad que tendrá cada persona en
        la fecha del evento.
      </p>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(ev) => onConsent(ev.target.checked)}
        />
        Autorizo el uso de estos datos para estadísticas y tengo autorización de
        los asistentes o de su responsable si son menores.
      </label>
      {consent && (
        <div className="section-stack" style={{ marginTop: 16 }}>
          {types
            .slice()
            .sort((a, b) => a.id.localeCompare(b.id))
            .flatMap((t) =>
              Array.from({ length: quantities[t.id] ?? 0 }, (_, n) => {
                const key = `${t.id}:${n}`,
                  person = people[key] ?? { gender: null, age_band: null };
                if (
                  skipFirst &&
                  n === 0 &&
                  t.id ===
                    types
                      .filter((t) => quantities[t.id] > 0)
                      .sort((a, b) => a.id.localeCompare(b.id))[0]?.id
                )
                  return (
                    <p className="helper" key={key}>
                      {t.name} · Asistente 1: tus datos se toman de Mi perfil.
                    </p>
                  );
                return (
                  <fieldset key={key}>
                    <legend>
                      {t.name} · Asistente {n + 1}
                    </legend>
                    <div className="form-grid">
                      <label className="field">
                        <span>
                          Género — {t.name} {n + 1}
                        </span>
                        <select
                          aria-label={`Género — ${t.name} ${n + 1}`}
                          value={person.gender ?? ""}
                          onChange={(ev) =>
                            onChange({
                              ...people,
                              [key]: {
                                ...person,
                                gender: (ev.target.value ||
                                  null) as Attendee["gender"],
                              },
                            })
                          }
                        >
                          <option value="">Sin dato</option>
                          {Object.entries(genders).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>
                          Rango de edad — {t.name} {n + 1}
                        </span>
                        <select
                          aria-label={`Rango de edad — ${t.name} ${n + 1}`}
                          value={person.age_band ?? ""}
                          onChange={(ev) =>
                            onChange({
                              ...people,
                              [key]: {
                                ...person,
                                age_band: (ev.target.value ||
                                  null) as Attendee["age_band"],
                              },
                            })
                          }
                        >
                          <option value="">Sin dato</option>
                          {Object.entries(ageBands).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </fieldset>
                );
              }),
            )}
        </div>
      )}
    </details>
  );
}
