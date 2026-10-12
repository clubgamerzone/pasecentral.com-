export const dynamic = "force-dynamic";
export default function Privacy() {
  return (
    <main className="content">
      <a href="/events" className="link">
        Volver a eventos
      </a>
      <section className="panel" style={{ marginTop: 30 }}>
        <h1>Aviso de privacidad</h1>
        <p style={{ whiteSpace: "pre-wrap" }}>
          {process.env.PRIVACY_TEXT ??
            "Entorno de desarrollo: aviso definitivo pendiente de aprobación del organizador. La aplicación usa los datos de cuenta y contacto para administrar compras, entregar entradas y controlar el acceso. Los QR y enlaces compartidos son credenciales sensibles. Antes de abrir ventas reales deben configurarse responsable del tratamiento, contacto, retención y procedimiento de atención de solicitudes."}
        </p>
      </section>
    </main>
  );
}
