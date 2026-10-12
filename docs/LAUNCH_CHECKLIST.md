# Lista de lanzamiento comercial

El código local y las pruebas automatizadas no sustituyen este ensayo. Estado inicial: pendiente de servicios y hardware.

## Configuración y autorización

- [ ] Fecha, horario de acceso y aforo del primer evento confirmados por el organizador.
- [ ] Nombre comercial, recinto, localidades, precios, contacto y categorías de comprador aprobados.
- [ ] Condiciones de compra/cancelación y aviso de privacidad definitivos configurados en `PURCHASE_TERMS` / `PRIVACY_TEXT`.
- [ ] Definición fiscal confirmada con cliente y contador; entrada no presentada como factura.
- [ ] Hosting HTTPS, `APP_URL` exacto, secretos privados y `APP_MODE=production`; ningún usuario/seed demo publicado.
- [ ] Supabase real con migraciones, RLS, Auth, confirmación de correo y bucket privado comprobados.
- [ ] Bootstrap del administrador por CLI y usuarios operativos verificados/asignados.
- [ ] Copias de seguridad, claves y restauración aislada comprobadas.

## Pagos y entrega

- [ ] Wompi sandbox: aprobación, rechazo, expiración y retorno verificados con credenciales reales sandbox.
- [ ] Webhook HTTPS configurado, checksum inválido rechazado, referencia/importe/moneda reconciliados contra API.
- [ ] Duplicados, eventos atrasados y pago tardío sin cupo ensayados con varias conexiones PostgreSQL.
- [ ] Incidencia `needs_review` y devolución manual ensayadas; VOIDED posterior conciliado.
- [ ] Cuenta comercial y autorización para pagos reales confirmadas antes de cambiar `WOMPI_ENV=production` y llaves.
- [ ] Resend con dominio y remitente verificados; entrega real, fallo, reintento y revocación de enlace ensayados.
- [ ] Scheduler del worker activo y monitorizado; no expone `WORKER_SECRET` en logs.

## Operación física

- [ ] Modelo exacto de impresora 80 mm, driver y SO de taquilla homologados.
- [ ] Papel real: QR, márgenes, contraste, cortes y reimpresión legibles con EDA51.
- [ ] QZ Tray/certificado/firma configurados si se utiliza impresión directa.
- [ ] Android/navegador del EDA51 y scanner como teclado + Enter comprobados.
- [ ] Dos lectores sobre el mismo QR producen una sola aceptación en Supabase real.
- [ ] Resultado recuperable tras perder respuesta y modo sin red nunca aprueba ingreso.
- [ ] Latencia medida con carga/dispositivos representativos; objetivo menor de dos segundos.
- [ ] Cantidad de puertas, lectores y taquillas; conectividad y respaldo validados en recinto.
- [ ] Ensayo con organizador, taquilla y acceso: dos eventos, compra múltiple, cortesía, devolución, caja, CSV.
- [ ] Procedimiento supervisado de contingencia y atención al comprador aprobado.

## Software y publicación

- [x] CI remoto en GitHub comprobado para el código publicado `adb8c9bde8aff64428791b6f59d267132da79072` (ejecución 38206422699).
- [ ] Revisar los avisos de dependencias de desarrollo de la cadena de ESLint antes del lanzamiento.
- [ ] Prueba multiconexión/carga en base de datos objetivo y revisión de límites/tamaño de exportaciones.
- [ ] Revisión de entorno: ninguna clave, outbox, datos privados o demo en producción.
- [ ] Si se desea indexación pública, cambiar deliberadamente `robots` en metadata; actualmente noindex.
- [ ] Despliegue del sitio y dominio solicitado/autorizado por separado; verificar URL real después del deploy.
