import sharp from "sharp";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { supabase } from "./auth";
import { demoMode } from "./config";
import { fail } from "./service";
export async function normalizeEventImage(bytes: Buffer) {
  if (bytes.length > 4 * 1024 * 1024)
    fail("Cada imagen debe pesar como máximo 4 MB", 413);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP";
  if (!jpeg && !png && !webp)
    fail("Usa JPG, PNG o WebP; no se permiten SVG ni otros archivos");
  try {
    return await sharp(bytes, { limitInputPixels: 36_000_000 })
      .rotate()
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    fail("Imagen dañada o mayor de 36 megapíxeles");
  }
}
function localPath(path: string) {
  return join(process.cwd(), ".local", "event-images", path.replace("/", "-"));
}
export async function saveEventImage(path: string, bytes: Buffer) {
  if (demoMode()) {
    await mkdir(join(process.cwd(), ".local", "event-images"), {
      recursive: true,
    });
    await writeFile(localPath(path), bytes, { mode: 0o600 });
  } else {
    const { error } = await (
      await supabase()
    ).storage
      .from("event-images")
      .upload(path, bytes, { contentType: "image/webp", upsert: false });
    if (error) fail("No se pudo guardar la imagen", 503);
  }
}
export async function readEventImage(path: string) {
  if (demoMode()) return readFile(localPath(path));
  const { data, error } = await (
    await supabase()
  ).storage
    .from("event-images")
    .download(path);
  if (error || !data) fail("No se pudo cargar la imagen", 503);
  return Buffer.from(await data.arrayBuffer());
}
export async function removeEventImage(path: string) {
  if (demoMode()) await unlink(localPath(path)).catch(() => {});
  else await (await supabase()).storage.from("event-images").remove([path]);
}
