"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Ticket,
} from "lucide-react";
import { useApp, Badge, when } from "./app";
import type { Row } from "@/lib/db";

export function TicketCarousel({ tickets }: { tickets: Row[] }) {
  const { data } = useApp();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [previews, setPreviews] = useState<{
    revision: typeof data.tickets;
    images: Record<string, string>;
  }>({ revision: data.tickets, images: {} });
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const active = tickets[Math.min(index, Math.max(0, tickets.length - 1))];
  const activeId = active?.id,
    orderId = active?.order_id;
  const eligible = active?.status === "valid" && !active?.transfer_pending;

  useEffect(() => {
    if (!activeId || !orderId || !eligible) return;
    if (previews.revision === data.tickets && previews.images[activeId]) return;
    const controller = new AbortController();
    fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderId,
        owner_only: true,
        preview_ticket_id: activeId,
      }),
      signal: controller.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "No se pudo cargar la boleta");
        if (!controller.signal.aborted) {
          setPreviews((current) => ({
            revision: data.tickets,
            images: {
              ...(current.revision === data.tickets
                ? Object.fromEntries(Object.entries(current.images).slice(-7))
                : {}),
              [body.id]: body.image,
            },
          }));
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [activeId, orderId, eligible, retry, data.tickets, previews]);

  function move(next: number) {
    const node = track.current;
    if (!node) return;
    const position = Math.min(tickets.length - 1, Math.max(0, next));
    const cards = node.querySelectorAll<HTMLElement>(".wallet-ticket-card");
    node.scrollTo({
      left: cards[position].offsetLeft - cards[0].offsetLeft,
      behavior: "auto",
    });
    setIndex(position);
    setError("");
  }

  if (!tickets.length)
    return (
      <section className="wallet-empty panel">
        <span className="wallet-empty-icon">
          <Ticket size={36} />
        </span>
        <h2>Tu próxima experiencia empieza aquí</h2>
        <p>
          Cuando compres o aceptes una entrada, la encontrarás aquí con su QR
          listo para ingresar.
        </p>
        <Link className="btn primary" href="/events">
          Explorar eventos
        </Link>
      </section>
    );

  return (
    <section className="wallet-gallery" aria-label="Mis boletas en carrusel">
      <div className="wallet-gallery-heading">
        <div>
          <h2>Tus boletas</h2>
          <p className="helper">
            Desliza para recorrerlas. Cada QR admite un solo ingreso.
          </p>
        </div>
        <div className="buttons">
          <button
            type="button"
            className="btn"
            aria-label="Boleta anterior"
            disabled={index <= 0}
            onClick={() => move(index - 1)}
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            className="btn"
            aria-label="Boleta siguiente"
            disabled={index >= tickets.length - 1}
            onClick={() => move(index + 1)}
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <div
        className="wallet-track"
        ref={track}
        tabIndex={0}
        role="region"
        aria-label="Desliza tus boletas horizontalmente"
        onScroll={() => {
          const node = track.current,
            first = node?.querySelector<HTMLElement>(".wallet-ticket-card");
          if (node && first) {
            const next = Math.min(
              tickets.length - 1,
              Math.max(
                0,
                Math.round(node.scrollLeft / (first.offsetWidth + 16)),
              ),
            );
            setIndex(next);
            if (next !== index) setError("");
          }
        }}
      >
        {tickets.map((t, i) => {
          const event: Row | undefined =
            data.events.find((e) => e.id === t.event_id) ??
            (t.event_title
              ? {
                  title: t.event_title,
                  starts_at: t.event_starts_at,
                  venue_name: t.event_venue_name,
                }
              : undefined);
          const valid = t.status === "valid" && !t.transfer_pending;
          return (
            <article
              className="wallet-ticket-card"
              key={t.id}
              aria-label={`Boleta ${i + 1}: ${event?.title ?? t.type_name}`}
            >
              <div className="wallet-card-top">
                <span>ENTRADA {String(i + 1).padStart(2, "0")}</span>
                {t.transfer_pending ? (
                  <span className="badge pending">Entrega pendiente</span>
                ) : (
                  <Badge status={t.status} />
                )}
              </div>
              {event?.cover_url && (
                <img
                  className="wallet-event-cover"
                  src={event.cover_url}
                  alt={`Portada de ${event.title}`}
                  loading="lazy"
                />
              )}
              <h3>{event?.title ?? "Tu evento"}</h3>
              <p className="wallet-event-meta">
                <CalendarDays size={14} />
                {event
                  ? when(event.starts_at)
                  : "Consulta los detalles de tu entrada"}
              </p>
              {event && (
                <p className="wallet-event-meta">
                  <MapPin size={14} />
                  {event.venue_name}
                </p>
              )}
              <div className="wallet-ticket-preview">
                {!valid ? (
                  <div className="wallet-preview-message">
                    <Ticket size={30} />
                    <b>
                      {t.transfer_pending
                        ? "Pendiente de aceptación"
                        : t.status === "used"
                          ? "Ya viviste esta experiencia"
                          : "Entrada anulada"}
                    </b>
                    <p>Esta entrada no permite ingresar.</p>
                  </div>
                ) : previews.revision === data.tickets &&
                  previews.images[t.id] ? (
                  <img
                    src={previews.images[t.id]}
                    alt={`Boleta con QR ${t.visible_number}`}
                  />
                ) : i === index && error ? (
                  <div role="alert" className="wallet-preview-message">
                    <p>{error}</p>
                    <button
                      className="btn"
                      onClick={() => {
                        setError("");
                        setRetry((n) => n + 1);
                      }}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <div className="wallet-preview-message">
                    <Ticket size={30} />
                    <p>
                      {i === index
                        ? "Preparando tu boleta…"
                        : "Desliza para ver esta boleta"}
                    </p>
                  </div>
                )}
              </div>
              {valid && (
                <p className="wallet-scan-hint">
                  Presenta este QR en la entrada
                </p>
              )}
              <div className="wallet-card-bottom">
                <div>
                  <b>{t.type_name}</b>
                  <small>{t.visible_number}</small>
                </div>
                <Link
                  className="btn primary"
                  href={`/tickets/${t.order_id}?mine=1`}
                >
                  Ver entrada
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <p className="wallet-position" role="status">
        Entrada {Math.min(index + 1, tickets.length)} de {tickets.length}
      </p>
    </section>
  );
}
