import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, type Font } from "opentype.js";

const fonts = new Map<boolean, Font>();
function ticketFont(bold: boolean) {
  let font = fonts.get(bold);
  if (!font) {
    const bytes = readFileSync(
      join(
        process.cwd(),
        "assets",
        "fonts",
        bold ? "NotoSans-Bold.ttf" : "NotoSans-Regular.ttf",
      ),
    );
    font = parse(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    );
    fonts.set(bold, font);
  }
  return font;
}

// Render glyph outlines before Sharp sees the SVG. No fontconfig/system fonts,
// SVG <text>, remote fonts, or user-supplied path data are involved.
export function ticketTextPath(
  value: string,
  x: number,
  y: number,
  size: number,
  bold = false,
  anchor = "start",
) {
  const font = ticketFont(bold);
  const width = font.getAdvanceWidth(value, size);
  const left =
    anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
  return `<path d="${font.getPath(value, left, y, size).toPathData(2)}"/>`;
}
