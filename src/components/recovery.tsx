"use client";
import { useState } from "react";
import { Field, useApp } from "./app";

export function Recovery({ reset = false }: { reset?: boolean }) {
  const { data, notify, refresh, navigate } = useApp();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  if (data.demo)
    return (
      <section className="panel">
        La demo local utiliza perfiles ficticios.{" "}
        <a href="/login">Volver al acceso</a>
      </section>
    );
  const authorized = !reset || !!data.actor;
  return (
    <section className="panel login-panel">
      <div className="eyebrow">Tu cuenta Pase Central</div>
      <h1>{reset ? "Elige una nueva contraseña" : "Recuperar contraseña"}</h1>
      <p>
        {reset
          ? "Guarda una contraseña nueva de al menos 10 caracteres."
          : "Te enviaremos un enlace para recuperar el acceso a tu cuenta."}
      </p>
      {!authorized ? (
        <div className="notice">
          El enlace no es válido o venció.{" "}
          <a href="/forgot-password">Solicita un nuevo enlace</a>.
        </div>
      ) : (
        !done && (
          <form
            className="section-stack"
            style={{ marginTop: 25 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (reset && form.get("password") !== form.get("confirm")) {
                notify("Las contraseñas deben coincidir.", true);
                return;
              }
              setPending(true);
              try {
                const res = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(
                    reset
                      ? { action: "reset", password: form.get("password") }
                      : { action: "forgot", email: form.get("email") },
                  ),
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body.error);
                setMessage(body.message);
                setDone(true);
                if (reset) {
                  await refresh();
                  navigate("/login");
                  notify(body.message);
                }
              } catch (error) {
                notify(
                  error instanceof Error ? error.message : "Error de conexión",
                  true,
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {reset ? (
              <>
                <Field
                  name="password"
                  type="password"
                  label="Nueva contraseña"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <Field
                  name="confirm"
                  type="password"
                  label="Confirmar nueva contraseña"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </>
            ) : (
              <Field
                name="email"
                type="email"
                label="Correo electrónico"
                autoComplete="email"
              />
            )}
            <button className="btn primary" disabled={pending}>
              {pending
                ? "Procesando…"
                : reset
                  ? "Guardar nueva contraseña"
                  : "Enviar enlace de recuperación"}
            </button>
          </form>
        )
      )}
      {message && (
        <div role="status" className="notice" style={{ marginTop: 20 }}>
          {message}
        </div>
      )}
      {!reset && (
        <p className="helper">
          Si el enlace anterior venció o no abrió el formulario, solicita uno
          nuevo aquí. Abre el enlace en este mismo navegador.
        </p>
      )}
      <a className="link" href="/login">
        Volver a iniciar sesión
      </a>
    </section>
  );
}
