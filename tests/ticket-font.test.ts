import { expect, it } from "vitest";
import sharp from "sharp";
import { ticketTextPath } from "../src/lib/ticket-font";

it("dibuja letras españolas y números como contornos sin fuentes del sistema", async () => {
  const text = "José · N.º 42 · $ 45.000 · Bogotá · Ñ";
  const regular = ticketTextPath(text, 10, 32, 22);
  const bold = ticketTextPath(text, 10, 32, 22, true);
  expect(regular).toMatch(/^<path d="M/);
  expect(regular).not.toMatch(/<text|font-family|José/);
  expect(bold).not.toBe(regular);
  expect(ticketTextPath("A", 10, 32, 22)).not.toBe(
    ticketTextPath("B", 10, 32, 22),
  );
  const pixels = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="550" height="50"><rect width="550" height="50" fill="white"/>${bold}</svg>`,
    ),
  )
    .grayscale()
    .raw()
    .toBuffer();
  expect(pixels.filter((value) => value < 128).length).toBeGreaterThan(500);
  expect(ticketTextPath('<script>&"', 10, 32, 22)).not.toContain("script");
});
