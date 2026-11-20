"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp, Heading, Field, Empty, money, when } from "./app";
import { browserId } from "@/lib/browser-id";
import type { Row } from "@/lib/db";
import { OpenCashDialog } from "./cash-opening";
import { ticketCounter } from "@/lib/ticket-number";
import { PreprintActionDialog } from "./preprint-actions";

export function Preprints() {
  const { data, run, busy, navigate } = useApp();
  const initialEvent = useSearchParams().get("event");
  const [event, setEvent] = useState(
    data.permissions.sell.includes(initialEvent ?? "")
      ? initialEvent!
      : (data.permissions.sell[0] ?? ""),
  );
  const [inventory, setInventory] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [mode, setMode] = useState<"stock" | "activate">("stock");
  const [typeId, setTypeId] = useState(""),
    [phaseId, setPhaseId] = useState(""),
    [block, setBlock] = useState<Row | null>(null);
  const [credential, setCredential] = useState(""),
    [found, setFound] = useState<Row | null>(null),
    [saleKey, setSaleKey] = useState(browserId);
  const [createKey, setCreateKey] = useState(browserId),
    [method, setMethod] = useState("cash"),
    [digital, setDigital] = useState(false),
    [cash, setCash] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    if (!event) return;
    const r = await fetch(`/api/preprints?event_id=${event}`, {
      cache: "no-store",
    });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error ?? "No se pudo consultar el inventario");
    return b;
  }, [event]);
  useEffect(() => {
    let active = true;
    load()
      .then((b) => {
        if (active) {
          setInventory(b);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [load]);
  const refresh = async () => {
    setError("");
    try {
      setInventory(await load());
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const manager = data.permissions.manage.includes(event);
  const types = data.types.filter((t) => t.event_id === event && t.active);
  const phases = data.phases.filter(
    (p) =>
      p.ticket_type_id === typeId &&
      p.active &&
      ["box_office", "both"].includes(p.channel),
  );
  const currentPhase = phases.find((p) => p.id === phaseId);
  const session = data.sessions.find(
    (s) =>
      s.event_id === found?.event_id &&
      s.operator_id === data.actor?.id &&
      !s.closed_at,
  );
  const eventName = data.events.find((e) => e.id === event)?.title;
  async function lookup() {
    setFound(null);
    const r = await run({ action: "preprint_lookup", credential }, "");
    if (r) {
      setFound(r);
      setSaleKey(browserId());
    }
  }
  return (
    <>
      <Heading
        title="Boletas preimpresas"
        subtitle="Prepara papel sin activar; registra la venta para habilitar el ingreso."
      />
      <section className="panel no-print" style={{ marginBottom: 20 }}>
        {mode === "stock" && (
          <Field name="preprint-event" label="Evento del inventario">
            <select
              id="preprint-event"
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setInventory(null);
                setFound(null);
                setCredential("");
                setTypeId("");
                setPhaseId("");
                setBlock(null);
                setCreateKey(browserId());
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
        )}
        <div className="buttons" style={{ marginTop: 16 }}>
          <button
            className={`btn ${mode === "stock" ? "primary" : ""}`}
            onClick={() => setMode("stock")}
          >
            Inventario y lotes
          </button>
          <button
            className={`btn ${mode === "activate" ? "primary" : ""}`}
            onClick={() => {
              setMode("activate");
              setTimeout(() => input.current?.focus(), 0);
            }}
          >
            Activar venta
          </button>
          <button className="btn" disabled={busy} onClick={refresh}>
            Actualizar inventario
          </button>
        </div>
      </section>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {mode === "activate" ? (
        <section className="panel" aria-label="Venta de boleta preimpresa">
          <h2>Activar venta de una boleta</h2>
          <p className="notice">
            Escanear aquí solo consulta. Confirma el pago para activar. Este
            proceso no registra ingreso al evento.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookup();
            }}
          >
            <label htmlFor="preprint-scan">
              Escanea el QR de la boleta sin activar
            </label>
            <input
              ref={input}
              id="preprint-scan"
              value={credential}
              onChange={(e) => {
                setCredential(e.target.value);
                setFound(null);
              }}
              autoComplete="off"
              disabled={busy}
              spellCheck={false}
              required
            />
            <button
              className="btn secondary"
              disabled={busy || !credential.trim()}
              style={{ marginTop: 12 }}
            >
              Consultar boleta
            </button>
          </form>
          {found && (
            <div style={{ marginTop: 24 }}>
              <h3>
                Boleta N.º {ticketCounter(found.event_sequence)} ·{" "}
                {found.type_name}
              </h3>
              <p>
                {data.events.find((e) => e.id === found.event_id)?.title} ·{" "}
                {found.batch_name}
              </p>
              <div className="summary-line total">
                <span>Precio impreso · {found.phase_name}</span>
                <b>{money(found.unit_price_cop)}</b>
              </div>
              {found.status !== "stock" ? (
                <p role="alert" className="notice error">
                  {found.status === "activated"
                    ? "Ya fue vendida y activada. No la cobres otra vez."
                    : "Boleta bloqueada: no se puede vender ni usar."}
                </p>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const r = await run(
                      {
                        action: "preprint_activate",
                        credential,
                        method,
                        verified: f.get("verified") === "on",
                        reference: String(f.get("reference") ?? ""),
                        buyer_name: String(f.get("buyer_name") ?? ""),
                        buyer_email: digital
                          ? String(f.get("buyer_email") ?? "")
                          : "",
                        buyer_phone: String(f.get("buyer_phone") ?? ""),
                        idempotency_key: saleKey,
                      },
                      "Venta confirmada. Boleta activada; todavía no ha ingresado.",
                    );
                    if (r) navigate(`/tickets/${r.order_id}`);
                  }}
                >
                  <label htmlFor="preprint-method">
                    Medio de pago de la activación
                  </label>
                  <select
                    id="preprint-method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia verificada</option>
                  </select>
                  {method === "cash" && !session && (
                    <div className="notice">
                      Necesitas caja abierta para cobrar efectivo.
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setCash(true)}
                      >
                        Abrir caja
                      </button>
                    </div>
                  )}
                  {method === "transfer" && (
                    <>
                      <Field
                        name="reference"
                        label="Referencia de la transferencia"
                        required
                      />
                      <label className="ticket-print-choice">
                        <input type="checkbox" name="verified" required />
                        Verifiqué el importe en la cuenta del comercio
                      </label>
                    </>
                  )}
                  <Field
                    name="buyer_name"
                    label="Nombre del comprador (opcional)"
                    required={false}
                  />
                  <Field
                    name="buyer_phone"
                    label="Teléfono del comprador (opcional)"
                    required={false}
                  />
                  <label className="ticket-print-choice">
                    <input
                      type="checkbox"
                      checked={digital}
                      onChange={(e) => setDigital(e.target.checked)}
                    />
                    Enviar también el PDF por correo
                  </label>
                  {digital && (
                    <Field
                      name="buyer_email"
                      label="Correo para entrega digital"
                      type="email"
                      required
                    />
                  )}
                  <p className="helper">
                    La venta usa el precio fijo del lote, aunque cambien las
                    fases. El papel y el PDF representan la misma entrada y un
                    solo ingreso.
                  </p>
                  <button
                    className="btn primary"
                    disabled={busy || (method === "cash" && !session)}
                  >
                    Confirmar cobro y activar boleta
                  </button>
                </form>
              )}
            </div>
          )}
          {cash && found && (
            <OpenCashDialog
              event={data.events.find((e) => e.id === found.event_id)!}
              onClose={() => setCash(false)}
            />
          )}
        </section>
      ) : (
        <>
          <p className="notice">
            Los lotes apartan cupo, pero no generan ventas ni cobros hasta la
            activación. Conservan localidad y precio impresos. Una boleta sin
            activar nunca permite ingresar.
          </p>
          {manager && (
            <section className="panel" style={{ marginTop: 20 }}>
              <h2>Preparar nuevo lote</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const r = await run(
                    {
                      action: "preprint_create",
                      event_id: event,
                      ticket_type_id: typeId,
                      phase_id: phaseId,
                      name: f.get("name"),
                      quantity: Number(f.get("quantity")),
                      assigned_to: f.get("assigned_to") || null,
                      idempotency_key: createKey,
                    },
                    "Lote creado sin ventas ni activaciones.",
                  );
                  if (r) {
                    setCreateKey(browserId());
                    navigate(`/box-office/preprints/${r.batch_id}`);
                  }
                }}
              >
                <div className="form-grid">
                  <Field
                    name="name"
                    label="Nombre del lote"
                    placeholder="Lote de taquilla 1"
                    required
                    maxLength={100}
                  />
                  <Field
                    name="quantity"
                    label="Cantidad de boletas por preparar"
                    type="number"
                    min={1}
                    max={100}
                    value={25}
                    required
                  />
                  <Field name="preprint-type" label="Localidad del lote">
                    <select
                      id="preprint-type"
                      required
                      value={typeId}
                      onChange={(e) => {
                        setTypeId(e.target.value);
                        setPhaseId("");
                      }}
                    >
                      <option value="">Selecciona una localidad</option>
                      {types.map((t) => (
                        <option value={t.id} key={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field name="preprint-phase" label="Precio que se imprimirá">
                    <select
                      id="preprint-phase"
                      required
                      value={phaseId}
                      onChange={(e) => setPhaseId(e.target.value)}
                    >
                      <option value="">Selecciona una fase de taquilla</option>
                      {phases.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name} · {money(p.price_cop)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field name="assigned_to" label="Vendedor responsable">
                    <select id="assigned_to" name="assigned_to">
                      <option value="">Equipo autorizado de taquilla</option>
                      {inventory?.sellers.map((p: Row) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {currentPhase && (
                  <p className="notice">
                    Precio fijo por boleta: {money(currentPhase.price_cop)}. No
                    cambia al modificar la fase después de crear el lote.
                  </p>
                )}
                <button
                  className="btn primary"
                  disabled={busy || !currentPhase}
                >
                  Crear lote y ver boletas
                </button>
              </form>
            </section>
          )}
          <section className="panel" style={{ marginTop: 20 }}>
            <h2>Lotes de {eventName}</h2>
            {!inventory ? (
              <Empty>Cargando inventario…</Empty>
            ) : !inventory.batches.length ? (
              <Empty>No hay lotes preimpresos para este evento.</Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Lote y rango</th>
                      <th>Precio</th>
                      <th>Sin activar</th>
                      <th>Vendidas / usadas</th>
                      <th>Desactivadas</th>
                      <th>Responsable</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.batches.map((b: Row) => (
                      <tr key={b.id}>
                        <td>
                          <b>{b.name}</b>
                          <br />
                          {b.type_name} · {ticketCounter(b.first_sequence)}–
                          {ticketCounter(b.last_sequence)}
                        </td>
                        <td>
                          {money(b.unit_price_cop)}
                          <br />
                          {b.phase_name}
                        </td>
                        <td>{b.stock}</td>
                        <td>
                          {b.activated} / {b.used}
                        </td>
                        <td>{b.blocked}</td>
                        <td>
                          {manager ? (
                            <select
                              aria-label={`Responsable de ${b.name}`}
                              value={b.assigned_to ?? ""}
                              disabled={busy}
                              onChange={async (e) => {
                                const r = await run(
                                  {
                                    action: "preprint_assign",
                                    event_id: event,
                                    batch_id: b.id,
                                    assigned_to: e.target.value || null,
                                  },
                                  "Responsable actualizado",
                                );
                                if (r) await refresh();
                              }}
                            >
                              <option value="">Equipo de taquilla</option>
                              {inventory.sellers.map((p: Row) => (
                                <option value={p.id} key={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            (b.assigned_name ?? "Equipo de taquilla")
                          )}
                        </td>
                        <td>
                          <div className="buttons">
                            {b.stock > 0 && (
                              <Link
                                className="btn"
                                href={`/box-office/preprints/${b.id}`}
                              >
                                Imprimir pendientes
                              </Link>
                            )}
                            {manager && b.stock > 0 && (
                              <button
                                className="btn danger"
                                onClick={() => setBlock(b)}
                              >
                                Desactivar pendientes
                              </button>
                            )}
                            {manager && (
                              <button
                                className="btn danger"
                                disabled={busy || b.activated > 0}
                                title={
                                  b.activated > 0
                                    ? "Contiene ventas: elimina solo boletas pendientes individualmente"
                                    : undefined
                                }
                                onClick={() =>
                                  setBlock({ ...b, operation: "delete" })
                                }
                              >
                                Eliminar lote
                              </button>
                            )}
                            {manager && b.activated > 0 && (
                              <small>
                                Contiene ventas; solo se pueden eliminar boletas
                                sin vender.
                              </small>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {block && (
            <PreprintActionDialog
              target={{
                eventId: event,
                batchId: block.id,
                ticketId: block.ticket_id,
                name: block.name,
                operation: block.operation ?? "deactivate",
              }}
              onClose={() => setBlock(null)}
              onDone={() => {
                setBlock(null);
                void refresh();
              }}
            />
          )}
          {inventory?.tickets.length > 0 && (
            <section className="panel" style={{ marginTop: 20 }}>
              <h2>Detalle de boletas</h2>
              <p className="helper">
                Últimas 1.000 boletas de los lotes autorizados. El QR y su
                secreto no se muestran en este listado.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Boleta</th>
                      <th>Estado</th>
                      <th>Activación</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory!.tickets.map((t: Row) => (
                      <tr key={t.id}>
                        <td>{t.visible_number}</td>
                        <td>
                          {t.status === "stock"
                            ? "Sin activar"
                            : t.status === "blocked"
                              ? "Desactivada"
                              : t.ticket_status === "used"
                                ? "Usada"
                                : t.ticket_status === "cancelled"
                                  ? "Anulada"
                                  : "Activa"}
                        </td>
                        <td>
                          {t.activated_name ?? "—"}
                          {t.activated_at && <> · {when(t.activated_at)}</>}
                        </td>
                        <td>
                          {manager && t.status === "stock" && (
                            <button
                              className="btn danger"
                              onClick={() =>
                                setBlock({
                                  id: t.batch_id,
                                  name: t.visible_number,
                                  ticket_id: t.id,
                                })
                              }
                            >
                              Desactivar esta boleta
                            </button>
                          )}
                          {manager && t.status !== "activated" && (
                            <button
                              className="btn danger"
                              disabled={busy}
                              onClick={() =>
                                setBlock({
                                  id: t.batch_id,
                                  name: t.visible_number,
                                  ticket_id: t.id,
                                  operation: "delete",
                                })
                              }
                            >
                              Eliminar esta boleta
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
