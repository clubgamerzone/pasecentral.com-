"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./app";
import type { Row } from "@/lib/db";
const roles = {
  organizer: "Administrador de evento",
  box_office: "Cajero / taquilla",
  access_staff: "Acceso / lector QR",
};
export function TeamEditor({ eventId }: { eventId?: string }) {
  const { data, run, busy } = useApp();
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [global, setGlobal] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editing && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [editing]);
  const events = data.events.filter(
    (e) =>
      data.permissions.manage.includes(e.id) && (!eventId || e.id === eventId),
  );
  const people = eventId
    ? data.people.filter(
        (p) =>
          data.staff.some(
            (s) => s.event_id === eventId && s.user_id === p.id,
          ) || p.id === data.actor?.id,
      )
    : data.people;
  const edit = (person: Row) => {
    setSaveError("");
    setEditing(person);
    setName(person.name);
    setGlobal(person.platform_admin);
    setAssignments(
      Object.fromEntries(
        events.map((e) => [
          e.id,
          data.staff
            .filter(
              (s) => s.event_id === e.id && s.user_id === person.id && s.active,
            )
            .map((s) => s.role),
        ]),
      ),
    );
  };
  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <h2>Usuarios y permisos</h2>
      <p className="helper" style={{ margin: "12px 0" }}>
        Edita los permisos de cada persona en tus eventos. Caja y acceso son
        independientes. Retirar un permiso no elimina su cuenta ni sus ventas.
      </p>
      <div className="team-user-list">
        {people.map((person) => (
          <article key={person.id}>
            <div>
              <strong>{person.name}</strong>
              <p className="helper">{person.email}</p>
              {person.platform_admin && (
                <span className="analytics-status">Administrador global</span>
              )}
              {events.map((event) => {
                const assigned = data.staff
                  .filter(
                    (s) =>
                      s.event_id === event.id &&
                      s.user_id === person.id &&
                      s.active,
                  )
                  .map((s) => roles[s.role as keyof typeof roles]);
                const inherited = person.managing_organizations?.includes(
                  event.organization_id,
                );
                return assigned.length || inherited ? (
                  <p className="helper" key={event.id}>
                    {event.title}:{" "}
                    {inherited
                      ? "Administración de organización (heredada)"
                      : assigned.join(" + ")}
                  </p>
                ) : null;
              })}
            </div>
            <button
              className="btn small"
              disabled={
                busy || (!data.permissions.admin && person.platform_admin)
              }
              onClick={() => edit(person)}
            >
              Editar permisos de {person.name}
            </button>
          </article>
        ))}
      </div>
      {editing && (
        <dialog
          ref={dialog}
          className="panel team-edit-dialog"
          aria-labelledby="team-edit-title"
          onCancel={(event) => {
            if (busy) event.preventDefault();
            else setEditing(null);
          }}
        >
          <h2 id="team-edit-title">Editar usuario y permisos</h2>
          <p className="helper">
            {editing.name} · {editing.email}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setSaveError("");
              const result = await run(
                {
                  action: "team_update",
                  user_id: editing.id,
                  ...(data.permissions.admin
                    ? { name, platform_admin: global }
                    : {}),
                  assignments: events.map((e) => ({
                    event_id: e.id,
                    roles: assignments[e.id] ?? [],
                  })),
                },
                "Usuario y permisos actualizados",
                setSaveError,
              );
              if (result) setEditing(null);
            }}
          >
            {saveError && (
              <p role="alert" className="notice">
                {saveError}
              </p>
            )}
            {data.permissions.admin && (
              <>
                <label className="field">
                  <span>Nombre del usuario</span>
                  <input
                    autoFocus
                    value={name}
                    required
                    maxLength={150}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={global}
                    onChange={(e) => setGlobal(e.target.checked)}
                  />
                  Administrador global (todos los eventos)
                </label>
              </>
            )}
            <p className="helper">
              Esta pantalla administra el nombre y los permisos de trabajo; no
              cambia el correo de inicio de sesión ni los datos personales del
              titular.
            </p>
            {events.map((e) => (
              <fieldset key={e.id} className="team-event-permissions">
                <legend>{e.title}</legend>
                {Object.entries(roles).map(([role, label]) => (
                  <label className="inline-check" key={role}>
                    <input
                      type="checkbox"
                      aria-label={`${label} — ${e.title}`}
                      checked={(assignments[e.id] ?? []).includes(role)}
                      onChange={(event) =>
                        setAssignments({
                          ...assignments,
                          [e.id]: event.target.checked
                            ? [...(assignments[e.id] ?? []), role]
                            : (assignments[e.id] ?? []).filter(
                                (r) => r !== role,
                              ),
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
                {(global ||
                  editing.managing_organizations?.includes(
                    e.organization_id,
                  )) && (
                  <p className="notice">
                    Esta cuenta también tiene permisos heredados de{" "}
                    {global ? "administrador global" : "su organización"}.
                    Desmarcar permisos del evento no retira ese acceso general.
                  </p>
                )}
              </fieldset>
            ))}
            <p className="helper">
              Administrador de evento incluye ventas y acceso. Sin ningún
              permiso marcado se retiran las asignaciones directas de ese
              evento. Los otros eventos se conservan.
            </p>
            {editing.id === data.actor?.id && (
              <p className="notice">
                Estás editando tus propios permisos. Podrías perder acceso a
                esta pantalla; el último administrador global está protegido.
              </p>
            )}
            <div className="buttons">
              <button className="btn primary" disabled={busy}>
                Guardar usuario y permisos
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancelar edición
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
