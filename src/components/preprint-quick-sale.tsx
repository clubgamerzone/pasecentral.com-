"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp, money } from "./app";
import { OpenCashDialog } from "./cash-opening";
import { browserId } from "@/lib/browser-id";
import type { Row } from "@/lib/db";

export function PreprintQuickSale() {
  const { data, run, busy } = useApp();
  const [credential, setCredential] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [verified, setVerified] = useState(false);
  const [result, setResult] = useState<Row | null>(null);
  const [popup, setPopup] = useState(false);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [cashEvent, setCashEvent] = useState<Row | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const attempted = useRef("");
  const pending = useRef<{ credential: string; key: string } | null>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    if (!popup) return;
    const timer = setTimeout(() => setPopup(false), 2500);
    return () => clearTimeout(timer);
  }, [popup, result]);

  const scan = useCallback(async () => {
    const value = credential.trim() || pending.current?.credential || "";
    if (!value || busy || sending.current) return;
    sending.current = true;
    attempted.current = value;
    setPopup(false);
    setCashEvent(null);
    setRetryAvailable(false);
    let message = "No se pudo confirmar la venta. Reintenta con el mismo QR.";
    const show = (details: Row) => {
      setResult(details);
      setPopup(true);
    };
    try {
      if (method === "transfer" && (!reference.trim() || !verified)) {
        show({
          ok: false,
          message:
            "Prepara la referencia y verifica la transferencia antes de escanear.",
        });
        return;
      }
      if (pending.current?.credential !== value)
        pending.current = { credential: value, key: browserId() };
      const sale = await run(
        {
          action: "preprint_activate",
          credential: value,
          method,
          reference: method === "transfer" ? reference.trim() : "",
          verified: method === "transfer" && verified,
          idempotency_key: pending.current.key,
        },
        "",
        (error) => {
          message = error;
        },
        false,
      );
      if (!sale) {
        // Resolve the cash dialog only on failure; successful sales need one request.
        if (method === "cash" && message.toLowerCase().includes("caja")) {
          const found = await run(
            { action: "preprint_lookup", credential: value },
            "",
          );
          const event = data.events.find((e) => e.id === found?.event_id);
          if (event) setCashEvent(event);
        }
        show({ ok: false, message });
        if (
          /ya fue vendida|bloqueada|no se puede activar|no tienes permiso|no encontrado/i.test(
            message,
          )
        ) {
          pending.current = null;
        } else setRetryAvailable(true);
        return;
      }
      show({
        number: sale.visible_number,
        price: sale.unit_price_cop,
        event: data.events.find((e) => e.id === sale.event_id)?.title,
        ok: true,
        order_id: sale.order_id,
        message: "Venta confirmada · boleta activada",
        method,
      });
      pending.current = null;
      setCredential("");
      // Each bank payment must be verified individually; never reuse a previous verification.
      if (method === "transfer") {
        setReference("");
        setVerified(false);
      }
    } finally {
      setCredential("");
      sending.current = false;
      input.current?.focus();
    }
  }, [credential, busy, method, reference, verified, run, data]);

  useEffect(() => {
    const value = credential.trim();
    if (!value || busy || sending.current || attempted.current === value)
      return;
    const timer = setTimeout(() => {
      void scan();
    }, 350);
    return () => clearTimeout(timer);
  }, [credential, busy, scan]);

  return (
    <div className="section-stack">
      <p className="notice">
        Venta automática: entrega la boleta y escanea su QR después de recibir
        el pago. Se registra el precio impreso y se activa sin botones
        adicionales. Esto no registra ingreso al evento.
      </p>
      <label htmlFor="quick-preprint-method">
        Medio de pago para la lectura
      </label>
      <select
        id="quick-preprint-method"
        value={method}
        disabled={busy}
        onChange={(e) => {
          setMethod(e.target.value);
          setReference("");
          setVerified(false);
        }}
      >
        <option value="cash">Efectivo recibido</option>
        <option value="transfer">Transferencia verificada</option>
      </select>
      {method === "transfer" && (
        <>
          <label htmlFor="quick-preprint-reference">
            Referencia de esta transferencia
          </label>
          <input
            id="quick-preprint-reference"
            value={reference}
            disabled={busy}
            onChange={(e) => setReference(e.target.value)}
          />
          <label className="ticket-print-choice">
            <input
              type="checkbox"
              checked={verified}
              disabled={busy}
              onChange={(e) => setVerified(e.target.checked)}
            />
            Verifiqué el importe en la cuenta del comercio
          </label>
          <p className="helper">
            La referencia y la verificación se limpian después de cada venta.
          </p>
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void scan();
        }}
      >
        <label htmlFor="quick-preprint-scan">
          Escanea para vender y activar
        </label>
        <input
          id="quick-preprint-scan"
          ref={input}
          value={credential}
          autoComplete="off"
          spellCheck={false}
          readOnly={busy}
          onChange={(e) => {
            setCredential(e.target.value);
            attempted.current = "";
          }}
        />
        {busy && <p role="status">Procesando boleta… espera el resultado.</p>}
        <p className="helper">
          El evento se identifica por el QR. Funciona con Enter o
          automáticamente al terminar la lectura.
        </p>
        {retryAvailable && !busy && (
          <button className="btn secondary">Reintentar última lectura</button>
        )}
      </form>
      {result && (
        <div
          role="status"
          className={`scan-result ${result.ok ? "" : "rejected"}`}
        >
          <h3>{result.message}</h3>
          {result.event && <p>{result.event}</p>}
          {result.number && (
            <p>
              {result.number} · {money(result.price)}
            </p>
          )}
          {result.ok && (
            <>
              <p>
                Cobro registrado en{" "}
                {result.method === "cash" ? "efectivo" : "transferencia"}. Lista
                para validar en Acceso.
              </p>
              <Link className="btn" href={`/tickets/${result.order_id}`}>
                Ver entrada vendida
              </Link>
            </>
          )}
        </div>
      )}
      {cashEvent && (
        <button
          className="btn primary"
          onClick={() => {
            setPopup(false);
            setCashEvent({ ...cashEvent, open: true });
          }}
        >
          Abrir caja de {cashEvent.title}
        </button>
      )}
      {cashEvent?.open && (
        <OpenCashDialog
          event={cashEvent}
          onClose={() => {
            setCashEvent(null);
            input.current?.focus();
          }}
        />
      )}
      {popup && result && (
        <div
          role="alert"
          className={`scan-popup preprint-sale-popup ${result.ok ? "accepted" : "rejected"}`}
        >
          <h2>{result.message}</h2>
          {result.event && <p>{result.event}</p>}
          {result.number && (
            <p>
              {result.number} · {money(result.price)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
