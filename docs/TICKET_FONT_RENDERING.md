# Texto de boletas en servidores sin fuentes (2026-11-20)

## Incidente y causa

Las boletas publicadas mostraban cuadrados en lugar de letras, aunque QR, líneas y arte se veían bien. `ticket-layout.ts` enviaba elementos SVG `<text>` a Sharp/librsvg con familias DejaVu Sans/Arial/sans-serif. El entorno local tenía fuentes instaladas, mientras el servidor publicado no resolvía esos glifos. La revisión local del PDF no detectaba esa diferencia; un build correcto tampoco la comprueba.

## Corrección

- `assets/fonts/`: Noto Sans Regular/Bold TTF estáticas y licencia SIL OFL 1.1 del repositorio oficial Noto, con procedencia en README.md.
- `src/lib/ticket-font.ts`: opentype.js 1.3.4 fijado en lockfile lee esas fuentes y convierte cada texto a contornos `<path>`; caché por peso dentro del proceso. Sharp recibe geometría, sin resolución de fuentes del sistema ni descargas externas.
- `src/lib/ticket-layout.ts`: usa los contornos para todos los textos, incluidos estados/consecutivo/serial, conserva escape seguro al no insertar texto crudo en XML y mantiene dimensiones, QR y arte.
- `next.config.ts`: `outputFileTracingIncludes` incorpora explícitamente TTF/licencia en los artefactos de servidor.

El cambio aplica al render común de pantalla, PDF descargado/adjunto y ZPL. No reemite entradas ni cambia QR, precio, serial o consecutivo. Un PDF ya descargado/enviado no cambia automáticamente; debe descargarse de nuevo. Los snapshots cifrados de trabajos de email iniciados no se reescriben para preservar idempotencia.

## Verificación

`tests/ticket-font.test.ts` comprueba contornos distintos para A/B y pesos, caracteres españoles, números, dibujo con Sharp y ausencia de texto/XML inyectado. `npx vitest run tests/ticket-font.test.ts tests/ticket-art.test.ts tests/email-flows.test.ts`: 8 pruebas aprobadas. `npx playwright test tests/e2e/ticket-art.spec.ts`: 1 prueba aprobada. Lint, tipos y build aprobados. PDF ficticio de 70×80 renderizado con Poppler y revisado visualmente. Verificados archivos de fuentes en el trace de `/api/tickets`.

Comprobación remota prevista tras despliegue: leer un documento existente mediante enlace privado, comparar píxeles del encabezado publicado contra el mismo render local con contornos y guardar únicamente el encabezado sin QR en `.local/verification/ticket-font/`. No crear ventas, escanear ni enviar correos reales. Resultado y commit se registran después de observar publicación.

Resultado remoto: implementación fb86c4dba89502b64d940654196d297283efd17d enviada a origin/main; Vercel success observado. Documento existente de cinco entradas respondió HTTP200; encabezado publicado antes con cuadrados y después con texto correcto. Diferencia media de píxeles respecto al render local con contornos:0 (coincidencia exacta). Inspección visual del encabezado remoto aprobada. Evidencia privada before-header.png/published-header.png/result.json en .local/verification/ticket-font/, sin QR ni enlace de entrega. No se crearon entradas, ventas, impresiones o correos para verificarlo.
