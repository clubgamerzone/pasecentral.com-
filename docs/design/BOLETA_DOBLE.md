# Boleta de dos partes · diseño06 aprobado e integrado

**Estado vigente:** el propietario aprobó integrar el diseño. Código/vista/PDF/arte por evento ya implementados localmente; funcionamiento y pruebas en [../TICKET_DOUBLE_LAYOUT.md](../TICKET_DOUBLE_LAYOUT.md). Las secciones siguientes conservan el historial de propuestas y sus pendientes de aquel momento. La impresión física del nuevo diseño aún no se ha enviado. (2026-11-19)

Solicitud del propietario: una entrada por persona debe ocupar dos tramos consecutivos del papel actual, cada uno70x40mm; conjunto70x80mm, con perforación intermedia. Corrección del propietario: parte superior con QR para retener en control de ingreso; parte inferior sin QR, con información del evento, como recuerdo del comprador. Primero revisar diseño en el chat y ajustar antes de imprimir. La vista de la app deberá coincidir con la plantilla física; formato predeterminado solicitado70x40 con dos tramos por entrada.

## Artefactos y reproducción
- `docs/design/boleta-doble-v1.html`: propuesta HTML/CSS determinista, medidas en mm; QR de muestra generado con qrcode ya instalado.
- `docs/design/boleta-doble-v1.png`: captura de Chromium para revisión, ampliada; no expresa tamaño real en pantalla.
- Scripts privados de reproducción: `.local/create-ticket-design.mjs` y `.local/render-ticket-design.mjs` (node y Playwright existentes).
- Diseño negro sobre blanco, cabecera, evento/localidad/fase/precio COP, fecha/hora/lugar, consecutivo y serial. Versión01 tenía dos QR, descartados por el propietario; versión02 tiene un QR solo en la parte superior. Sin datos reales ni credenciales de acceso.
- Revisado visualmente después de ajustar interlineado para que lugar/footer no se superpongan. Dos mitades con mismo tamaño y corte al centro. QR18mm en propuesta; legibilidad con credenciales reales/EDA51 queda pendiente de ensayo físico.

## Reglas para implementación posterior
Una orden sigue emitiendo una entrada y una credencial por persona. Ambas mitades representan esa misma entrada: no duplicar emisión, cupo, cobro o check-in. Imprimir dos formatos consecutivos de40mm (mantener paso de marca negra), no asumir que configurar80mm de largo se alinea con el sensor actual. Numeración y serial vinculan ambas partes; QR únicamente en el talón superior de control. La parte inferior contiene evento, fecha/hora, localidad, fase/precio, recinto y dirección, sin QR. Cualquier reimpresión conserva identidad y auditoría. Validar antes de arrancar/retener talón.

Pendiente tras revisión del propietario: integrar la plantilla en pantalla, impresión navegador y RAW/QZ; cambiar predeterminado y gestionar preferencias anteriores; ensayar alineación de parejas consecutivas y lectura real. No se modificaron aún print-settings, ticket-zpl, PDF, plantilla activa de la app, impresora o base de datos en esta propuesta. No se envió ningún trabajo de impresión ni push/deploy. No considerar aprobado por render visual.


## Revisión 02 solicitada por propietario
Artefactos vigentes para revisar: `boleta-doble-v2.html` y `boleta-doble-v2.png`. Un único QR arriba (22mm en esta propuesta), sin repetirlo abajo. Información principal y dirección abajo, como recuerdo. Se conserva número/serial en ambas partes para vincularlas. Versión01 se conserva solo como historial. Scripts privados create-ticket-design-v2.mjs y render-ticket-design-v2.mjs. Render revisado y ajustado para evitar solapamiento de instrucciones y pie. Sin impresión, cambios de app o ensayos físicos; propuesta todavía en revisión.


## Revisión 03: logo por evento
El propietario solicita reemplazar el bloque Escanear al ingresar por un logo del evento junto al QR superior. El administrador del evento deberá poder subir ese logo. La portada/afiche y el logo para boletas son recursos distintos; usar el título del afiche Retrofest enviado como referencia para esta propuesta.

Artefactos actuales: `boleta-doble-v3.html/png` y `retrofest-logo-bw-v1.png`. Logo monocromático adaptado con la habilidad imagegen y herramienta integrada, conservando título Retrofest1.0/A la calle y excluyendo resto del afiche. No es una extracción de píxeles idéntica al original. Versión03 renderizada con HTML/CSS y Playwright existentes. QR solo arriba, recuerdo sin QR abajo.

