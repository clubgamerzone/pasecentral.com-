"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Ticket,
  MapPin,
  CalendarDays,
  ArrowLeft,
  Download,
  Printer,
  Share2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useApp, Heading, Field, Empty, Badge, money, when } from "./app";
import { formValues } from "./operations";
import type { Row } from "@/lib/db";
import { EventGallery } from "./event-editing";
import { AttendeeFields, attendeeItems } from "./attendee-fields";
import type { Attendee } from "@/lib/demographics";
import { PaperTickets, PrintOptions, usePrintSettings } from "./print-options";
import { browserId } from "@/lib/browser-id";
import {
  PreprintActionDialog,
  type PreprintActionTarget,
} from "./preprint-actions";
export function EventPurchase({ slug }: { slug: string }) {
  const { data, run, busy, navigate } = useApp();
  const [quantities, setQuantities] = useState<Record<string, number>>({}),
    [key] = useState(() => browserId());
  const [people, setPeople] = useState<Record<string, Attendee>>({}),
    [consent, setConsent] = useState(false);
  const [gift, setGift] = useState(false);
  const e = data.events.find(
    (e) => e.slug === slug && e.status === "published",
  );
  if (!e) return <Empty>Este evento no está disponible para comprar.</Empty>;
  const types = data.types.filter((t) => t.event_id === e.id && t.active),
    prices = types.map((t) => ({
      t,
      p: data.phases.find(
        (p) =>
          p.ticket_type_id === t.id &&
          ["web", "both"].includes(p.channel) &&
          p.active &&
          new Date(p.starts_at) <= new Date() &&
          (!(p.ends_at ?? p.effective_ends_at) ||
            new Date(p.ends_at ?? p.effective_ends_at) > new Date()),
      ),
    })),
    total = prices.reduce(
      (s, { t, p }) => s + (p?.price_cop ?? 0) * (quantities[t.id] ?? 0),
      0,
    );
  return (
    <>
      <div className="buttons" style={{ marginBottom: 22 }}>
        <Link className="link" href="/events">
          <ArrowLeft size={13} style={{ display: "inline" }} /> Todos los
          eventos
        </Link>
      </div>
      <div className="split event-detail">
        <section>
          {e.cover_url ? (
            <EventGallery event={e} />
          ) : (
            <div
              className={`poster ${slug.includes("electro") ? "electronic" : ""}`}
            >
              <small>PASE CENTRAL PRESENTA</small>
              <div className="poster-title">
                {e.title.replace(" · DEMO", "")}
              </div>
            </div>
          )}
          <section className="panel">
            <h1>{e.title}</h1>
            <div className="card-meta">
              <CalendarDays />
              {when(e.starts_at)} · Colombia
            </div>
            <div className="card-meta">
              <MapPin />
              {e.venue_name} · {e.address}
            </div>
            <p
              style={{
                marginTop: 23,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {e.description}
            </p>
            <div className="notice" style={{ marginTop: 22 }}>
              Cada entrada tiene un QR único y permite un solo ingreso. No
              compartas el QR públicamente.
            </div>
          </section>
        </section>
        <section className="panel">
          <div className="eyebrow">Tu lugar te espera</div>
          <h2>Elige tus entradas</h2>
          <p className="helper">
            {e.available === null
              ? "Sin límite de aforo total"
              : `${e.available} cupos disponibles`}{" "}
            · precios en COP
          </p>
          <p className="notice">
            {e.minimum_age > 0
              ? `Edad mínima de ingreso: ${e.minimum_age} años.`
              : "Evento para todas las edades."}{" "}
            Revisa las condiciones del evento.
          </p>
          {prices.map(({ t, p }) => (
            <div className="buy-line" key={t.id}>
              <div>
                <b>{t.name}</b>
                <p>
                  {p
                    ? `${p.name} · ${money(p.price_cop)}`
                    : "Sin precio vigente"}
                </p>
              </div>
              <select
                aria-label={`Cantidad ${t.name}`}
                disabled={!p}
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
          <div className="summary-line total">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
          <p className="helper">
            Sin cargos adicionales. Precio final calculado y confirmado por el
            servidor.
          </p>
          {!data.actor ? (
            <Link
              className="btn primary"
              style={{ width: "100%", marginTop: 25 }}
              href="/login"
            >
              Inicia sesión para comprar
            </Link>
          ) : (
            <form
              style={{ marginTop: 23 }}
              onSubmit={async (ev) => {
                ev.preventDefault();
                const r = await run(
                  {
                    action: "reserve",
                    event_id: e.id,
                    items: attendeeItems(quantities, people, consent),
                    demographics_consent: consent,
                    ...formValues(ev.currentTarget),
                    is_gift: gift,
                    admission_age_confirmed:
                      new FormData(ev.currentTarget).get(
                        "admission_age_confirmed",
                      ) === "on",
                    idempotency_key: key,
                  },
                  "Cupo reservado temporalmente",
                );
                if (r) navigate(`/checkout/${r.order_id}`);
              }}
            >
              <div className="section-stack">
                <Field
                  name="buyer_name"
                  label="Nombre completo"
                  value={data.actor.name}
                />
                <Field
                  name="buyer_email"
                  type="email"
                  label="Correo para entrega"
                  value={data.actor.email}
                  readOnly
                />
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={gift}
                    onChange={(e) => setGift(e.target.checked)}
                  />
                  Es un regalo
                </label>
                {gift && (
                  <>
                    <Field
                      name="gift_email"
                      type="email"
                      label="Correo del destinatario del regalo"
                    />
                    <p className="helper">
                      El destinatario debe iniciar sesión o crear una cuenta con
                      ese correo y aceptar en Mis entradas. Tiene 7 días desde
                      la confirmación de la compra; si no acepta, las entradas
                      vuelven a ti. No enviamos QR utilizables antes de aceptar.
                    </p>
                  </>
                )}
                <Field
                  name="buyer_phone"
                  label="Teléfono (opcional)"
                  required={false}
                />
                {!gift &&
                  Object.values(quantities).reduce((s, n) => s + n, 0) > 1 && (
                    <AttendeeFields
                      skipFirst
                      types={types}
                      quantities={quantities}
                      people={people}
                      onChange={setPeople}
                      consent={consent}
                      onConsent={setConsent}
                    />
                  )}
                {!gift && (
                  <p className="helper">
                    Tu propia entrada usa el género y la edad opcional de Mi
                    perfil. Los datos opcionales de acompañantes se usan para
                    organización y análisis; no pedimos nombres, documentos ni
                    fechas de nacimiento.
                  </p>
                )}
                {!gift && e.minimum_age > 0 && (
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      name="admission_age_confirmed"
                      required
                    />
                    Confirmo que quienes usarán estas entradas cumplirán la edad
                    mínima de {e.minimum_age} años en la fecha del evento. Se
                    puede verificar en el ingreso.
                  </label>
                )}
                <label className="inline-check">
                  <input type="checkbox" required />
                  Acepto las{" "}
                  <a
                    className="link"
                    href="/terms"
                    target="_blank"
                    rel="noreferrer"
                  >
                    condiciones de compra
                  </a>{" "}
                  y el{" "}
                  <a
                    className="link"
                    href="/privacy"
                    target="_blank"
                    rel="noreferrer"
                  >
                    aviso de privacidad
                  </a>
                  .
                </label>
              </div>
              <button
                className="btn primary"
                style={{ width: "100%", marginTop: 22 }}
                disabled={busy}
              >
                <Ticket />
                Reservar y continuar
              </button>
            </form>
          )}
          {data.demo && (
            <p className="helper" style={{ marginTop: 20 }}>
              DEMO: no se cobrarán pagos reales en este entorno.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
export function Checkout({ orderId }: { orderId: string | null }) {
  const { data, run, busy, refresh, navigate } = useApp();
  const [id] = useState(
    () =>
      orderId ??
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      ).get("order") ??
      "",
  );

  useEffect(() => {
    const interval = setInterval(() => {
      refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [refresh]);
  const o = data.orders.find((o) => o.id === id);
  if (!o)
    return (
      <>
        <Heading title="Estado de tu compra" />
        <Empty>
          Inicia sesión con la cuenta del comprador para consultar esta orden.
        </Empty>
        <Link href="/login" className="btn primary">
          Iniciar sesión
        </Link>
      </>
    );
  const expired =
      o.status === "expired" ||
      (o.status === "pending_payment" &&
        new Date(o.reservation_expires_at) <= new Date()),
    confirmed = ["confirmed", "partially_refunded"].includes(o.status);
  return (
    <>
      <Heading
        title="Tu próxima noche está cerca"
        subtitle={`Orden ${o.id.slice(0, 8).toUpperCase()}`}
      />
      <section className="status-banner">
        {confirmed ? (
          <CheckCircle2 />
        ) : o.status === "needs_review" ? (
          <AlertTriangle />
        ) : (
          <Clock />
        )}
        <h2>
          {o.status === "refunded"
            ? "Devolución registrada"
            : confirmed
              ? o.is_gift
                ? "Tu compra para regalo fue confirmada"
                : "Tus entradas están listas"
              : o.status === "needs_review"
                ? "Pago recibido, entradas pendientes de revisión"
                : expired
                  ? "La reserva venció"
                  : o.status === "cancelled"
                    ? "El pago no se completó"
                    : "Esperando confirmación del pago"}
        </h2>
        <p>
          {o.status === "refunded"
            ? "El organizador registró una devolución. Consulta el estado de cada entrada; esta devolución no autoriza un ingreso."
            : confirmed
              ? "Consulta y descarga cada QR desde tus entradas."
              : o.status === "needs_review"
                ? "El pago llegó después del vencimiento y requiere atención del organizador. Esta orden no autoriza el ingreso."
                : expired
                  ? "Vuelve al evento para crear una nueva reserva. Si pagaste, espera la verificación del proveedor."
                  : "El estado se consulta al servidor. El regreso desde Wompi no confirma por sí mismo una compra."}
        </p>
      </section>
      <section className="panel" style={{ maxWidth: 620 }}>
        <h2>Resumen de la orden</h2>
        {data.items
          .filter((i) => i.order_id === o.id)
          .map((i) => (
            <div className="summary-line" key={i.id}>
              <span>
                {i.quantity} × {i.type_name} · {i.phase_name}
              </span>
              <b>{money(i.line_total_cop)}</b>
            </div>
          ))}
        <div className="summary-line total">
          <span>Total</span>
          <b>{money(o.total_cop)}</b>
        </div>
        <Badge status={expired ? "expired" : o.status} />
        {o.status === "pending_payment" && !expired && (
          <p className="helper">
            Reserva vigente hasta {when(o.reservation_expires_at)}
          </p>
        )}
        <div className="form-actions">
          {confirmed ? (
            <Link
              className="btn primary"
              href={o.is_gift ? "/account/tickets" : `/tickets/${o.id}`}
            >
              <Ticket />
              {o.is_gift ? "Consultar regalo" : "Ver mis entradas"}
            </Link>
          ) : o.status === "pending_payment" && !expired ? (
            data.demo ? (
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  const r = await run(
                    { action: "demo_payment", order_id: o.id },
                    "Pago ficticio aprobado · DEMO",
                  );
                  if (r?.status === "confirmed") navigate(`/tickets/${o.id}`);
                }}
              >
                Simular aprobación · DEMO
              </button>
            ) : (
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  const r = await run(
                    { action: "checkout", order_id: o.id },
                    "",
                  );
                  if (r?.url) location.assign(r.url);
                }}
              >
                Pagar con Wompi
              </button>
            )
          ) : null}
          <button className="btn" onClick={() => refresh()}>
            <RefreshCw />
            Consultar estado
          </button>
        </div>
      </section>
    </>
  );
}
export function Tickets({
  orderId,
  preprinted = false,
}: {
  orderId: string;
  preprinted?: boolean;
}) {
  const { data, run, notify, navigate } = useApp();
  const [manageTarget, setManageTarget] = useState<PreprintActionTarget | null>(
    null,
  );
  const [printSettings, updatePrintSettings] = usePrintSettings();
  const [doc, setDoc] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [printing, setPrinting] = useState(false),
    [shareFile, setShareFile] = useState<File | null>(null),
    [sharing, setSharing] = useState(false),
    [shareHelp, setShareHelp] = useState(false),
    [printJobs, setPrintJobs] = useState<Row[]>([]),
    [printSource, setPrintSource] = useState<"browser" | "qz">("browser"),
    [resolvingPrint, setResolvingPrint] = useState(false);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[] | null>(
    null,
  );
  const selectedTickets: Row[] =
    doc?.tickets.filter(
      (t: Row) =>
        (preprinted ? t.status === "stock" : t.status === "valid") &&
        (selectedTicketIds === null || selectedTicketIds.includes(t.id)),
    ) ?? [];
  async function request(format = "json") {
    return fetch(preprinted ? "/api/preprints" : "/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(preprinted ? { batch_id: orderId } : { order_id: orderId }),
        share: location.hash.slice(1) || undefined,
        format,
      }),
    });
  }
  useEffect(() => {
    let active = true;
    fetch(preprinted ? "/api/preprints" : "/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(preprinted ? { batch_id: orderId } : { order_id: orderId }),
        share: location.hash.slice(1) || undefined,
        format: "json",
      }),
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        if (active) {
          setDoc(b);
          setSelectedTicketIds(null);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [orderId, preprinted]);
  async function pdf() {
    try {
      const res = await request("pdf");
      if (!res.ok) throw new Error((await res.json()).error);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `entradas-${orderId}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  useEffect(() => {
    if (!doc || preprinted) return;
    let active = true;
    fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderId,
        share: location.hash.slice(1) || undefined,
        format: "pdf",
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo preparar el PDF");
        const file = new File([await res.blob()], `entradas-${orderId}.pdf`, {
          type: "application/pdf",
        });
        if (active) setShareFile(file);
      })
      .catch(() => {
        if (active) setShareHelp(true);
      });
    return () => {
      active = false;
    };
  }, [doc, orderId, preprinted]);
  async function sharePdf() {
    if (!shareFile || !doc) return;
    if (!navigator.canShare?.({ files: [shareFile] }) || !navigator.share) {
      setShareHelp(true);
      await pdf();
      return;
    }
    setSharing(true);
    try {
      // The PDF is prepared before the click, preserving the browser's user activation.
      await navigator.share({
        files: [shareFile],
        title: `Entradas · ${doc.event.title}`,
        text: "Tus entradas de Pase Central. Cada QR admite un ingreso; no lo publiques.",
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setShareHelp(true);
        notify(
          "No se pudo compartir el archivo. Descarga el PDF y adjúntalo en WhatsApp.",
          true,
        );
      }
    } finally {
      setSharing(false);
    }
  }
  async function print(qz = false) {
    if (
      !doc ||
      printing ||
      printJobs.length ||
      resolvingPrint ||
      !selectedTickets.length
    )
      return;
    setPrintSource(qz ? "qz" : "browser");
    setPrinting(true);
    const jobs: Row[] = [];
    try {
      const registered = await run(
        {
          action: preprinted ? "preprint_print_request" : "print_batch_request",
          ticket_ids: selectedTickets.map((t: Row) => t.id),
        },
        "",
      );
      if (!registered) throw new Error("No se pudo registrar la impresión");
      jobs.push(...registered.jobs);
      if (qz) {
        const { QZTrayAdapter } = await import("@/lib/printer");
        await new QZTrayAdapter().print(
          selectedTickets,
          doc.event,
          printSettings,
        );
        for (const job of jobs) {
          const result = await run(
            {
              action: preprinted ? "preprint_print_result" : "print_result",
              job_id: job.job_id,
              status: "submitted",
            },
            "",
          );
          if (!result)
            throw new Error(
              "No se pudo registrar el envío a QZ Tray. Revisa el trabajo antes de reintentar.",
            );
        }
        setPrintJobs(jobs);
        notify("Trabajo enviado a QZ Tray. Falta verificar el papel.");
      } else {
        setPrintJobs(jobs);
        window.print();
        notify(
          "El navegador no informa si imprimiste o cancelaste. Indica el resultado.",
        );
      }
    } catch (e) {
      for (const job of jobs)
        await run(
          {
            action: preprinted ? "preprint_print_result" : "print_result",
            job_id: job.job_id,
            status: "failed",
          },
          "",
        );
      setPrintJobs([]);
      notify((e as Error).message, true);
    } finally {
      setPrinting(false);
    }
  }
  if (error)
    return (
      <>
        <Heading title={preprinted ? "Boletas preimpresas" : "Tus entradas"} />
        <div className="notice error">{error}</div>
        <Link
          href={preprinted ? "/box-office/preprints" : "/account/tickets"}
          className="btn"
        >
          {preprinted ? "Volver al inventario" : "Mis entradas"}
        </Link>
      </>
    );
  if (!doc) return <Empty>Preparando tus entradas…</Empty>;
  if (!doc.tickets.length)
    return (
      <>
        <Heading
          title={
            preprinted
              ? "Este lote no tiene boletas sin activar"
              : "Estas entradas no están disponibles a tu nombre"
          }
        />
        <div className="notice">
          {preprinted
            ? "Las boletas vendidas se consultan en su orden; las bloqueadas no se pueden reutilizar."
            : "Pueden estar pendientes de aceptación, transferidas o regaladas."}
          {!preprinted &&
            "Consulta su estado en Mis entradas; solo se muestran los QR que corresponden a tu titularidad."}
        </div>
        <Link
          href={preprinted ? "/box-office/preprints" : "/account/tickets"}
          className="btn"
        >
          {preprinted ? "Volver al inventario" : "Ver Mis entradas"}
        </Link>
      </>
    );
  const canPrint = data.permissions.sell.includes(doc.event.id);
  return (
    <>
      <Heading
        title={
          preprinted
            ? "Boletas preimpresas sin activar"
            : "Tu pase a una gran noche"
        }
        subtitle={`${doc.event.title} · ${preprinted ? doc.batch_name : `orden ${orderId.slice(0, 8).toUpperCase()}`}`}
        action={
          <Link
            href={
              preprinted
                ? `/box-office/preprints?event=${doc.event.id}`
                : "/account/tickets"
            }
            className="btn"
          >
            {preprinted ? "Volver al inventario" : "Mis entradas"}
          </Link>
        }
      />
      {preprinted && data.permissions.manage.includes(doc.event.id) && (
        <section
          className="panel no-print"
          style={{ marginBottom: 20 }}
          aria-label="Administrar lote preimpreso"
        >
          <h3>Administrar este lote</h3>
          <p className="helper">
            Desactiva o elimina todo el lote, o usa los botones debajo de cada
            boleta para cambiar solo esa. Las ventas existentes se conservan.
          </p>
          <div className="buttons">
            <button
              className="btn danger"
              disabled={printing || resolvingPrint || printJobs.length > 0}
              onClick={() =>
                setManageTarget({
                  eventId: doc.event.id,
                  batchId: orderId,
                  name: doc.batch_name,
                  operation: "deactivate",
                })
              }
            >
              Desactivar lote
            </button>
            <button
              className="btn danger"
              disabled={
                printing ||
                resolvingPrint ||
                printJobs.length > 0 ||
                !doc.can_delete_batch
              }
              onClick={() =>
                setManageTarget({
                  eventId: doc.event.id,
                  batchId: orderId,
                  name: doc.batch_name,
                  operation: "delete",
                })
              }
            >
              Eliminar lote
            </button>
          </div>
          {!doc.can_delete_batch && (
            <p className="helper">
              Este lote contiene ventas. Puedes eliminar sus boletas pendientes
              individualmente.
            </p>
          )}
        </section>
      )}
      {manageTarget && (
        <PreprintActionDialog
          target={manageTarget}
          onClose={() => setManageTarget(null)}
          onDone={() => {
            setManageTarget(null);
            navigate(`/box-office/preprints?event=${doc.event.id}`);
          }}
        />
      )}
      {canPrint && (
        <PrintOptions
          settings={printSettings}
          update={updatePrintSettings}
          disabled={printing || resolvingPrint || printJobs.length > 0}
        />
      )}
      {canPrint && (
        <section
          className="panel no-print"
          style={{ marginBottom: 20 }}
          aria-label="Seleccionar entradas para imprimir"
        >
          <h3>¿Qué entradas quieres imprimir?</h3>
          {!preprinted &&
            doc.tickets.some((t: Row) => t.status !== "valid") && (
              <p className="notice">
                Las entradas utilizadas o anuladas no se pueden imprimir. Solo
                se seleccionan las vigentes.
              </p>
            )}
          <p role="status">
            {selectedTickets.length} de {doc.tickets.length} seleccionadas
            {printSettings.paper === "ticket70x40"
              ? ` · ${selectedTickets.length * 2} tramos de papel`
              : ""}
          </p>
          <div className="buttons">
            <button
              className="btn"
              disabled={printing || resolvingPrint || printJobs.length > 0}
              onClick={() => setSelectedTicketIds(null)}
            >
              Seleccionar todas
            </button>
            <button
              className="btn"
              disabled={printing || resolvingPrint || printJobs.length > 0}
              onClick={() => setSelectedTicketIds([])}
            >
              Quitar selección
            </button>
          </div>
          <p className="helper">
            Marca las casillas debajo de las boletas. La selección solo afecta
            la impresión; el PDF y el archivo compartido conservan todas las
            entradas. El consecutivo es único por evento y no cambia al
            reimprimir.
          </p>
        </section>
      )}
      <div className="buttons">
        <button className="btn primary" onClick={pdf}>
          <Download />
          Descargar PDF
        </button>
        {canPrint && (
          <>
            <button
              className="btn"
              onClick={() => print()}
              disabled={
                printing ||
                resolvingPrint ||
                printJobs.length > 0 ||
                !selectedTickets.length
              }
            >
              <Printer />
              {printing
                ? "Preparando impresión…"
                : `Imprimir seleccionadas (${selectedTickets.length})`}
            </button>
            {process.env.NEXT_PUBLIC_QZ_PRINTER && (
              <button
                className="btn"
                onClick={() => print(true)}
                disabled={
                  printing ||
                  resolvingPrint ||
                  printJobs.length > 0 ||
                  !selectedTickets.length
                }
              >
                <Printer />
                {printSettings.paper === "receipt80"
                  ? "Impresión QZ Tray · ESC/POS"
                  : "Impresión STARPOS · QZ Tray"}
              </button>
            )}
          </>
        )}
        {!preprinted && (
          <button
            className="btn"
            onClick={sharePdf}
            disabled={!shareFile || sharing}
          >
            <Share2 />
            {sharing
              ? "Compartiendo…"
              : !shareFile
                ? "Preparando PDF para compartir…"
                : "Compartir PDF por WhatsApp"}
          </button>
        )}
      </div>
      {shareHelp && (
        <div className="notice" style={{ marginTop: 16 }}>
          El PDF contiene todas tus entradas, una por página y cada una con su
          QR. En WhatsApp Web abre el chat, pulsa Adjuntar → Documento y
          selecciona el PDF descargado.
          <button
            className="btn"
            style={{ marginTop: 12 }}
            onClick={() =>
              window.open(
                "https://web.whatsapp.com/",
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            Abrir WhatsApp Web
          </button>
        </div>
      )}
      {printJobs.length > 0 && (
        <section
          className="panel no-print"
          style={{ marginTop: 20, marginBottom: 20 }}
        >
          <h3>¿Qué ocurrió con la impresión?</h3>
          <p>
            {printSource === "browser"
              ? "Abrir o cerrar el diálogo no confirma un envío. Si cancelaste, elige No se imprimió / cancelé."
              : "QZ Tray recibió el trabajo, pero todavía debes revisar el papel."}
            Confirma el resultado para poder solicitar otra impresión.
          </p>
          <div className="buttons" style={{ marginTop: 16 }}>
            {(["confirmed", "failed"] as const).map((status) => (
              <button
                className={`btn ${status === "confirmed" ? "primary" : "danger"}`}
                key={status}
                disabled={resolvingPrint || printing}
                onClick={async () => {
                  if (
                    !confirm(
                      status === "confirmed"
                        ? "¿Verificaste que todas las entradas salieron legibles en papel?"
                        : "¿Confirmas que la impresión falló o se canceló?",
                    )
                  )
                    return;
                  setResolvingPrint(true);
                  try {
                    for (const job of printJobs) {
                      const result = await run(
                        {
                          action: preprinted
                            ? "preprint_print_result"
                            : "print_result",
                          job_id: job.job_id,
                          status,
                        },
                        "",
                      );
                      if (!result) return;
                      setPrintJobs((current) =>
                        current.filter((j) => j.job_id !== job.job_id),
                      );
                    }
                    notify(
                      status === "confirmed"
                        ? "Impresión física verificada."
                        : "Registrado: no se imprimió o se canceló.",
                    );
                  } finally {
                    setResolvingPrint(false);
                  }
                }}
              >
                {status === "confirmed"
                  ? "Papel impreso y verificado"
                  : "No se imprimió / cancelé"}
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="notice" style={{ marginTop: 20 }}>
        {preprinted
          ? "Estas boletas NO permiten ingresar hasta confirmar su venta en Activar venta. No entregues el lote ni compartas sus QR con clientes antes de venderlo. Cada entrada activa permite un ingreso."
          : "Cada QR admite un solo ingreso. El enlace compartido permite ver tus entradas: entrégalo únicamente a la persona que las usará."}
      </div>
      <PaperTickets
        tickets={doc.tickets}
        onManage={
          preprinted && data.permissions.manage.includes(doc.event.id)
            ? (t, operation) =>
                setManageTarget({
                  eventId: doc.event.id,
                  batchId: orderId,
                  ticketId: t.id,
                  name: t.visible_number,
                  operation,
                })
            : undefined
        }
        printTickets={canPrint ? selectedTickets : doc.tickets}
        selectedIds={
          canPrint ? selectedTickets.map((t: Row) => t.id) : undefined
        }
        onToggle={
          canPrint
            ? (id) =>
                setSelectedTicketIds((current) => {
                  const ids = current ?? doc.tickets.map((t: Row) => t.id);
                  return ids.includes(id)
                    ? ids.filter((value: string) => value !== id)
                    : [...ids, id];
                })
            : undefined
        }
        selectionDisabled={printing || resolvingPrint || printJobs.length > 0}
        event={doc.event}
        settings={printSettings}
      />
      {canPrint && (
        <p className="helper no-print">
          El diálogo de impresión no confirma que salió papel. Verifica
          impresora, tamaño de papel seleccionado y legibilidad del QR. Las
          reimpresiones conservan los identificadores.
        </p>
      )}
    </>
  );
}
