"use client";
import { useState } from "react";
import { auditOperations } from "@/lib/audit-labels";
export function AuditGuide() {
  const [search, setSearch] = useState("");
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const matches = Object.entries(auditOperations)
    .filter(([code, info]) =>
      normalize(`${code} ${info.label} ${info.description}`).includes(
        normalize(search),
      ),
    )
    .sort((a, b) => a[1].label.localeCompare(b[1].label, "es"));
  return (
    <details className="audit-guide" style={{ marginTop: 18 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Guía de códigos de operación
      </summary>
      <p className="helper" style={{ margin: "14px 0" }}>
        Operación indica qué ocurrió; entidad indica qué registro se afectó;
        responsable indica quién lo realizó. Sistema identifica acciones
        automáticas. La guía explica códigos y no añade registros al historial.
      </p>
      <label className="field" style={{ maxWidth: 520 }}>
        <span>Buscar código u operación</span>
        <input
          type="search"
          value={search}
          onChange={(ev) => setSearch(ev.target.value)}
          placeholder="Por ejemplo: profile_updated o caja"
        />
      </label>
      <p className="helper" style={{ margin: "12px 0" }}>
        {matches.length} {matches.length === 1 ? "definición" : "definiciones"}
      </p>
      <div style={{ maxHeight: 440, overflowY: "auto" }}>
        {matches.map(([code, info]) => (
          <article
            key={code}
            style={{
              padding: "14px 4px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <b>{info.label}</b>
            <br />
            <code style={{ fontSize: 12, overflowWrap: "anywhere" }}>
              {code}
            </code>
            <p style={{ marginTop: 8 }}>{info.description}</p>
          </article>
        ))}
        {!matches.length && <p>No encontramos ese código en la guía.</p>}
      </div>
    </details>
  );
}
