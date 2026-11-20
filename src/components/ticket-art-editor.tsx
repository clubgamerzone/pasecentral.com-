"use client";
import { useState } from "react";
import { useApp } from "./app";
import type { Row } from "@/lib/db";
export function TicketArtEditor({ event }: { event: Row }) {
  const { refresh, notify } = useApp();
  const [caption, setCaption] = useState(
    event.ticket_art_caption ?? "VIVE EL MOMENTO",
  );
  const [working, setWorking] = useState(false),
    [preview, setPreview] = useState<string | null>(null);
  async function save(file?: File) {
    setWorking(true);
    const local = file ? URL.createObjectURL(file) : null;
    setPreview(local);
    try {
      const body = new FormData();
      if (file) body.set("image", file);
      body.set("caption", caption);
      const res = await fetch(`/api/events/${event.id}/ticket-art`, {
        method: file ? "POST" : "DELETE",
        body: file ? body : undefined,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await refresh();
      notify(
        file ? "Diseño de boletas actualizado" : "Diseño de boletas retirado",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      if (local) URL.revokeObjectURL(local);
      setPreview(null);
      setWorking(false);
    }
  }
  return (
    <section className="panel ticket-art-editor">
      <h2>Logo y diseño para boletas</h2>
      <p>
        Se imprime en blanco y negro en la parte inferior, junto a los datos del
        evento. Es independiente de la portada.
      </p>
      {(preview || event.has_ticket_art) && (
        <figure>
          <img
            src={
              preview ??
              `/api/events/${event.id}/ticket-art?v=${event.ticket_art_updated_at ?? "1"}`
            }
            alt="Diseño para boletas del evento"
          />
          <figcaption>
            {preview
              ? "Vista previa · guardando…"
              : "Diseño guardado en blanco y negro"}
          </figcaption>
        </figure>
      )}
      <label>
        Frase al pie de la boleta
        <input
          maxLength={40}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={working}
        />
      </label>
      <p className="helper">
        La frase se guarda al subir el diseño. Después puedes cambiarla con
        Guardar frase.
      </p>
      {event.has_ticket_art && (
        <button
          type="button"
          className="btn"
          disabled={working || !caption.trim()}
          onClick={async () => {
            setWorking(true);
            try {
              const res = await fetch(`/api/events/${event.id}/ticket-art`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ caption }),
              });
              const result = await res.json();
              if (!res.ok) throw new Error(result.error);
              await refresh();
              notify("Frase de boleta actualizada");
            } catch (e) {
              notify((e as Error).message, true);
            } finally {
              setWorking(false);
            }
          }}
        >
          Guardar frase
        </button>
      )}
      <label>
        Subir logo o diseño para boletas
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={working}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void save(file);
            e.target.value = "";
          }}
        />
      </label>
      <p className="helper">
        JPG, PNG o WebP, máximo 4 MB. Usa un diseño horizontal con fondo claro y
        líneas gruesas; puedes incluir el logo y los equipos en una sola imagen.
        Si lo omites, se imprime el nombre del evento.
      </p>
      {event.has_ticket_art && (
        <button
          className="btn danger"
          type="button"
          disabled={working}
          onClick={() => {
            if (
              confirm(
                "¿Quitar el diseño de las próximas boletas y reimpresiones?",
              )
            )
              void save();
          }}
        >
          Quitar diseño de boletas
        </button>
      )}
    </section>
  );
}
