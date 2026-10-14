export const dynamic = "force-dynamic";
export default function Privacy() {
  return (
    <main className="content">
      <a href="/events" className="link">
        Volver a eventos
      </a>
      <section className="panel" style={{ marginTop: 30 }}>
        <h1>Aviso de privacidad</h1>
        <p>
          El género de cuenta puede indicarse como “Prefiero no responder”; el
          rango de edad es opcional. Para una entrada propia se guarda una copia
          estadística de esos datos al comprar. No se copian a todos los
          acompañantes. El destinatario de un regalo o transferencia acepta con
          su identidad verificada; si recibe varias entradas, sus datos
          describen solo la primera.
        </p>
        <p>
          Los datos declarados son información personal protegida. No pedimos
          documentos ni fechas de nacimiento para los análisis. El perfil se
          elimina al cerrar la cuenta y las entradas propias sin usar quedan
          anuladas. Se conserva historial de ventas, pagos y auditoría; no se
          promete borrar todos los registros financieros. Los reportes de
          audiencia muestran agregados a gestores autorizados.
        </p>
        <p style={{ whiteSpace: "pre-wrap" }}>
          {process.env.PRIVACY_TEXT ??
            "Entorno de desarrollo: aviso definitivo pendiente de aprobación del organizador. La aplicación usa los datos de cuenta y contacto para administrar compras, entregar entradas y controlar el acceso. Los QR y enlaces compartidos son credenciales sensibles. Antes de abrir ventas reales deben configurarse responsable del tratamiento, contacto, retención y procedimiento de atención de solicitudes."}
        </p>
        <p style={{ marginTop: 20 }}>
          Si eliges facilitar datos opcionales de asistentes, se guardan género
          y rango de edad por entrada para elaborar estadísticas agregadas del
          evento. No pedimos fecha de nacimiento ni nombre del asistente para
          estos análisis. Omitir estos datos no afecta la compra ni concede
          permisos; los reportes están restringidos a administradores y
          organizadores autorizados.
        </p>
      </section>
    </main>
  );
}
