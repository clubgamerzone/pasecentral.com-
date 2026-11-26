# Preparación de Wompi producción — 2026-11-21

## Confirmación del reglamento general — 2026-11-26

Se consultó el reglamento Colombia V4-2026 publicado en https://wompi.com/assets/downloadble/reglamento-Comercios-Colombia.pdf. Numeral 14.1, página 46 del PDF (índice45): uso en nombre propio/representación legal; operar en nombre de terceros requiere autorización expresa de Wompi. El mismo numeral exceptúa las transferencias realizadas mediante aplicaciones habilitadas para SPT. Esa excepción permite distinguir el pago a beneficiarios de la autorización para recaudar ventas de otros organizadores. Numeral17.7: ceder operación/contrato también requiere consentimiento. No hay evidencia de autorización individual del comercio actual; no se debe presentar como confirmado que su cuenta puede recaudar por otros organizadores.

Activación SPT documentada: https://docs.wompi.co/docs/colombia/activacion-pagos-a-terceros/. Solicitud desde el dashboard por representante legal, elección Wompi Cuenta/plan e identidad/condiciones; Wompi notifica cuando habilita. No se activó ni aceptó contrato en esta consulta.

Consulta concreta preparada para soporte/comercial, sin enviar: «Somos Pase Central, plataforma de boletería. Queremos cobrar en nuestro comercio Wompi entradas de eventos de organizadores terceros y liquidarles posteriormente el saldo neto mediante Pagos a Terceros, mientras activan sus propios comercios. ¿Autorizan expresamente este modelo para nuestro comercio conforme al numeral14.1? ¿Qué contrato, validaciones y responsabilidades de reembolsos/contracargos exige, y permiten algún traslado directo de saldo entre comercios Wompi?». Hace falta respuesta específica de Wompi para confirmar el permiso individual; no confundir revisión documental con respuesta de soporte ni verificar SPT privado.

## Consulta: entregar saldo al cliente tras su alta — 2026-11-26

No se encontró en las fuentes oficiales revisadas una función general de traslado directo de saldo entre dos comercios Wompi; no prometer una migración de saldo/transacciones. El retiro documentado permite, con Pagos a Terceros activo, crear órdenes hacia cuentas bancarias propias o de terceros utilizando saldo disponible. Es una liquidación/pago al cliente, distinta de trasladar la venta al historial de su comercio. Confirmar disponibilidad, destinos, costes, plazos y autorización del modelo con Wompi antes de recaudar para otro organizador. La cuenta específica del propietario no fue inspeccionada ni se confirmó que tenga SPT activo.

Diseño de un futuro cambio de comercio: las ventas nuevas usarían las credenciales del cliente y las anteriores conservarían el comercio que las procesó para consultas, notificaciones y seguimiento; cambiar las llaves no debe romper pagos pendientes ni conciliación histórica. No implementado en esta consulta. No se activaron servicios, movieron fondos o cambiaron llaves.

Fuente de retiro: https://soporte.wompi.co/hc/es-419/articles/25978979587859--C%C3%B3mo-retirar-el-dinero-de-mi-Wompi-cuenta

Fuente de saldo/dispersión: https://docs.wompi.co/docs/colombia/cuentas-pagos-a-terceros/

## Aclaración sobre cuentas de clientes — 2026-11-26

La respuesta previa de que cada cliente necesita obligatoriamente una cuenta propia de Wompi fue demasiado general. Para una demostración sandbox se conserva un solo comercio de pruebas y no hay abonos reales a bancos/Nequi. Para recaudo comercial directo por organizador, sus propias credenciales/comercio siguen siendo una alternativa; no se implementaron credenciales por organización.

La documentación de Wompi exige que la cuenta recaudadora esté a nombre del titular del comercio; no se debe tratar la cuenta bancaria/Nequi de otro cliente como un destino libremente intercambiable del checkout de nuestro comercio. El recaudo normal tampoco divide automáticamente una venta entre beneficiarios. Pagos a Terceros es un producto distinto para enviar fondos posteriormente, requiere activación y no acredita por sí solo que nuestro contrato permita recaudar ventas ajenas. Centralizar cobros y liquidar a organizadores requiere confirmar ese modelo con Wompi, responsabilidades/acuerdos y conciliación; no está implementado ni autorizado para operar por esta consulta. No se cambió configuración, se contactó a terceros o se movió dinero.

