export const dynamic = "force-dynamic";
export default function Terms() {
  return (
    <main className="content">
      <a href="/events" className="link">
        Volver a eventos
      </a>
      <section className="panel" style={{ marginTop: 30 }}>
        <h1>Condiciones de compra</h1>
        <p style={{ whiteSpace: "pre-wrap" }}>
          {process.env.PURCHASE_TERMS ??
            "Entorno de desarrollo: condiciones definitivas pendientes de aprobación del organizador. Cada entrada es un pase de acceso, permite un único ingreso durante el horario autorizado y debe conservarse de forma privada. Una reserva no equivale a una entrada. Los pagos online requieren confirmación verificada del proveedor. Las devoluciones se resuelven con el organizador. Antes del lanzamiento deben configurarse los datos de contacto, políticas de cancelación y condiciones definitivas."}
        </p>
      </section>
    </main>
  );
}
