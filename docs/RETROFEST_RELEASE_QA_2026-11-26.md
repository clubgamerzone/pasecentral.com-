# Retro Fest: copia a producción y QA de lanzamiento

## Resultado publicado

Autorizaciones explícitas del propietario: copiar Retro Fest/configuración a producción y después publicar las correcciones web verificadas, excluyendo APK.

Enlace público: https://pasecentral.app/events/retro-fest-1-0

- Retro Fest 1.0, organización **Carnavaleando en el Hipodromo**.
- 8 diciembre 2026, 14:00 Colombia; apertura igual al inicio, sin fin/cierre configurados.
- Evento y General ilimitados; VIP con cupo100; edad mínima18.
- Preventa: General COP10000, VIP COP15000. Fases del día del evento: COP15000/COP30000. Ambas localidades conservan las cuatro fases, canales, horarios y estados originales.
- Descripción, recinto y dirección copiados sin inventar datos.
- Portada transferida a Storage privado de producción usando la sesión administrativa normal; imagen pública publicada verificada. Arte de boleta y frase copiados byte por byte y comparados por hash.

Producción no tenía eventos antes del traslado. Se crearon organización/evento/localidades/fases con permisos del administrador ya confirmado y comandos del servicio, dentro de una transacción, inicialmente en borrador. Después de subir la portada se publicó desde administración. No se copiaron cuentas, invitaciones, órdenes, pagos, tickets, lotes ni intentos de ingreso de desarrollo. El inventario de preimpresas real debe generarse en producción; los QR de ensayo no corresponden a esta base.

## Código desplegado

Commit **2328597616cc84b54688a2866abb17fd863664a6**, main, GitHub clubgamerzone/pasecentral.com-. Estado del commit en GitHub: Vercel success / Deployment has completed. Despliegue observado: https://vercel.com/jds-projects-5cb9c772/pasecentral-demo/8RENT9omPQiqWbAD1KyZ82dQ4gp2

Incluye lector dentro de Taquilla, una solicitud por activación sin recarga general, limpieza del input/foco incluso al rechazar duplicados, reintento idempotente interno, caja idempotente y bloqueo de impresión de usadas/anuladas. Pantalla real autenticada de producción mostró los modos Venta nueva / Escanear boleta preimpresa, campo lector y medios de pago. APK/código Android fuera del commit/despliegue; continúa en pausa.

## Pruebas ejecutadas

| Grupo | Resultado | Alcance |
| --- | --- | --- |
| Vitest completo |147 aprobadas,17 archivos | Reglas, permisos, cupos/concurrencia, idempotencia, pagos/webhooks, correo/PDF, cuentas/regalos, caja y preimpresas |
| Playwright completo |31 recorridos aprobados | Copia privada aislada/PGlite: comprador, taquilla, acceso, lotes, anulaciones, impresión, seguridad, invitaciones, galería, arte y UI móvil/escritorio |
| Lint/tipos/build | Aprobados para el código publicado | Next/Turbopack, sin migración nueva |
| Auditoría npm producción |0 vulnerabilidades reportadas | `npm audit --omit=dev --json`, instantánea del momento de ejecución |
| Smoke producción |32 comprobaciones aprobadas | Paridad de configuración y arte; portada realmente decodificada en navegador; precios y selección anónima; login requerido para comprar; páginas públicas200; comandos401 sin sesión, CSRF403, webhook inválido400, worker401 sin secreto; cron activo; móvil sin desbordamiento ni errores JS |

El smoke no genera compras, pagos, correos o entradas de prueba en producción. Al terminar la verificación, el evento tenía cero órdenes, tickets y lotes preimpresos. El trabajador de correos `pasecentral-delivery` estaba activo. No confundir cron activo con correo entregado a un destinatario.

## Evidencia privada y repetición

- `.local/copy-retrofest-production.ts`: guarda configuración/arte e imágenes de origen, revisa el destino y prepara o aplica la copia. Guardia de origen staging/sandbox; destino PostgreSQL producción explícito con CA/TLS verificados. `--apply` crea solo si no existe el slug.
- `.local/retrofest-production/source-config.json`: respaldo de configuración de origen, incluye identificadores internos y arte, no credenciales de acceso QR.
- `.local/retrofest-production/production-before.json`: conteos previos a copiar.
- `.local/retrofest-production/import-report.json`: mapeo a evento nuevo y archivos de portada; no secretos.
- `.local/retrofest-production-smoke.mjs`: comprobaciones de solo lectura y pruebas negativas, navegador anónimo móvil. No reserva ni invoca worker autorizado.
- `.local/retrofest-production/production-smoke.json`, `production-mobile.png`: evidencia final; fecha UTC 2026-11-26T23:29:46.494Z.
- `.local/release-qa-browser.log`, `release-dependency-audit.json`: regresión y auditoría de dependencias.

Estos archivos privados no se suben a Git. Scripts usan secretos locales existentes; no copiar sus valores a documentación, terminal, mensajes o repositorio. Para repetir solo smoke: `node .local/retrofest-production-smoke.mjs`. No volver a importar/publicar o regenerar lotes como parte de un smoke.

## Límites antes de afirmar validación completa

Falta una compra real controlada por el propietario que demuestre aprobación Wompi, webhook válido, emisión única y recepción del correo/PDF en producción. La verificación pública no hace ese cobro ni simula aprobación en live. No se han creado boletas reales preimpresas ni vuelto a homologar papel/impresora con un lote de esta base. El ensayo anterior del Honeywell fue en desarrollo; no equivale a consumir una entrada real. Las pruebas aprobadas reducen riesgo, no garantizan ausencia absoluta de bugs ni sustituyen un ensayo de carga en el recinto.

No se alteraron credenciales, ambientes, cron, cuentas o ventas del comercio en esta entrega. La fecha, cupos y precios publicados son los configurados por el propietario en el evento de origen y copiados con su autorización.