Fuentes oficiales revisadas el 2026-11-26:
- https://soporte.wompi.co/hc/es-419/articles/1500007714942--Que-cuenta-recaudadora-puedo-inscribir-para-recibir-los-pagos-de-Nequi
- https://soporte.wompi.co/hc/es-419/articles/360045935394--Wompi-maneja-Split-de-pagos
- https://docs.wompi.co/docs/colombia/que-es-pagos-a-terceros/

Estado: consulta de requisitos, sin autorización de esta entrega para cambiar credenciales, activar cobros o realizar pagos reales. No se inspeccionó el estado comercial privado de Wompi ni se da por aprobado. El adaptador actual admite producción; eso no certifica lanzamiento comercial.

## Requisitos y orden de ejecución

1. Confirmar en Wompi que el comercio completó vinculación/activación y sus medios de pago están habilitados. Verificar titular, cuenta de abono habilitada, tarifas y calendario de desembolsos del contrato; pago aprobado no equivale a dinero abonado en banco. Los documentos concretos dependen del registro/solicitud del proveedor.
2. Definir origen HTTPS de producción y separar pruebas/datos de ventas reales. No convertir automáticamente entradas emitidas mediante pagos sandbox en entradas comerciales. Conservar staging y su webhook propios; acordar corte de datos o base de producción antes de modificar el ambiente compartido.
3. Guardar en variables privadas del servidor de producción: WOMPI_PUBLIC_KEY (pub_prod_), WOMPI_PRIVATE_KEY (prv_prod_), WOMPI_EVENTS_SECRET (prod_events_), WOMPI_INTEGRITY_SECRET (prod_integrity_). No recibirlas por chat ni guardarlas en Git. Configurar WOMPI_ENV=production, APP_ENVIRONMENT=production, APP_MODE=production y APP_URL con el origen HTTPS exacto; mantener sandbox en staging. Revisar Supabase/Auth/Resend/worker y URLs de retorno para ese origen.
4. Registrar la URL de eventos de producción `https://HOST-PRODUCCION/api/webhooks/wompi` en el ambiente correspondiente de Wompi. Usar URL distinta de sandbox como indica el proveedor. El retorno de checkout es `/checkout/result`; por sí solo no confirma pagos.
5. Revisar evento/precios/cupos reales, datos del organizador/contacto, condiciones de compra/devolución y definición fiscal pendiente del propietario/contador. Tras autorización explícita de activar dinero real y de un pago controlado, comprobar importe/referencia/moneda, pago consultado en API de producción, webhook verificado, emisión única, PDF/correo/Mis entradas e ingreso. Consultar desembolso según plazo contratado; no prometer transferencia inmediata.

## Código existente y verificación realizada

`src/lib/wompi.ts` selecciona production.wompi.co al usar WOMPI_ENV=production, valida prefijo de llave pública, firma checkout y comprueba ambiente/firma de eventos. `src/lib/config.ts` distingue staging/production mediante APP_ENVIRONMENT y WOMPI_ENV. Variables en `.env.example`. El modo APP_MODE=production también se usa en staging conectado: no prueba que se esté cobrando dinero real.

Esta revisión solo leyó código y documentación. No se cambiaron variables/cloud/base de datos ni se cobró nada. Usar además `LAUNCH_CHECKLIST.md`; el ensayo sandbox y pruebas locales no reemplazan una compra real autorizada y seguimiento del proveedor.

## Fuentes oficiales consultadas

- https://docs.wompi.co/docs/colombia/ambientes-y-llaves/
- https://docs.wompi.co/docs/colombia/eventos/
- https://www.wompi.co/es/co/ayuda/como-crear-cuenta
- Reglamento comercial y condiciones de abono aplicables disponibles desde el registro/dashboard Wompi; confirmar versión y plan concretos del comercio.
