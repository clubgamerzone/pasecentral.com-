"use client";
import Link from "next/link";
import { useState } from "react";
import { Field, useApp } from "./app";
import { ageBands, genders } from "@/lib/demographics";

export function PurchaseAccount({ returnTo }: { returnTo: string }) {
  const { refresh, data } = useApp();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="purchase-account" aria-label="Cuenta para comprar">
      <h3>Crear una cuenta rápida</h3>
      <p className="helper">
        Tu nombre y correo se usarán para tu cuenta y para entregar las entradas
        después del pago. Confirma tu correo antes de continuar; conservaremos
        tu selección, sujeta a disponibilidad.
      </p>
      {data.demo ? (
        <p className="notice">
          El registro se prueba en el entorno conectado. En esta demostración
          puedes usar una cuenta de ensayo.
        </p>
      ) : message ? (
        <div role="status" className="notice">
          <p>{message}</p>
          <p>
            Abre el enlace del correo para volver a este evento. Si ya tenías
            cuenta, inicia sesión con tu contraseña habitual.
          </p>
        </div>
      ) : (
        <form
          className="section-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const values = Object.fromEntries(
              new FormData(event.currentTarget),
            );
            setPending(true);
            setError("");
            try {
              const response = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "signup",
                  ...values,
                  age_band: values.age_band || null,
                  terms_accepted: values.terms_accepted === "on",
                  next: returnTo,
                }),
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(
                  result.error ||
                    "No se pudo crear la cuenta. Inténtalo de nuevo.",
                );
              const current = await refresh();
              if (!current.actor) setMessage(result.message);
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "No se pudo conectar. Inténtalo de nuevo.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <Field
            name="name"
            label="Nombre completo"
            autoComplete="name"
            maxLength={150}
          />
          <Field
            name="email"
            label="Correo para tu cuenta y tus entradas"
            type="email"
            autoComplete="email"
          />
          <Field
            name="password"
            label="Contraseña (mínimo 10 caracteres)"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
          />
          <div className="form-grid">
            <label className="field">
              <span>Género</span>
              <select
                name="gender"
                aria-label="Género"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecciona una opción
                </option>
                {Object.entries(genders).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Rango de edad (opcional)</span>
              <select
                name="age_band"
                aria-label="Rango de edad (opcional)"
                defaultValue=""
              >
                <option value="">Prefiero no indicar edad</option>
                {Object.entries(ageBands).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="helper">
            Género y edad se usan para estadísticas. Puedes elegir “Prefiero no
            responder” y omitir la edad.
          </p>
          <label className="inline-check">
            <input name="terms_accepted" type="checkbox" required />
            <span>
              Acepto las{" "}
              <Link href="/terms" target="_blank">
                condiciones de creación de cuenta
              </Link>{" "}
              y el{" "}
              <Link href="/privacy" target="_blank">
                aviso de privacidad
              </Link>
              , incluido el uso estadístico de los datos declarados.
            </span>
          </label>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary" disabled={pending}>
            {pending ? "Creando cuenta…" : "Crear cuenta y continuar"}
          </button>
        </form>
      )}
      <Link
        className="btn"
        href={`/login?next=${encodeURIComponent(returnTo)}`}
      >
        Ya tengo cuenta · Iniciar sesión
      </Link>
    </section>
  );
}
