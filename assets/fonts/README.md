# Fuentes de boletas

Noto Sans Regular y Bold (TTF estáticas), distribuidas sin modificaciones bajo SIL Open Font License 1.1. Licencia y copyright completos en OFL.txt y metadatos de los archivos.

Origen: https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans

Descargadas el 2026-11-20. Se conservan en Git y se incluyen explícitamente en el trazado de Next.js. `src/lib/ticket-font.ts` lee las fuentes y convierte los textos a trazos SVG mediante opentype.js antes de rasterizar con Sharp; no depende de fuentes del servidor ni solicita fuentes por internet al imprimir/generar PDF.