Pendiente al integrar la app: campo Logo para boletas dentro de edición de evento, carga/vista previa/cambio/remoción con permiso manage verificado en servidor; recurso separado de portada, almacenamiento y entrega autorizados; mismo logo/composición en pantalla y transporte de impresión, conversión monocromática legible en203dpi. La propuesta no crea aún este campo ni sube imágenes a Storage. No se ha impreso ni ensayado físicamente. Formato y comportamiento siguen en revisión del propietario.

Logo generado se copió a este directorio; original conservado en el directorio generated_images de Codex. Procedimiento/prompt en LOGO_RETROFEST.md. Scripts privados create-ticket-design-v3.mjs y render-ticket-design-v3.mjs.


## Revisión 04: equipos arriba y logo en recuerdo
Corrección del propietario: quitar Retener al ingresar, usar un mensaje llamativo y añadir los dos equipos de sonido del afiche; el logo va mejor en la parte del usuario. Propuesta04: QR único y arte monocromático de los dos equipos arriba, texto ¡A LA CALLE CON TODO!; logo Retrofest, localidad/fase/precio, fecha/hora/lugar/dirección y consecutivo/serial abajo, sin QR. No se repite la instrucción Retener al ingresar en la boleta.

Artefactos vigentes: `boleta-doble-v4.html/png`, `retrofest-equipos-bw-v1.png` (adaptación con imagegen integrado a partir del afiche del propietario) y logo anterior. Se mantienen versiones previas como historial. Scripts privados create-ticket-design-v4.mjs/render-ticket-design-v4.mjs. El detalle de los equipos es una reinterpretación monocromática simplificada, no una conversión idéntica píxel por píxel. Legibilidad de esos detalles a tamaño real203dpi todavía no probada; revisar al ensayar hardware.

Render revisado y ajustados altura de filas y márgenes del pie. Sin trabajos de impresión, cambios de configuración/plantilla activa, Storage o base de datos. Diseño continúa en revisión antes de integrar la app.


## Revisión 05: talón de control con precio y ubicación
El propietario pide precio y ubicación arriba para contar los tickets retenidos por valor. Propuesta05 coloca QR, localidad, fase aplicada, precio destacado, recinto/dirección y consecutivo/serial en el talón superior. Logo y los dos equipos de sonido pasan al recuerdo inferior, junto a fecha/hora/lugar/dirección y los mismos identificadores, sin QR. Se conserva el mensaje ¡A LA CALLE CON TODO! abajo.

Artefactos vigentes `boleta-doble-v5.html/png`; reutilizan las imágenes monocromáticas existentes, sin nueva generación. Scripts privados create-ticket-design-v5.mjs/render-ticket-design-v5.mjs. Render inspeccionado. Al integrar, el precio y nombre de fase/localidad deben salir del snapshot de la venta, nunca del precio vigente posteriormente; no agregarlo como venta nueva ni alterar la credencial. Contar talones por valor es apoyo operativo, no reemplaza reporte/cierre de caja ni identifica automáticamente el medio de pago.

Sin impresión o cambios de la plantilla activa, base de datos o ajustes del dispositivo. Continúa revisión de diseño antes de implementación/ensayo físico.


## Revisión06: composición superpuesta y sin etiqueta del comprador
El propietario pide quitar Recuerdo del comprador y juntar/superponer el logo a los equipos. La mitad inferior ya no lleva esa cabecera; muestra un emblema integrado de Retrofest1.0/A la calle delante de ambos equipos, con separación blanca para leer las letras. Talón superior de precio/QR se conserva. Fecha/hora/lugar/dirección y números siguen separados debajo del arte.

Artefactos vigentes `boleta-doble-v6.html/png` y `retrofest-composicion-bw-v1.png`. Composición generada con imagegen integrado a partir de las dos adaptaciones B/N anteriores; no es un calco exacto del afiche. Original generado conservado, copia en docs/design. Prompt y modo documentados en LOGO_RETROFEST.md. Scripts privados create-ticket-design-v6.mjs/render-ticket-design-v6.mjs. Render inspeccionado; sin impresión o cambios de app/Storage/base de datos. Detalle fino todavía requiere ensayo físico203dpi.
