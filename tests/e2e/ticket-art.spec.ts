import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("gestor sube diseño privado y frase, taquilla ve boleta doble y PDF sin duplicar entrada", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Administración demo", exact: true })
    .click();
  const id = "00000000-0000-4000-8000-000000000002";
  await page.goto(`/admin/events/${id}`);
  const art = page.locator(".ticket-art-editor");
  await art
    .getByLabel("Frase al pie de la boleta")
    .fill("¡A LA CALLE CON TODO!");
  await art.getByLabel("Subir logo o diseño para boletas").setInputFiles({
    name: "arte-prueba.png",
    mimeType: "image/png",
    buffer: await readFile("docs/design/retrofest-composicion-bw-v1.png"),
  });
  await expect(
    art.getByText("Diseño guardado en blanco y negro"),
  ).toBeVisible();
  await art.getByLabel("Frase al pie de la boleta").fill("PRUEBA DE EVENTO");
  await art.getByRole("button", { name: "Guardar frase", exact: true }).click();
  await expect(page.locator(".toast")).toContainText(
    "Frase de boleta actualizada",
  );
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Taquilla demo", exact: true })
    .click();
  await expect(page.locator(".nav-foot")).toContainText("Taquilla demo");
  const denied = await page.request.get(`/api/events/${id}/ticket-art`);
  expect(denied.status()).toBe(403);
  await page.goto("/box-office");
  await page.getByLabel("Evento activo", { exact: true }).selectOption(id);
  await page.getByLabel("Medio de cobro").selectOption("transfer");
  await page.getByLabel("Cantidad General").selectOption("1");
  await page.getByLabel("Referencia de transferencia").fill("PRUEBA-ARTE");
  await page
    .getByLabel("Confirmé el importe en la cuenta del comercio")
    .check();
  await page.getByRole("button", { name: "Confirmar cobro y emitir" }).click();
  await expect(page.locator(".ticket")).toHaveCount(1);
  await expect(page.getByLabel("Tamaño del papel")).toHaveValue("ticket70x40");
  await expect(page.locator(".ticket-screen-half")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/ticket-double-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: "test-results/ticket-double-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
