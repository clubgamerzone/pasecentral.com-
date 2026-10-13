"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Download,
  ScanLine,
  CheckCircle2,
  XCircle,
  Ticket,
  Wallet,
  FileText,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  useApp,
  Heading,
  Field,
  Badge,
  Empty,
  OrderTable,
  money,
  when,
} from "./app";
import type { Row } from "@/lib/db";
export const formValues = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form));
const iso = (v: FormDataEntryValue) => new Date(`${v}:00-05:00`).toISOString();
const local = (v: string | Date) =>
  new Date(new Date(v).getTime() - 5 * 3600000).toISOString().slice(0, 16);
export function EventEditor({
  eventId,
  tab,
}: {
  eventId: string | null;
  tab?: string;
}) {
  const { data, run, busy, navigate } = useApp();
  const e = data.events.find((e) => e.id === eventId),
    types = data.types.filter((t) => t.event_id === eventId),
    phases = data.phases.filter((p) =>
      types.some((t) => t.id === p.ticket_type_id),
    );
  if (!eventId)
    return (
      <>
        <Heading
          title="Cada gran noche empieza aquí"
          subtitle="Crea el evento y luego configura localidades, precios y equipo."
        />
        <section className="panel">
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              const b = formValues(ev.currentTarget);
              for (const k of [
                "starts_at",
                "ends_at",
                "admission_starts_at",
                "admission_ends_at",
              ])
                b[k] = iso(b[k]);
              const r = await run(
                { action: "create_event", ...b },
                "Evento creado como borrador",
              );
              if (r) navigate(`/admin/events/${r.event_id}`);
            }}
          >
            <div className="form-grid">
              <Field name="organization_id" label="Organización">
                <select id="organization_id" name="organization_id" required>
                  {data.organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="title" label="Nombre del evento" maxLength={300} />
              <Field
                name="slug"
                label="Dirección corta (minúsculas y guiones)"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
              />
              <Field
                name="capacity"
                label="Aforo total"
                type="number"
                min={1}
              />
              <Field name="venue_name" label="Nombre del recinto" />
              <Field name="address" label="Dirección" />
              <Field
                name="starts_at"
                label="Inicio del evento · Bogotá"
                type="datetime-local"
              />
              <Field
                name="ends_at"
                label="Fin del evento · Bogotá"
                type="datetime-local"
              />
              <Field
                name="admission_starts_at"
                label="Apertura de puertas · Bogotá"
                type="datetime-local"
              />
              <Field
                name="admission_ends_at"
                label="Cierre de puertas · Bogotá"
                type="datetime-local"
              />
              <div className="full">
                <label htmlFor="description">Descripción</label>
                <textarea
                  id="description"
                  name="description"
                  maxLength={5000}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn primary" disabled={busy}>
                <Plus />
                Crear borrador
              </button>
              <a href="/admin/events" className="btn">
                Cancelar
              </a>
            </div>
          </form>
        </section>
      </>
    );
  if (!e || !data.permissions.manage.includes(eventId))
    return <Empty>Evento no disponible.</Empty>;
  const page = tab ?? "settings";
  return (
    <>
      <Heading
        title={e.title}
        subtitle={`${e.venue_name} · ${when(e.starts_at)}`}
        action={<Badge status={e.status} />}
      />
      <nav className="tabs">
        {[
          ["settings", "Evento"],
          ["pricing", "Localidades y precios"],
          ["orders", "Ventas y entradas"],
          ["staff", "Equipo"],
        ].map(([key, label]) => (
          <a
            key={key}
            href={`/admin/events/${eventId}${key === "settings" ? "" : `/${key}`}`}
            className={page === key ? "active" : ""}
          >
            {label}
          </a>
        ))}
      </nav>
      {page === "settings" ? (
        <div className="split">
          <section className="panel">
            <h2>Detalles del evento</h2>
            <p style={{ margin: "20px 0" }}>
              {e.description || "Sin descripción"}
            </p>
            {[
              ["Aforo total", e.capacity],
              ["Dirección", e.address],
              ["Inicio", when(e.starts_at)],
              ["Fin", when(e.ends_at)],
              ["Apertura de puertas", when(e.admission_starts_at)],
              ["Cierre de puertas", when(e.admission_ends_at)],
            ].map(([label, value]) => (
              <div className="summary-line" key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
            <div className="notice" style={{ marginTop: 22 }}>
              Los cupos y precios pertenecen a este evento. Cambiar una fase no
              modifica las órdenes anteriores.
            </div>
          </section>
          <section className="panel">
            <h2>Estado y publicación</h2>
            <p style={{ margin: "15px 0 25px" }}>
              Para publicar, crea localidades y precios vigentes para web y
              taquilla.
            </p>
            <div className="section-stack">
              {e.status === "draft" && (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() =>
                    run(
                      {
                        action: "event_status",
                        event_id: eventId,
                        status: "published",
                      },
                      "Evento publicado en el catálogo",
                    )
                  }
                >
                  <CheckCircle2 />
                  Publicar evento
                </button>
              )}
              {e.status === "published" && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    run({
                      action: "event_status",
                      event_id: eventId,
                      status: "sales_closed",
                    })
                  }
                >
                  Cerrar ventas
                </button>
              )}
              {e.status === "sales_closed" && (
                <>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      run({
                        action: "event_status",
                        event_id: eventId,
                        status: "published",
                      })
                    }
                  >
                    Reabrir ventas
                  </button>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      run({
                        action: "event_status",
                        event_id: eventId,
                        status: "finished",
                      })
                    }
                  >
                    Finalizar evento
                  </button>
                </>
              )}
              {!["cancelled", "finished"].includes(e.status) && (
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "¿Cancelar el evento y anular todas sus entradas vigentes? Los cobros requieren devolución manual.",
                      )
                    )
                      run({
                        action: "event_status",
                        event_id: eventId,
                        status: "cancelled",
                      });
                  }}
                >
                  Cancelar evento
                </button>
              )}
              <a className="btn" href={`/admin/events/${eventId}/pricing`}>
                Configurar precios
              </a>
              <a className="btn" href={`/events/${e.slug}`}>
                Ver página pública
              </a>
            </div>
          </section>
        </div>
      ) : page === "pricing" ? (
        <div className="section-stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Localidades</h2>
              <span className="helper">
                Comparten el aforo total de {e.capacity}
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Localidad</th>
                    <th>Cupo</th>
                    <th>Comprometidas</th>
                    <th>Disponibles</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.capacity}</td>
                      <td>{t.committed}</td>
                      <td>{Math.max(0, t.capacity - t.committed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form
              onSubmit={async (ev) => {
                ev.preventDefault();
                const f = ev.currentTarget;
                if (
                  await run({
                    action: "add_type",
                    event_id: eventId,
                    ...formValues(f),
                  })
                )
                  f.reset();
              }}
              className="form-grid"
              style={{ marginTop: 23 }}
            >
              <Field
                name="name"
                label="Nueva localidad"
                placeholder="General o VIP"
              />
              <Field
                name="capacity"
                label="Cupo de la localidad"
                type="number"
                min={1}
                max={e.capacity}
              />
              <button className="btn primary" disabled={busy}>
                <Plus />
                Agregar localidad
              </button>
            </form>
          </section>
          <section className="panel">
            <h2>Fases de precio</h2>
            <p className="compact" style={{ margin: "12px 0 20px" }}>
              Las fases activas no pueden superponerse para la misma localidad y
              canal.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Localidad / fase</th>
                    <th>Canal</th>
                    <th>Precio</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {phases.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {types.find((t) => t.id === p.ticket_type_id)?.name} /{" "}
                        {p.name}
                      </td>
                      <td>{p.channel === "web" ? "Web" : "Taquilla"}</td>
                      <td>{money(p.price_cop)}</td>
                      <td>{when(p.starts_at)}</td>
                      <td>{when(p.ends_at)}</td>
                      <td>{p.active ? "Activa" : "Inactiva"}</td>
                      <td>
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() =>
                            run({
                              action: "phase_active",
                              event_id: eventId,
                              phase_id: p.id,
                              active: !p.active,
                            })
                          }
                        >
                          {p.active ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {types.length > 0 && (
              <form
                style={{ marginTop: 25 }}
                onSubmit={async (ev) => {
                  ev.preventDefault();
                  const b = formValues(ev.currentTarget);
                  b.starts_at = iso(b.starts_at);
                  b.ends_at = iso(b.ends_at);
                  await run({ action: "add_phase", event_id: eventId, ...b });
                }}
              >
                <div className="form-grid">
                  <Field name="ticket_type_id" label="Localidad">
                    <select id="ticket_type_id" name="ticket_type_id">
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field name="channel" label="Canal">
                    <select name="channel" id="channel">
                      <option value="web">Online</option>
                      <option value="box_office">Taquilla</option>
                    </select>
                  </Field>
                  <Field
                    name="name"
                    label="Nombre de la fase"
                    placeholder="Preventa 1"
                  />
                  <Field
                    name="price_cop"
                    label="Precio en COP"
                    type="number"
                    min={0}
                  />
                  <Field
                    name="starts_at"
                    label="Inicio · Bogotá"
                    type="datetime-local"
                    value={local(new Date())}
                  />
                  <Field
                    name="ends_at"
                    label="Fin · Bogotá"
                    type="datetime-local"
                    value={local(e.ends_at)}
                  />
                </div>
                <div className="form-actions">
                  <button className="btn primary" disabled={busy}>
                    <Plus />
                    Agregar fase
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : page === "staff" ? (
        <UserManagement eventId={eventId} />
      ) : page === "orders" ? (
        <Orders eventId={eventId} />
      ) : (
        <Empty>Sección no encontrada.</Empty>
      )}
    </>
  );
}
export function UserManagement({ eventId }: { eventId?: string }) {
  const { data, run, busy } = useApp();
  const [event, setEvent] = useState(
    eventId ?? data.permissions.manage[0] ?? "",
  );
  return (
    <>
      {!eventId && (
        <Heading
          title="Un equipo, una gran noche"
          subtitle="Los permisos de taquilla y acceso se asignan a cada evento."
        />
      )}
      <section className="panel">
        <h2>Asignar personal</h2>
        <p className="compact" style={{ margin: "12px 0 23px" }}>
          Cada persona debe tener primero una cuenta verificada. Las categorías
          de comprador no conceden permisos.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await run({
              action: "staff",
              event_id: event,
              ...formValues(e.currentTarget),
              active: true,
            });
          }}
        >
          <div className="form-grid">
            <Field name="event" label="Evento">
              <select
                id="event"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
              >
                {data.events
                  .filter((e) => data.permissions.manage.includes(e.id))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
              </select>
            </Field>
            <Field name="user_id" label="Usuario registrado">
              <select id="user_id" name="user_id">
                {data.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.email}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="role" label="Rol operativo">
              <select name="role" id="role">
                <option value="box_office">Taquilla</option>
                <option value="access_staff">Acceso</option>
              </select>
            </Field>
          </div>
          <div className="form-actions">
            <button className="btn primary" disabled={busy || !event}>
              <Plus />
              Asignar permiso
            </button>
          </div>
        </form>
        <div className="table-wrap" style={{ marginTop: 25 }}>
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.staff
                .filter((s) => s.event_id === event)
                .map((s) => (
                  <tr key={`${s.user_id}-${s.role}`}>
                    <td>{data.people.find((p) => p.id === s.user_id)?.name}</td>
                    <td>{s.role === "box_office" ? "Taquilla" : "Acceso"}</td>
                    <td>{s.active ? "Activo" : "Desactivado"}</td>
                    <td>
                      <button
                        className="btn small"
                        disabled={busy}
                        onClick={() =>
                          run({ action: "staff", ...s, active: !s.active })
                        }
                      >
                        {s.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      {data.permissions.admin && !eventId && (
        <section className="panel" style={{ marginTop: 23 }}>
          <h2>Organizadores</h2>
          <form
            style={{ marginTop: 20 }}
            onSubmit={(e) => {
              e.preventDefault();
              run({
                action: "member",
                ...formValues(e.currentTarget),
                active: true,
              });
            }}
          >
            <div className="form-grid">
              <Field name="organization_id" label="Organización">
                <select name="organization_id" id="organization_id">
                  {data.organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="user_id" label="Organizador">
                <select name="user_id" id="user_id">
                  {data.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-actions">
              <button className="btn primary" disabled={busy}>
                Asignar organizador
              </button>
            </div>
          </form>
          {data.members.map((m) => (
            <div
              className="summary-line"
              key={`${m.organization_id}-${m.user_id}`}
            >
              <span>{data.people.find((p) => p.id === m.user_id)?.name}</span>
              <button
                className="btn small danger"
                onClick={() =>
                  run({
                    action: "member",
                    organization_id: m.organization_id,
                    user_id: m.user_id,
                    active: false,
                  })
                }
              >
                Retirar rol
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
export function BoxOffice() {
  const { data, run, busy, navigate } = useApp();
  const [event, setEvent] = useState(data.permissions.sell[0] ?? ""),
    [method, setMethod] = useState("cash"),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [key, setKey] = useState(() => crypto.randomUUID());
  const e = data.events.find((e) => e.id === event),
    types = data.types.filter((t) => t.event_id === event && t.active),
    prices = types.map((t) => ({
      t,
      p: data.phases.find(
        (p) =>
          p.ticket_type_id === t.id &&
          p.channel === "box_office" &&
          p.active &&
          new Date(p.starts_at) <= new Date() &&
          new Date(p.ends_at) > new Date(),
      ),
    })),
    total = prices.reduce(
      (s, { t, p }) =>
        s +
        (method === "complimentary" ? 0 : (p?.price_cop ?? 0)) *
          (quantities[t.id] ?? 0),
      0,
    ),
    session = data.sessions.find(
      (s) =>
        s.event_id === event &&
        s.operator_id === data.actor?.id &&
        !s.closed_at,
    );
  return (
    <>
      <Heading
        title="Taquilla, sin filas de más"
        subtitle="Registra el cobro y emite cada entrada en una sola operación."
      />
      <div className="split">
        <section className="panel">
          <Field name="active-event" label="Evento activo">
            <select
              id="active-event"
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setQuantities({});
                setKey(crypto.randomUUID());
              }}
            >
              {data.events
                .filter((e) => data.permissions.sell.includes(e.id))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
            </select>
          </Field>
          {e && (
            <p className="helper">
              {e.available} lugares disponibles · {e.venue_name}
            </p>
          )}
          <h3 style={{ marginTop: 27 }}>Selecciona las entradas</h3>
          {prices.map(({ t, p }) => (
            <div className="buy-line" key={t.id}>
              <div>
                <b>{t.name}</b>
                <p>
                  {method === "complimentary"
                    ? "Cortesía autorizada"
                    : p
                      ? `${p.name} · ${money(p.price_cop)}`
                      : "Sin precio vigente"}
                </p>
                <p>{Math.max(0, t.capacity - t.committed)} disponibles</p>
              </div>
              <select
                aria-label={`Cantidad ${t.name}`}
                value={quantities[t.id] ?? 0}
                onChange={(e) =>
                  setQuantities({
                    ...quantities,
                    [t.id]: Number(e.target.value),
                  })
                }
              >
                {Array.from({ length: 21 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Cobro y emisión</h2>
          {method === "cash" && !session && (
            <div className="notice" style={{ marginTop: 18 }}>
              Abre tu caja para vender en efectivo.{" "}
              <a className="link" href="/box-office/cash-session">
                Ir a caja
              </a>
            </div>
          )}
          <form
            style={{ marginTop: 22 }}
            onSubmit={async (ev) => {
              ev.preventDefault();
              const b = formValues(ev.currentTarget);
              const r = await run(
                {
                  action: "sell",
                  event_id: event,
                  items: Object.entries(quantities)
                    .filter(([, n]) => n > 0)
                    .map(([ticket_type_id, quantity]) => ({
                      ticket_type_id,
                      quantity,
                    })),
                  ...b,
                  method,
                  verified: b.verified === "on",
                  idempotency_key: key,
                },
                "Venta confirmada. Entradas emitidas.",
              );
              if (r) {
                setKey(crypto.randomUUID());
                navigate(`/tickets/${r.order_id}`);
              }
            }}
          >
            <div className="section-stack">
              <Field name="method" label="Medio de cobro">
                <select
                  id="method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia verificada</option>
                  {data.permissions.manage.includes(event) && (
                    <option value="complimentary">Cortesía autorizada</option>
                  )}
                </select>
              </Field>
              <Field
                name="buyer_name"
                label="Nombre del comprador (opcional)"
                required={false}
              />
              <Field
                name="buyer_email"
                label="Email para entrega digital (opcional)"
                type="email"
                required={false}
              />
              <Field
                name="buyer_phone"
                label="Teléfono (opcional)"
                required={false}
              />
              <Field
                name="buyer_category"
                label="Categoría de comprador (opcional)"
                required={false}
              />
              {method === "transfer" && (
                <>
                  <Field name="reference" label="Referencia de transferencia" />
                  <label className="inline-check">
                    <input name="verified" type="checkbox" required />
                    Confirmé el importe en la cuenta del comercio
                  </label>
                </>
              )}
              {method === "complimentary" && (
                <Field name="reason" label="Motivo de la cortesía" />
              )}
            </div>
            <div className="summary-line total">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            <p className="helper">
              La cuenta de comprador no se asigna por un email escrito en
              taquilla. El contacto solo se usa para entrega digital.
            </p>
            <button
              className="btn primary"
              style={{ width: "100%", marginTop: 20 }}
              disabled={
                busy ||
                (method === "cash" && !session) ||
                e?.status !== "published"
              }
            >
              <Ticket />
              Confirmar cobro y emitir
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
export function Cash() {
  const { data, run, busy } = useApp();
  const [event, setEvent] = useState(data.permissions.sell[0] ?? ""),
    active = data.sessions.find(
      (s) =>
        s.event_id === event &&
        s.operator_id === data.actor?.id &&
        !s.closed_at,
    ),
    movements = data.movements.filter((m) => m.cash_session_id === active?.id),
    expected =
      (active?.opening_cash_cop ?? 0) +
      movements.reduce(
        (s, m) =>
          s +
          (["out", "refund"].includes(m.type) ? -m.amount_cop : m.amount_cop),
        0,
      );
  return (
    <>
      <Heading
        title="Tu caja, al día"
        subtitle="Control de efectivo por evento y operador. Transferencias y pagos online se contabilizan por separado."
      />
      <section className="panel" style={{ marginBottom: 22 }}>
        <Field name="cash-event" label="Evento de la caja">
          <select
            id="cash-event"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          >
            {data.events
              .filter((e) => data.permissions.sell.includes(e.id))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
          </select>
        </Field>
      </section>
      {!active ? (
        <section className="panel">
          <h2>Apertura de caja</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run({
                action: "cash_open",
                event_id: event,
                ...formValues(e.currentTarget),
              });
            }}
            style={{ marginTop: 23, maxWidth: 400 }}
          >
            <Field
              name="opening_cash_cop"
              label="Fondo inicial en COP"
              type="number"
              min={0}
              value={0}
            />
            <div className="form-actions">
              <button className="btn primary" disabled={busy}>
                <Wallet />
                Abrir caja
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="split">
          <section className="panel">
            <h2>Caja abierta</h2>
            <div className="summary-line">
              <span>Fondo inicial</span>
              <b>{money(active.opening_cash_cop)}</b>
            </div>
            <div className="summary-line total">
              <span>Efectivo esperado</span>
              <b>{money(expected)}</b>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Movimiento</th>
                    <th>Motivo</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td>{m.type}</td>
                      <td>{m.reason}</td>
                      <td>{money(m.amount_cop)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form
              style={{ marginTop: 25 }}
              onSubmit={(e) => {
                e.preventDefault();
                run({
                  action: "cash_move",
                  event_id: event,
                  session_id: active.id,
                  ...formValues(e.currentTarget),
                });
              }}
            >
              <div className="form-grid">
                <Field name="type" label="Tipo de movimiento">
                  <select id="type" name="type">
                    <option value="in">Entrada de efectivo</option>
                    <option value="out">Salida de efectivo</option>
                  </select>
                </Field>
                <Field
                  name="amount_cop"
                  label="Importe COP"
                  type="number"
                  min={0}
                />
                <Field name="reason" label="Motivo" />
              </div>
              <div className="form-actions">
                <button className="btn" disabled={busy}>
                  Registrar movimiento
                </button>
              </div>
            </form>
          </section>
          <section className="panel">
            <h2>Cierre de caja</h2>
            <p style={{ margin: "12px 0 25px" }}>
              Cuenta el efectivo físico y registra el valor declarado. El cierre
              conservará cualquier diferencia.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (confirm("¿Cerrar esta caja con el efectivo declarado?"))
                  run({
                    action: "cash_close",
                    event_id: event,
                    session_id: active.id,
                    ...formValues(e.currentTarget),
                  });
              }}
            >
              <Field
                name="declared_cash_cop"
                label="Efectivo declarado COP"
                type="number"
                min={0}
              />
              <div style={{ marginTop: 18 }}>
                <Field name="notes" label="Observaciones" required={false} />
              </div>
              <div className="form-actions">
                <button className="btn primary" disabled={busy}>
                  Cerrar caja
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      <section className="panel" style={{ marginTop: 23 }}>
        <h2>Historial de cierres</h2>
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Apertura</th>
                <th>Cierre</th>
                <th>Esperado</th>
                <th>Declarado</th>
                <th>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions
                .filter((s) => s.event_id === event && s.closed_at)
                .map((s) => (
                  <tr key={s.id}>
                    <td>{when(s.opened_at)}</td>
                    <td>{when(s.closed_at)}</td>
                    <td>{money(s.expected_cash_cop)}</td>
                    <td>{money(s.declared_cash_cop)}</td>
                    <td>{money(s.difference_cop)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
const resultNames: Record<string, string> = {
  accepted: "Ingreso autorizado",
  already_used: "Entrada ya utilizada",
  cancelled: "Entrada anulada",
  wrong_event: "Entrada de otro evento",
  outside_admission_window: "Fuera del horario de ingreso",
  unknown_ticket: "Entrada no encontrada",
  unauthorized: "Operador no autorizado",
};
export function Access() {
  const { data, run, busy } = useApp();
  const [device, setDevice] = useState("EDA51-01"),
    [gate, setGate] = useState("Puerta principal"),
    [credential, setCredential] = useState(""),
    [result, setResult] = useState<Row | null>(null),
    [search, setSearch] = useState(""),
    [popup, setPopup] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    sending = useRef(false),
    pending = useRef<{ credential: string; request_id: string } | null>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const scan = useCallback(async () => {
    const value = credential.trim();
    if (!value || busy || sending.current) return;
    sending.current = true;
    setPopup(false);
    setResult(null);
    if (!pending.current || pending.current.credential !== value)
      pending.current = { credential: value, request_id: crypto.randomUUID() };
    const r = await run(
      {
        action: "scan_auto",
        ...pending.current,
        device_id: device,
        gate_label: gate,
      },
      "",
    );
    if (r) {
      setResult(r);
      setCredential("");
      pending.current = null;
    } else setResult({ result: "network_error" });
    sending.current = false;
    setPopup(true);
    input.current?.focus();
  }, [credential, busy, run, device, gate]);
  useEffect(() => {
    if (!credential.trim() || busy || pending.current) return;
    const timer = setTimeout(() => {
      void scan();
    }, 350);
    return () => clearTimeout(timer);
  }, [credential, busy, scan]);
  useEffect(() => {
    if (!popup) return;
    const timer = setTimeout(() => setPopup(false), 2500);
    return () => clearTimeout(timer);
  }, [popup, result]);
  const found =
    search.length > 2
      ? data.tickets
          .filter(
            (t) =>
              data.permissions.access.includes(t.event_id) &&
              (t.visible_number.toLowerCase().includes(search.toLowerCase()) ||
                t.security_serial.toLowerCase().includes(search.toLowerCase())),
          )
          .slice(0, 8)
      : [];
  return (
    <>
      <Heading
        title="La puerta a una gran noche"
        subtitle="Escanea y valida · evento identificado por el QR · un solo ingreso por entrada"
      />
      <div className="scan-panel">
        <section className="panel">
          <div className="section-stack">
            <p className="helper">
              El QR identifica el evento. Solo puedes autorizar entradas de los
              eventos donde tienes permiso de acceso.
            </p>
            <div className="form-grid">
              <Field name="device" label="Identificador del equipo">
                <input
                  id="device"
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  required
                />
              </Field>
              <Field name="gate" label="Puerta">
                <input
                  id="gate"
                  value={gate}
                  onChange={(e) => setGate(e.target.value)}
                  required
                />
              </Field>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                scan();
              }}
            >
              <label htmlFor="credential">Escanea el QR de la entrada</label>
              <input
                ref={input}
                id="credential"
                autoComplete="off"
                value={credential}
                placeholder="Listo para recibir una lectura…"
                onChange={(e) => {
                  const value = e.target.value;
                  setPopup(false);
                  setResult(null);
                  if (pending.current?.credential !== value.trim())
                    pending.current = null;
                  setCredential(value);
                }}
                readOnly={busy}
              />
              <div className="form-actions">
                <button
                  className="btn primary"
                  style={{ width: "100%" }}
                  disabled={busy || !data.permissions.access.length}
                >
                  <ScanLine />
                  Validar entrada
                </button>
              </div>
            </form>
            {busy && (
              <p role="status">Verificando entrada… espera el resultado.</p>
            )}
            <p className="helper">
              Si la red falla, no autorices el ingreso. Un reintento de la misma
              lectura conserva su identificador para recuperar el resultado
              original.
            </p>
          </div>
        </section>
        {popup && result && (
          <div
            role="alert"
            className={`scan-popup ${result.result === "accepted" ? "accepted" : "rejected"}`}
          >
            <h2>
              {resultNames[result.result] ?? "Error de conexión o servidor"}
            </h2>
            {result.event_title && <p>{result.event_title}</p>}
            {result.visible_number && (
              <p className="code">{result.visible_number}</p>
            )}
            <p>
              {result.result === "accepted"
                ? "Permitir ingreso"
                : "No autorices el ingreso"}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPopup(false);
                input.current?.focus();
              }}
            >
              Continuar
            </button>
          </div>
        )}
        {result && (
          <div
            role="status"
            className={`scan-result ${result.result === "accepted" ? "" : "rejected"}`}
          >
            {result.result === "accepted" ? <CheckCircle2 /> : <XCircle />}
            <h2>
              {resultNames[result.result] ?? "Error de conexión o servidor"}
            </h2>
            <p>
              {result.visible_number ??
                (result.result === "network_error"
                  ? "No autorices el ingreso. Recupera la conexión y reintenta."
                  : "Verifica la entrada y tus permisos de acceso.")}
            </p>
            {result.event_title && <p>{result.event_title}</p>}
          </div>
        )}
        <section className="panel" style={{ marginTop: 22 }}>
          <h2>Consulta manual</h2>
          <p className="helper" style={{ margin: "12px 0" }}>
            El consecutivo y el serial sirven para buscar. El ingreso manual
            exige confirmación y motivo.
          </p>
          <input
            aria-label="Buscar entrada por número o serial"
            placeholder="Número o serial…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {found.map((t) => (
            <div className="summary-line" key={t.id}>
              <div>
                <b className="code">{t.visible_number}</b>
                <p className="helper">{t.security_serial}</p>
                <Badge status={t.status} />
              </div>
              <button
                className="btn small"
                disabled={busy}
                onClick={async () => {
                  const reason = prompt(
                    "Motivo del ingreso manual (mínimo 5 caracteres):",
                  );
                  if (
                    !reason ||
                    !confirm(`¿Autorizar ingreso de ${t.visible_number}?`)
                  )
                    return;
                  const r = await run(
                    {
                      action: "manual_checkin",
                      event_id: t.event_id,
                      ticket_id: t.id,
                      request_id: crypto.randomUUID(),
                      device_id: device,
                      gate_label: gate,
                      reason,
                    },
                    "",
                  );
                  if (r) setResult(r);
                }}
              >
                Ingreso manual
              </button>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
export function Orders({
  customer = false,
  eventId,
  orderId,
}: {
  customer?: boolean;
  eventId?: string;
  orderId?: string;
}) {
  const { data, run, busy } = useApp();
  const [selected, setSelected] = useState(""),
    [ticketIds, setTicketIds] = useState<string[]>([]),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState(""),
    [reference, setReference] = useState("");
  const orders = data.orders.filter(
      (o) =>
        (!eventId || o.event_id === eventId) &&
        (!orderId || o.id === orderId) &&
        (!customer || o.buyer_user_id === data.actor?.id),
    ),
    order = orders.find((o) => o.id === selected);
  return (
    <>
      {!eventId && (
        <Heading
          title={
            customer ? "Tus entradas, siempre contigo" : "Ventas y entradas"
          }
          subtitle={
            customer
              ? "Consulta tus órdenes, descarga tus entradas y prepara tu próxima noche."
              : "Consulta órdenes y registra operaciones con auditoría."
          }
        />
      )}
      <section className="panel">
        <OrderTable orders={orders} />
      </section>
      {!customer && (
        <section className="panel" style={{ marginTop: 22 }}>
          <h2>Gestionar una orden</h2>
          <div style={{ margin: "20px 0" }}>
            <Field name="order" label="Orden">
              <select
                id="order"
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setTicketIds([]);
                }}
              >
                <option value="">Selecciona una orden</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id.slice(0, 8)} · {o.buyer_name || "Anónima"} ·{" "}
                    {money(o.total_cop)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {order && (
            <>
              <div className="buttons">
                <button
                  className="btn small"
                  disabled={busy}
                  onClick={() => run({ action: "resend", order_id: order.id })}
                >
                  <Send />
                  Reintentar email
                </button>
                <button
                  className="btn small"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("¿Invalidar el enlace compartido anterior?"))
                      run({ action: "revoke_share", order_id: order.id });
                  }}
                >
                  Revocar enlace compartido
                </button>
                {data.permissions.manage.includes(order.event_id) && (
                  <button
                    className="btn small"
                    disabled={busy}
                    onClick={() => {
                      const id = prompt(
                        "ID de transacción Wompi para consultar y conciliar:",
                      );
                      if (id)
                        run({
                          action: "reconcile",
                          order_id: order.id,
                          transaction_id: id,
                        });
                    }}
                  >
                    <RefreshCw />
                    Conciliar Wompi
                  </button>
                )}
              </div>
              <div className="table-wrap" style={{ marginTop: 20 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Devolver</th>
                      <th>Número</th>
                      <th>Serial</th>
                      <th>Localidad</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tickets
                      .filter((t) => t.order_id === order.id)
                      .map((t) => (
                        <tr key={t.id}>
                          <td>
                            <input
                              aria-label={`Devolver ${t.visible_number}`}
                              type="checkbox"
                              checked={ticketIds.includes(t.id)}
                              onChange={(e) =>
                                setTicketIds(
                                  e.target.checked
                                    ? [...ticketIds, t.id]
                                    : ticketIds.filter((id) => id !== t.id),
                                )
                              }
                            />
                          </td>
                          <td className="code">{t.visible_number}</td>
                          <td className="code">{t.security_serial}</td>
                          <td>{t.type_name}</td>
                          <td>
                            <Badge status={t.status} />
                          </td>
                          <td>
                            {data.permissions.manage.includes(order.event_id) &&
                              t.status === "valid" && (
                                <div className="buttons">
                                  <button
                                    className="btn small danger"
                                    onClick={() => {
                                      const r = prompt(
                                        "Motivo de anulación (mínimo 5 caracteres):",
                                      );
                                      if (r)
                                        run({
                                          action: "cancel_ticket",
                                          ticket_id: t.id,
                                          reason: r,
                                        });
                                    }}
                                  >
                                    Anular
                                  </button>
                                  <button
                                    className="btn small"
                                    onClick={() => {
                                      const r = prompt(
                                        "Motivo de sustitución del QR (mínimo 5 caracteres):",
                                      );
                                      if (r)
                                        run({
                                          action: "replace_ticket",
                                          ticket_id: t.id,
                                          reason: r,
                                        });
                                    }}
                                  >
                                    Sustituir QR
                                  </button>
                                </div>
                              )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {data.permissions.manage.includes(order.event_id) && (
                <form
                  style={{ marginTop: 25 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      confirm(
                        "¿Registrar la devolución realizada y anular las entradas seleccionadas?",
                      )
                    )
                      run({
                        action: "refund",
                        order_id: order.id,
                        ticket_ids: ticketIds,
                        amount_cop: Number(amount),
                        reason,
                        external_reference: reference,
                      });
                  }}
                >
                  <h3>Registrar devolución manual</h3>
                  <p className="helper" style={{ marginBottom: 15 }}>
                    Realiza la devolución fuera de la aplicación y registra aquí
                    la referencia. No se envía dinero automáticamente. Para un
                    pago tardío sin boletas, deja la selección vacía.
                  </p>
                  <div className="form-grid">
                    <Field name="refund-amount" label="Importe devuelto COP">
                      <input
                        id="refund-amount"
                        type="number"
                        min={0}
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </Field>
                    <Field name="refund-reference" label="Referencia externa">
                      <input
                        id="refund-reference"
                        required
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </Field>
                    <Field name="refund-reason" label="Motivo">
                      <input
                        id="refund-reason"
                        required
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="form-actions">
                    <button className="btn danger" disabled={busy}>
                      Registrar devolución
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
export function Reports() {
  const { data } = useApp();
  const [event, setEvent] = useState("");
  const orders = data.orders.filter(
    (o) =>
      data.permissions.manage.includes(o.event_id) &&
      (!event || o.event_id === event),
  );
  const ids = orders.map((o) => o.id),
    lines = data.items.filter(
      (i) =>
        ids.includes(i.order_id) &&
        orders.some(
          (o) =>
            o.id === i.order_id &&
            ["confirmed", "partially_refunded", "refunded"].includes(o.status),
        ),
    );
  const grouped = (key: "phase_name" | "type_name") =>
    Object.entries(
      lines.reduce<Record<string, { qty: number; total: number }>>((r, i) => {
        const k = i[key];
        r[k] ??= { qty: 0, total: 0 };
        r[k].qty += i.quantity;
        r[k].total += i.line_total_cop;
        return r;
      }, {}),
    );
  return (
    <>
      <Heading
        title="Los números detrás de la noche"
        subtitle="Ventas, asistencia, caja e incidencias. Exportaciones privadas para tu organización."
      />
      <section className="panel" style={{ marginBottom: 22 }}>
        <Field name="report-event" label="Filtrar por evento">
          <select
            id="report-event"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          >
            <option value="">Todos los eventos</option>
            {data.events
              .filter((e) => data.permissions.manage.includes(e.id))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
          </select>
        </Field>
      </section>
      <div className="report-grid">
        {[
          ["sales", "Ventas", "Órdenes, canal, importes y estado."],
          [
            "attendees",
            "Asistentes",
            "Entradas emitidas y estado de ingreso, sin tokens QR.",
          ],
          [
            "cash",
            "Cierres de caja",
            "Fondo, efectivo declarado y diferencias.",
          ],
          [
            "incidents",
            "Pendientes e incidencias",
            "Reservas, vencimientos y pagos que requieren revisión.",
          ],
        ].map(([key, title, desc]) => (
          <section className="panel report-card" key={key}>
            <FileText size={22} />
            <h3 style={{ marginTop: 14 }}>{title}</h3>
            <p>{desc}</p>
            <a
              className="btn"
              href={`/api/reports?kind=${key}${event ? `&event=${event}` : ""}`}
            >
              <Download />
              Exportar CSV
            </a>
          </section>
        ))}
      </div>
      <div className="report-grid" style={{ marginTop: 22 }}>
        {(["type_name", "phase_name"] as const).map((key) => (
          <section className="panel" key={key}>
            <h2>
              {key === "type_name" ? "Ventas por localidad" : "Ventas por fase"}
            </h2>
            <div className="table-wrap" style={{ marginTop: 20 }}>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Entradas</th>
                    <th>Importe de venta</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped(key).map(([name, r]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{r.qty}</td>
                      <td>{money(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      <section className="panel" style={{ marginTop: 22 }}>
        <h2>Ventas por canal y operador</h2>
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Operador</th>
                <th>Canal</th>
                <th>Órdenes confirmadas</th>
                <th>Importe de venta</th>
              </tr>
            </thead>
            <tbody>
              {data.people.flatMap((p) =>
                ["web", "box_office", "complimentary"].map((channel) => {
                  const rows = orders.filter(
                    (o) =>
                      o.created_by === p.id &&
                      o.channel === channel &&
                      ["confirmed", "partially_refunded", "refunded"].includes(
                        o.status,
                      ),
                  );
                  return rows.length ? (
                    <tr key={`${p.id}-${channel}`}>
                      <td>{p.name}</td>
                      <td>{channel}</td>
                      <td>{rows.length}</td>
                      <td>
                        {money(rows.reduce((s, o) => s + o.total_cop, 0))}
                      </td>
                    </tr>
                  ) : null;
                }),
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 22 }}>
        <h2>Auditoría de operaciones</h2>
        <p className="helper">
          Registro protegido sin edición desde la aplicación. No contiene QR
          secretos.
        </p>
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Operación</th>
                <th>Entidad</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {data.audit.map((l) => (
                <tr key={l.id}>
                  <td>{when(l.created_at)}</td>
                  <td>{l.action}</td>
                  <td>
                    {l.entity_type} · {l.entity_id?.slice(0, 8)}
                  </td>
                  <td>
                    {data.people.find((p) => p.id === l.actor_id)?.name ??
                      "Sistema"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
