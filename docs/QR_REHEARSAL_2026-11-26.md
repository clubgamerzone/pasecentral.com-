# Ensayo de acceso con tres escenarios

Preparación solicitada por el propietario el 26 de noviembre de 2026. Exclusivamente desarrollo conectado a Supabase staging y Wompi sandbox. No modifica producción ni elimina registros existentes.

## Dónde encontrarlo

- Aplicación local: `http://192.168.1.15:3000/login`, desde PC o Honeywell en la misma red.
- Eventos: **ENSAYO QR · ANTES DE ABRIR**, **ENSAYO QR · ACCESO ABIERTO** y **ENSAYO QR · ACCESO CERRADO**.
- Guía privada con enlaces de eventos, órdenes, lotes y PDF: `.local/ensayo-qr-2026-11-26/index.html`.
- Preparador privado: `.local/prepare-qr-rehearsal.ts`. Invoca `execute` en `src/lib/service.ts`, `preprintDocument` en `src/lib/preprints.ts` y `ticketPdf` en `src/lib/pdf.ts`.
- Manifiesto y resultados privados: `manifest.json` y `checks.json` en la misma carpeta. No contienen tokens QR; los documentos PDF sí contienen credenciales y no deben publicarse.

El preparador rechaza un perfil live, una base distinta del staging autorizado o Wompi distinto de sandbox. Se ejecutó mediante `node --env-file=.env.local --import tsx .local/prepare-qr-rehearsal.ts`. No repetirlo automáticamente: el manifiesto impide duplicar el ensayo. La creación inicial de eventos, localidades, fases, órdenes y lotes usa una transacción; la preparación posterior registra los cambios normales de estado mediante el servicio.

## Horarios ficticios, zona Colombia

| Escenario | Apertura | Cierre de acceso |
| --- | --- | --- |
| Antes | 10 diciembre 2026, 00:00 | 10 diciembre 2026, 23:59:59 |
| Abierto | 26 noviembre 2026, 00:00 | 27 noviembre 2026, 23:59:59 |
| Cerrado | 25 noviembre 2026, 00:00 | 25 noviembre 2026, 23:59:59 |

Son horarios de ensayo, no la fecha del primer evento real. Después del cierre, el escenario abierto dejará de admitir entradas; cambiar sus horarios desde Administración si se continúa otro día.

## Boletas por escenario

Cada evento tiene General y VIP, cupos ficticios y una fase para ambos canales. Las ventas preparadas son manuales, por transferencia **ficticia**, sin dinero ni proveedor externo; las cortesías tienen precio cero y motivo documentado.

- Tres General para probar documentos digitales, selección individual e impresión.
- Una VIP.
- Dos cortesías.
- Una anulada.
- Una de control QA; solo la del escenario abierto queda usada por la comprobación automática.
- Lote de seis preimpresas: cuatro sin activar, una bloqueada y una activada. La activada conserva su QR y consecutivo y posee su orden de venta.

Total esperado: tres eventos, seis localidades, dieciocho órdenes, veintisiete entradas emitidas y dieciocho registros preimpresos. Los tres registros preimpresos activados corresponden a entradas ya contadas, no a entradas adicionales.

## Recorrido recomendado

1. Abrir la guía privada en el PC e iniciar sesión en desarrollo como administrador. En Honeywell abrir `/access`. El lector identifica el evento por QR automáticamente.
2. Escanear un General del escenario antes: rechaza por horario. Repetir en cerrado: mismo rechazo, sin consumir la entrada.
3. Escanear un General del abierto: acepta una vez. Volver a escanear: usada. Repetir con VIP y cortesía; también consumen un solo ingreso.
4. Escanear la entrada anulada y la preimpresa bloqueada: rechazan. La de control QA del abierto ya debe indicar usada.
5. Escanear una preimpresa sin activar en Acceso: indica sin activar. En el menú lateral abrir **Boletas preimpresas** (es una sección separada de **Taquilla**) y pulsar **Activar venta**. Escanear el QR y pulsar **Consultar boleta**; el sistema identifica su evento. Elegir medio de pago y completar sus requisitos; para efectivo abrir caja si se solicita, o para transferencia ficticia indicar referencia y confirmar verificación. Pulsar **Confirmar cobro y activar boleta**. Volver a Acceso: en abierto acepta; antes/cerrado rechaza por horario. No confundir activación de venta con validación de ingreso. La vista de impresión `/box-office/preprints/[batchId]` no es el formulario de activación: este se encuentra en `/box-office/preprints`.
6. Abrir una orden desde la guía, seleccionar una entrada e imprimir con el perfil STARPOS homologado. Una persona ocupa dos tramos de 70 × 40 mm, con QR solo en el tramo superior. No cambiar calibración ni tamaño del driver por estos fixtures.
7. Para probar una compra web real de sandbox, entrar al evento desde Explorar eventos con una cuenta confirmada. Las órdenes preparadas son ventas manuales de ensayo y no aparecen como compras propias por el simple nombre del comprador.

## Correos, comprobaciones y límites

Actualización posterior del mismo día: **Activar venta** abre ahora **Venta rápida al escanear**, que cobra y activa automáticamente usando el medio preparado. Para efectivo, abrir caja del evento primero; para transferencia, preparar referencia y verificación individual antes de escanear. El recorrido con **Consultar boleta** y confirmación manual del paso 5 corresponde a **Venta con datos / correo**. Guía actual: `docs/PREPRINT_QUICK_SALE.md`.

Los fixtures no tienen correo de entrega: no crean avisos ni envían mensajes. El cron staging sigue pausado para mantener el aislamiento del lanzamiento. La recuperación, confirmación de cuenta y entrega de una compra con correo requieren un ensayo separado dirigido a una dirección propia y un worker staging configurado contra el servidor correcto; no reutilizar el programador de producción.

Los PDF utilizan el mismo renderizador rasterizado y fuentes de la aplicación, con tamaño 70 × 80 mm por persona. No se enviaron trabajos físicos a la impresora. Las comprobaciones automáticas verifican reglas del servidor; no prueban la lectura física, alineación del papel, conexión Honeywell ni recepción de correo.

Resultados finales de preparación y revisión: consultar `docs/PROGRESS.md` y el archivo privado `checks.json`. Sin commit ni publicación requeridos para usar estos datos de desarrollo.
