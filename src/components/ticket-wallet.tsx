"use client";
import { useState } from "react";
import { useApp, Heading, Field, Badge, when, Empty } from "./app";
import { Orders } from "./operations";
export function DeleteAccount() {
  const { data, notify, refresh, navigate } = useApp();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel" style={{ marginTop: 22, maxWidth: 760 }}>
      <h2>Eliminar cuenta</h2>
      <p>
        Perderás el acceso a tu cuenta y se anularán tus entradas propias
        compradas y sin usar, incluidos sus QR. Los regalos ya aceptados por
        otra persona seguirán siendo de ella. No se realiza un reembolso
        automático. Se conserva el historial de ventas y auditoría.
      </p>
      <button className="btn danger" onClick={() => setOpen(true)}>
        Eliminar mi cuenta
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirmar eliminación de cuenta"
          className="image-confirm-backdrop"
        >
          <form
            className="panel"
            onSubmit={async (ev) => {
              ev.preventDefault();
              setBusy(true);
              const b = Object.fromEntries(new FormData(ev.currentTarget));
              try {
                const response = await fetch("/api/account", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(b),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                await refresh();
                navigate("/login?account=deleted");
              } catch (e) {
                notify((e as Error).message, true);
                setBusy(false);
              }
            }}
          >
            <h2>Esta acción es irreversible</h2>
            <p>
              Para continuar escribe ELIMINAR. Tus entradas propias sin usar
              serán anuladas y dejarán de permitir el ingreso.
            </p>
            <Field
              name="confirmation"
              label="Escribe ELIMINAR"
              pattern="ELIMINAR"
            />
            {!data.demo && (
              <Field
                name="password"
                label="Contraseña actual"
                type="password"
                autoComplete="current-password"
              />
            )}
            <div className="buttons" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancelar eliminación
              </button>
              <button className="btn danger" disabled={busy}>
                Eliminar cuenta y anular entradas
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
export function TicketWallet() {
  const { data, run, busy } = useApp();
  const [selected, setSelected] = useState<string[]>([]),
    [sending, setSending] = useState(false),
    [ages, setAges] = useState<Record<string, boolean>>({});
  const owned = data.tickets.filter((t) => t.owner_user_id === data.actor?.id);
  return (
    <>
      <Heading
        title="Mis entradas"
        subtitle="Consulta tus entradas, acepta regalos y transfiere entradas seleccionadas."
      />
      <section className="panel">
        <h2>Regalos y transferencias</h2>
        {data.transfers.length === 0 && (
          <Empty>No tienes entregas pendientes.</Empty>
        )}
        {data.transfers.map((r) => (
          <article key={r.id} className="panel" style={{ marginTop: 16 }}>
            <b>
              {r.kind === "gift" ? "Regalo" : "Transferencia"} ·{" "}
              {r.from_user_id === data.actor?.id ? "Enviado" : "Recibido"}
            </b>
            <p>
              {r.from_user_id === data.actor?.id
                ? r.recipient_email
                : `Enviado por ${r.from_name} · dirigido al correo de tu cuenta`}{" "}
              · Vence {when(r.expires_at)}
            </p>
            <Badge status={r.status} />
            {r.status === "pending" && (
              <div className="buttons" style={{ marginTop: 12 }}>
                {r.from_user_id === data.actor?.id ? (
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      run(
                        { action: "transfer_cancel", transfer_id: r.id },
                        "Entrega cancelada",
                      )
                    }
                  >
                    Cancelar entrega
                  </button>
                ) : (
                  <>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={ages[r.id] ?? false}
                        onChange={(e) =>
                          setAges({ ...ages, [r.id]: e.target.checked })
                        }
                      />
                      Confirmo que cumpliré la edad mínima de los eventos. Si
                      recibo varias entradas, los datos de Mi perfil describen
                      solo mi propia entrada.
                    </label>
                    <button
                      className="btn primary"
                      disabled={busy || !ages[r.id]}
                      onClick={() =>
                        run(
                          {
                            action: "transfer_resolve",
                            transfer_id: r.id,
                            accept: true,
                            admission_age_confirmed: ages[r.id],
                          },
                          "Entradas aceptadas",
                        )
                      }
                    >
                      Aceptar entradas
                    </button>
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() =>
                        run(
                          {
                            action: "transfer_resolve",
                            transfer_id: r.id,
                            accept: false,
                          },
                          "Entradas devueltas al remitente",
                        )
                      }
                    >
                      Rechazar
                    </button>
                  </>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
      <section className="panel" style={{ marginTop: 22 }}>
        <h2>Tus entradas individuales</h2>
        <p>
          Solo se transfieren entradas vigentes y sin usar. Mientras esperan
          aceptación no permiten ingresar. El destinatario debe tener una cuenta
          existente y confirmar su correo; tiene 7 días para aceptar.
        </p>
        {owned.length === 0 ? (
          <Empty>Aún no tienes entradas a tu nombre.</Empty>
        ) : (
          owned.map((t) => (
            <div className="summary-line" key={t.id}>
              <label>
                <input
                  type="checkbox"
                  aria-label={`Seleccionar ${t.visible_number}`}
                  disabled={t.status !== "valid" || t.transfer_pending}
                  checked={selected.includes(t.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, t.id]
                        : selected.filter((id) => id !== t.id),
                    )
                  }
                />{" "}
                {t.visible_number} ·{" "}
                {data.events.find((e) => e.id === t.event_id)?.title} ·{" "}
                {t.type_name}
              </label>
              <span>
                {t.transfer_pending ? (
                  "Pendiente de aceptación"
                ) : (
                  <Badge status={t.status} />
                )}
              </span>
              <a className="btn small" href={`/tickets/${t.order_id}`}>
                Ver entradas
              </a>
            </div>
          ))
        )}
        <button
          className="btn"
          disabled={!selected.length || busy}
          onClick={() => setSending(true)}
        >
          Transferir entradas seleccionadas ({selected.length})
        </button>
        {sending && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              const r = await run(
                {
                  action: "transfer_create",
                  ticket_ids: selected,
                  recipient_email: values.recipient_email,
                },
                "Transferencia enviada. El destinatario debe aceptarla.",
              );
              if (r) {
                setSelected([]);
                setSending(false);
              }
            }}
            style={{ marginTop: 18 }}
          >
            <Field
              name="recipient_email"
              label="Correo de una cuenta existente en Pase Central"
              type="email"
            />
            <p>
              El QR anterior quedará invalidado. Hasta la aceptación puedes
              cancelar la entrega; si vence, las entradas vuelven con un QR
              nuevo.
            </p>
            <div className="buttons">
              <button
                type="button"
                className="btn"
                onClick={() => setSending(false)}
              >
                Volver
              </button>
              <button className="btn primary" disabled={busy}>
                Enviar transferencia para aceptar
              </button>
            </div>
          </form>
        )}
      </section>
      <details style={{ marginTop: 22 }}>
        <summary>Historial de mis compras</summary>
        <Orders customer />
      </details>
    </>
  );
}
export function Organizations() {
  const { data, run, busy } = useApp();
  return (
    <>
      <Heading
        title="Organizaciones"
        subtitle="Crea y modifica los organizadores que puedes seleccionar al crear un evento."
      />
      {data.organizations.map((o) => (
        <form
          className="panel"
          style={{ marginBottom: 20 }}
          key={o.id}
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              {
                action: "organization_save",
                organization_id: o.id,
                ...Object.fromEntries(new FormData(e.currentTarget)),
              },
              "Organización actualizada",
            );
          }}
        >
          <Field
            name="name"
            label={`Nombre de ${o.name}`}
            defaultValue={o.name}
          />
          <button className="btn" disabled={busy}>
            Guardar organización
          </button>
        </form>
      ))}
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            {
              action: "organization_save",
              ...Object.fromEntries(new FormData(e.currentTarget)),
            },
            "Organización creada",
          );
        }}
      >
        <Field name="name" label="Nombre de la nueva organización" />
        <button className="btn primary" disabled={busy}>
          Crear organización
        </button>
      </form>
      <p className="helper">
        Crear una organización no concede acceso automáticamente a otras
        cuentas. Las invitaciones de trabajadores siguen asignándose por evento.
      </p>
    </>
  );
}
