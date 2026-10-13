"use client";
import { useEffect, useState } from "react";
import { useApp, Heading, Field } from "./app";
import { formValues } from "./operations";
export function MyProfile() {
  const { data, run, busy, refresh, notify } = useApp();
  const [uploading, setUploading] = useState(false);
  if (!data.actor || !data.profile)
    return (
      <a className="btn primary" href="/login">
        Iniciar sesión
      </a>
    );
  const p = data.profile;
  async function photo(file?: File, remove = false) {
    if (!file && !remove) return;
    setUploading(true);
    try {
      const body = new FormData();
      if (file) body.append("image", file);
      const response = await fetch("/api/profile/avatar", {
        method: remove ? "DELETE" : "POST",
        body: remove ? undefined : body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      notify(remove ? "Foto eliminada" : "Foto actualizada");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <Heading
        title="Mi perfil"
        subtitle="Tus datos de cuenta, contacto y foto de perfil"
      />
      <section className="panel" style={{ maxWidth: 760 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          {p.avatar_url ? (
            <img
              src={p.avatar_url}
              alt="Tu foto de perfil"
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              className="avatar"
              style={{ width: 96, height: 96, fontSize: 30 }}
            >
              {p.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <label htmlFor="profile-photo">Cambiar foto</label>
            <input
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                void photo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="helper">
              JPG, PNG o WebP · máximo 2 MB · foto privada
            </p>
            {p.avatar_url && (
              <button
                className="btn small"
                disabled={uploading}
                onClick={() => photo(undefined, true)}
              >
                Eliminar foto
              </button>
            )}
          </div>
        </div>
        <form
          key={p.updated_at}
          onSubmit={async (e) => {
            e.preventDefault();
            await run(
              { action: "profile_update", ...formValues(e.currentTarget) },
              "Perfil actualizado",
            );
          }}
        >
          <div className="section-stack">
            <Field
              name="name"
              label="Nombre completo"
              value={p.name}
              maxLength={150}
            />
            <Field
              name="email"
              label="Correo de acceso"
              value={data.actor.email}
              type="email"
              readOnly
              required={false}
            />
            <p className="helper">
              El correo identifica tu cuenta verificada. Los permisos solo los
              modifica un administrador.
            </p>
            <Field
              name="phone"
              label="Teléfono"
              value={p.phone ?? ""}
              maxLength={30}
              required={false}
            />
            <label htmlFor="profile-bio">Acerca de mí</label>
            <textarea
              id="profile-bio"
              name="bio"
              defaultValue={p.bio}
              maxLength={1000}
              rows={3}
            />
          </div>
          <div className="form-actions">
            <button className="btn primary" disabled={busy || uploading}>
              Guardar perfil
            </button>
            <a className="btn" href="/forgot-password">
              Cambiar contraseña
            </a>
          </div>
        </form>
      </section>
      <section className="panel" style={{ maxWidth: 760, marginTop: 20 }}>
        <h2>Mis permisos</h2>
        {data.permissions.admin ? (
          <p>Administrador global · acceso a todos los eventos.</p>
        ) : (
          <>
            <p>
              Cuenta de comprador. Tus permisos operativos se muestran por
              evento.
            </p>
            {data.events
              .filter(
                (e) =>
                  data.permissions.manage.includes(e.id) ||
                  data.permissions.sell.includes(e.id) ||
                  data.permissions.access.includes(e.id),
              )
              .map((e) => (
                <p key={e.id}>
                  <b>{e.title}</b> ·{" "}
                  {[
                    data.permissions.manage.includes(e.id) && "Organización",
                    data.permissions.sell.includes(e.id) && "Taquilla",
                    data.permissions.access.includes(e.id) && "Acceso",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ))}
          </>
        )}
      </section>
    </>
  );
}
export function AcceptInvitation() {
  const { data, run, busy, navigate, refresh } = useApp();
  const [credential, setCredential] = useState("");
  useEffect(() => {
    const value =
      location.hash.slice(1) || sessionStorage.getItem("pc-invitation") || "";
    if (/^[A-Za-z0-9_-]{43}$/.test(value)) {
      sessionStorage.setItem("pc-invitation", value);
      const timer = setTimeout(() => setCredential(value), 0);
      if (location.hash)
        history.replaceState(null, "", location.pathname + location.search);
      return () => clearTimeout(timer);
    }
    if (location.hash)
      history.replaceState(null, "", location.pathname + location.search);
  }, []);
  return (
    <>
      <Heading
        title="Tu invitación a Pase Central"
        subtitle="Una cuenta propia y permisos asignados por el administrador"
      />
      <section className="panel" style={{ maxWidth: 650 }}>
        <p>
          Inicia sesión o crea una cuenta con el mismo correo al que llegó la
          invitación y confirma tu correo. El rol y los eventos fueron definidos
          por el administrador.
        </p>
        {!credential ? (
          <p className="notice error">
            Abre el enlace de invitación que recibiste por correo.
          </p>
        ) : !data.actor ? (
          <a className="btn primary" href="/login">
            Iniciar sesión o crear cuenta
          </a>
        ) : (
          <>
            <p style={{ margin: "20px 0" }}>
              Cuenta actual: {data.actor.email}
            </p>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                const r = await run(
                  { action: "invite_accept", token: credential },
                  "Invitación aceptada",
                );
                if (r) {
                  sessionStorage.removeItem("pc-invitation");
                  setCredential("");
                  navigate("/account/profile");
                }
              }}
            >
              Aceptar invitación
            </button>
          </>
        )}
        <div className="form-actions">
          {data.actor && (
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                const response = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                });
                if (response.ok) {
                  await refresh();
                  navigate("/login");
                }
              }}
            >
              Usar otra cuenta
            </button>
          )}
          <button
            className="btn"
            disabled={busy}
            onClick={() => {
              sessionStorage.removeItem("pc-invitation");
              setCredential("");
              navigate("/events");
            }}
          >
            Ahora no
          </button>
        </div>
      </section>
    </>
  );
}
export function InviteTeam({ eventId }: { eventId?: string }) {
  const { data, run, busy } = useApp();
  const [role, setRole] = useState("access_staff"),
    [events, setEvents] = useState<string[]>(eventId ? [eventId] : []);
  if (!data.permissions.admin) return null;
  const scoped = ["organizer", "box_office", "access_staff"].includes(role);
  const names: Record<string, string> = {
    platform_admin: "Administrador global",
    organizer: "Organizador por evento",
    box_office: "Taquilla",
    access_staff: "Acceso",
    customer: "Comprador",
  };
  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <h2>Invitar a una persona</h2>
      <p className="helper" style={{ margin: "12px 0 20px" }}>
        Recibirá un correo para crear o usar su cuenta. Los permisos se activan
        al aceptar con el correo verificado.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const r = await run(
            {
              action: "invite_create",
              ...formValues(form),
              role,
              event_ids: scoped ? events : [],
            },
            "Invitación guardada. El correo se enviará automáticamente.",
          );
          if (r) {
            for (const name of ["name", "email"]) {
              const field = form.elements.namedItem(name);
              if (field instanceof HTMLInputElement) field.value = "";
            }
          }
        }}
      >
        <div className="form-grid">
          <Field name="name" label="Nombre de la persona" maxLength={150} />
          <Field name="email" label="Correo de la invitación" type="email" />
          <Field name="invitation-role" label="Rol de la invitación">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {Object.entries(names).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {scoped ? (
          <fieldset style={{ marginTop: 18 }}>
            <legend>Eventos asignados (puedes elegir varios)</legend>
            {data.events.map((e) => (
              <label className="inline-check" key={e.id}>
                <input
                  type="checkbox"
                  checked={events.includes(e.id)}
                  onChange={(ev) =>
                    setEvents(
                      ev.target.checked
                        ? [...events, e.id]
                        : events.filter((id) => id !== e.id),
                    )
                  }
                />
                {e.title}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="notice" style={{ marginTop: 18 }}>
            {role === "platform_admin"
              ? "Administrador global concede acceso a toda la plataforma."
              : "Comprador no concede permisos de operación."}
          </p>
        )}
        <div className="form-actions">
          <button
            className="btn primary"
            disabled={busy || (scoped && !events.length)}
          >
            Enviar invitación
          </button>
        </div>
      </form>
      {data.invitations.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 24 }}>
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol y eventos</th>
                <th>Invitación / correo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.invitations
                .filter((i) => !eventId || i.event_ids.includes(eventId))
                .map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.name}
                      <br />
                      {i.email}
                    </td>
                    <td>
                      {names[i.role]}
                      <br />
                      {i.event_ids
                        .map(
                          (id: string) =>
                            data.events.find((e) => e.id === id)?.title,
                        )
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                    <td>
                      {i.status === "accepted"
                        ? "Aceptada"
                        : i.status === "revoked"
                          ? "Revocada"
                          : new Date(i.expires_at) < new Date()
                            ? "Vencida"
                            : "Pendiente"}{" "}
                      ·{" "}
                      {i.email_status === "sent"
                        ? "Correo enviado"
                        : i.email_status === "failed"
                          ? "Error de correo"
                          : i.email_status === "processing"
                            ? "Enviando"
                            : "Correo en cola"}
                    </td>
                    <td>
                      {i.status === "pending" && (
                        <div className="buttons">
                          <button
                            className="btn small"
                            disabled={
                              busy ||
                              i.email_status === "processing" ||
                              new Date(i.expires_at) < new Date()
                            }
                            onClick={() =>
                              run(
                                {
                                  action: "invite_resend",
                                  invitation_id: i.id,
                                },
                                "Reenvío en cola",
                              )
                            }
                          >
                            Reenviar invitación
                          </button>
                          <button
                            className="btn small danger"
                            disabled={busy}
                            onClick={() =>
                              run(
                                {
                                  action: "invite_revoke",
                                  invitation_id: i.id,
                                },
                                "Invitación revocada",
                              )
                            }
                          >
                            Revocar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
