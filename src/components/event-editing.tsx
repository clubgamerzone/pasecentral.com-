"use client";
import { useState } from "react";
import type { Row } from "@/lib/db";
import { useApp, Field } from "./app";
import { formValues } from "./operations";
import { EventSchedule, scheduleValues } from "./enhanced-fields";
export function EventDetails({ event: e }: { event: Row }) {
  const { run, busy, refresh, notify } = useApp();
  const [uploading, setUploading] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  async function images(files: File[]) {
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 4 * 1024 * 1024)
          throw new Error("Cada imagen debe pesar como máximo 4 MB");
        const body = new FormData();
        body.append("image", file);
        const response = await fetch(`/api/events/${e.id}/images`, {
          method: "POST",
          body,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
      }
      notify("Imágenes guardadas");
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      await refresh();
      setUploading(false);
    }
  }
  async function remove(id: string) {
    setUploading(true);
    try {
      const response = await fetch(`/api/event-images/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      notify("Imagen eliminada");
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setUploading(false);
    }
  }
  const fields = [
    "title",
    "description",
    "venue_name",
    "address",
    "capacity",
    "starts_at",
    "ends_at",
    "admission_starts_at",
    "admission_ends_at",
  ];
  return (
    <div className="section-stack">
      <section className="panel">
        <h2>Editar evento</h2>
        <p className="helper" style={{ margin: "12px 0 20px" }}>
          El enlace de compra se conserva. El aforo incluye las entradas
          comprometidas y las reservas vigentes.
        </p>
        <form
          key={JSON.stringify(fields.map((k) => e[k]))}
          className="form-grid"
          onSubmit={async (ev) => {
            ev.preventDefault();
            const values = formValues(ev.currentTarget);
            scheduleValues(values);
            await run(
              { action: "update_event", event_id: e.id, ...values },
              "Evento actualizado",
            );
          }}
        >
          <Field
            name="title"
            label="Nombre del evento"
            defaultValue={e.title}
          />
          <Field
            name="capacity"
            label="Aforo total"
            type="number"
            min={1}
            max={1000000}
            defaultValue={e.capacity}
          />
          <Field
            name="venue_name"
            label="Nombre del recinto"
            defaultValue={e.venue_name}
          />
          <Field name="address" label="Dirección" defaultValue={e.address} />
          <EventSchedule event={e} />
          <label className="field full">
            <span>Descripción del evento</span>
            <textarea
              name="description"
              rows={7}
              maxLength={5000}
              defaultValue={e.description}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            Guardar cambios del evento
          </button>
        </form>
        <p className="helper" style={{ marginTop: 16 }}>
          Los precios y nombres guardados en ventas anteriores se conservan. Si
          cambias fecha o lugar, avisa a los compradores; los PDF enviados
          anteriormente conservan su información original.
        </p>
      </section>
      <section className="panel">
        <h2>Portada y galería</h2>
        <p className="helper" style={{ margin: "12px 0 20px" }}>
          Hasta 8 imágenes JPG, PNG o WebP, de máximo 4 MB cada una. La portada
          aparece en el catálogo y todas las fotos en la página de compra.
        </p>
        <label className="field">
          <span>Agregar imágenes del evento</span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || busy || e.images.length >= 8}
            onChange={(ev) => {
              const files = Array.from(ev.currentTarget.files ?? []);
              ev.currentTarget.value = "";
              if (files.length) void images(files);
            }}
          />
        </label>
        {uploading && <p role="status">Guardando imágenes…</p>}
        <div className="event-image-grid">
          {e.images.map((image: Row, index: number) => (
            <div key={image.id}>
              <img src={image.url} alt={`Imagen ${index + 1} de ${e.title}`} />
              <div className="buttons">
                <button
                  type="button"
                  className="btn"
                  disabled={image.cover || busy || uploading}
                  onClick={() =>
                    run(
                      {
                        action: "event_cover",
                        event_id: e.id,
                        image_id: image.id,
                      },
                      "Portada actualizada",
                    )
                  }
                >
                  {image.cover ? "Portada actual" : "Usar de portada"}
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy || uploading}
                  onClick={() => setPendingRemove(image.id)}
                >
                  Eliminar imagen {index + 1}
                </button>
              </div>
            </div>
          ))}
        </div>
        {pendingRemove && (
          <div className="image-confirm-backdrop">
            <section
              className="panel"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="remove-image-title"
              aria-describedby="remove-image-description"
            >
              <h3 id="remove-image-title">Eliminar imagen del evento</h3>
              <p id="remove-image-description" style={{ margin: "16px 0" }}>
                La foto se retirará de la portada y galería. ¿Quieres
                eliminarla?
              </p>
              <div className="buttons">
                <button
                  className="btn"
                  type="button"
                  autoFocus
                  onClick={() => setPendingRemove(null)}
                >
                  Cancelar eliminación
                </button>
                <button
                  className="btn danger"
                  type="button"
                  disabled={uploading || busy}
                  onClick={() => {
                    const id = pendingRemove;
                    setPendingRemove(null);
                    void remove(id);
                  }}
                >
                  Eliminar imagen
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
export function EditTicketType({
  type: t,
  eventId,
}: {
  type: Row;
  eventId: string;
}) {
  const { run, busy } = useApp();
  const [editing, setEditing] = useState(false);
  return editing ? (
    <form
      className="section-stack"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (
          await run(
            {
              action: "update_type",
              event_id: eventId,
              ticket_type_id: t.id,
              ...formValues(ev.currentTarget),
            },
            "Localidad actualizada",
          )
        )
          setEditing(false);
      }}
    >
      <Field name="name" label={`Nombre de ${t.name}`} defaultValue={t.name} />
      <Field
        name="capacity"
        label={`Cupo total de ${t.name}`}
        type="number"
        min={t.committed}
        max={1000000}
        defaultValue={t.capacity}
      />
      <span className="helper">
        Disponibles = cupo total − {t.committed} comprometidas. El aforo total
        limita la venta de todas las localidades.
      </span>
      <div className="buttons">
        <button className="btn primary" disabled={busy}>
          Guardar localidad
        </button>
        <button type="button" className="btn" onClick={() => setEditing(false)}>
          Cancelar edición
        </button>
      </div>
    </form>
  ) : (
    <button className="btn" onClick={() => setEditing(true)}>
      Editar {t.name}
    </button>
  );
}
export function EventGallery({ event: e }: { event: Row }) {
  const [selected, setSelected] = useState<string | null>(null);
  const images = e.images as Row[];
  const main =
    images.find((i) => i.id === selected)?.url ?? e.cover_url ?? images[0]?.url;
  if (!main) return null;
  return (
    <div className="event-gallery">
      <img
        className="event-main-image"
        src={main}
        alt={`Imagen de ${e.title}`}
      />
      {images.length > 1 && (
        <div className="event-thumbnails">
          {images.map((image, index) => (
            <button
              type="button"
              key={image.id}
              aria-label={`Ver imagen ${index + 1} del evento`}
              aria-pressed={main === image.url}
              onClick={() => setSelected(image.id)}
            >
              <img src={image.url} alt={`Vista ${index + 1} de ${e.title}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
