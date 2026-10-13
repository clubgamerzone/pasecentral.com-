import sharp from "sharp";
import { fail } from "./service";
export async function normalizeAvatar(bytes: Buffer) {
  if (bytes.length > 2 * 1024 * 1024)
    fail("La imagen debe pesar como máximo 2 MB", 413);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP";
  if (!jpeg && !png && !webp) fail("Usa una imagen JPG, PNG o WebP válida");
  try {
    return await sharp(bytes, { limitInputPixels: 16_000_000 })
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .png()
      .toBuffer();
  } catch {
    fail(
      "No se pudo procesar la imagen. Usa JPG, PNG o WebP de hasta 16 megapíxeles.",
    );
  }
}
