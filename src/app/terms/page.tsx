export const dynamic = "force-dynamic";
export default function Terms() {
  return (
    <main className="content">
      <a href="/events" className="link">
        Volver a eventos
      </a>
      <section className="panel" style={{ marginTop: 30 }}>
        <h1>Condiciones de compra</h1>
        <h2>Cuenta y uso de entradas</h2>
        <p>
          Al crear una cuenta aceptas el uso de tu información declarada para
          operar la plataforma y elaborar estadísticas del público. Puedes
          elegir no informar género y omitir la edad. La edad mínima se indica
          en cada evento; la declaración de perfil no sustituye la verificación
          en el ingreso.
        </p>
        <p>
          Los regalos y transferencias deben aceptarse con una cuenta de correo
          confirmado en un plazo de 7 días desde su creación; mientras esperan
          aceptación no autorizan ingreso. Si se rechazan, cancelan o vencen,
          las entradas vigentes vuelven al remitente. Aceptar cambia el titular
          y renueva el QR; los códigos anteriores dejan de servir.
        </p>
        <p>
          Eliminar tu cuenta es irreversible: se anulan tus entradas propias sin
          usar, no se realiza una devolución automática y se conserva el
          historial de ventas y auditoría. Las entradas transferidas y ya
          aceptadas por otra persona siguen siendo de ella. El último
          administrador debe asignar otro antes de eliminarse; se deben cerrar
          cajas y resolver archivos de eventos bajo su propiedad.
        </p>
        <p style={{ whiteSpace: "pre-wrap" }}>
          {process.env.PURCHASE_TERMS ??
            "Entorno de desarrollo: condiciones definitivas pendientes de aprobación del organizador. Cada entrada es un pase de acceso, permite un único ingreso durante el horario autorizado y debe conservarse de forma privada. Una reserva no equivale a una entrada. Los pagos online requieren confirmación verificada del proveedor. Las devoluciones se resuelven con el organizador. Antes del lanzamiento deben configurarse los datos de contacto, políticas de cancelación y condiciones definitivas."}
        </p>
      </section>
    </main>
  );
}
