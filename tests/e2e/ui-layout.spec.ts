import { test, expect } from "@playwright/test";
test("formularios y tablas mantienen alineación y ancho en escritorio y móvil", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Administración demo", exact: true })
    .click();
  async function capture(name: string) {
    await expect(page.locator(".content")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
    await page.screenshot({
      path: `test-results/ui-${name}.png`,
      fullPage: true,
    });
  }
  for (const [width, mode] of [
    [1440, "desktop"],
    [390, "mobile"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [path, name] of [
      ["/admin/organizations", "organizations"],
      ["/events", "catalog"],
      ["/admin/events", "my-events"],
      ["/admin", "dashboard"],
      ["/account/tickets", "wallet"],
      ["/box-office/cash-session", "cash"],
      ["/access", "access"],
      ["/admin/events/new", "event"],
      ["/admin/users", "team"],
      ["/account/profile", "profile"],
      ["/box-office", "box"],
      ["/admin/reports", "reports"],
    ]) {
      await page.goto(path);
      await capture(`${name}-${mode}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/events/new");
  await page.getByLabel("Nombre del evento").fill("Revisión visual · DEMO");
  await page
    .getByLabel("Enlace del evento", { exact: true })
    .fill(`revision-visual-${Date.now()}`);
  await page.getByLabel("Nombre del recinto").fill("Recinto de prueba");
  await page
    .getByLabel("Dirección", { exact: true })
    .fill("Dirección ficticia");
  await page.getByLabel("Aforo ilimitado", { exact: true }).check();
  await page
    .getByLabel("Inicio del evento", { exact: true })
    .fill(new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 16));
  await page
    .getByRole("button", { name: "Crear borrador", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Editar evento", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Localidades y precios", exact: true })
    .click();
  await expect(
    page.getByText("Aún no hay localidades", { exact: true }),
  ).toBeVisible();
  const name = await page
    .getByLabel("Nueva localidad", { exact: true })
    .boundingBox();
  const capacity = await page
    .getByLabel("Cupo de la localidad", { exact: true })
    .boundingBox();
  expect(Math.abs(name!.y - capacity!.y)).toBeLessThanOrEqual(2);
  await capture("pricing-desktop");
  await page.setViewportSize({ width: 390, height: 1000 });
  await capture("pricing-mobile");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Nueva localidad", { exact: true }).fill("General");
  await page.getByLabel("Cupo de la localidad", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Agregar localidad", exact: true })
    .click();
  await page
    .getByLabel("Nombre de la fase", { exact: true })
    .fill("Hasta el final");
  await page.getByLabel("Precio en COP", { exact: true }).fill("30000");
  await page.getByLabel("Canal", { exact: true }).selectOption("both");
  await page
    .getByLabel("Vender hasta el final del evento", { exact: true })
    .check();
  await expect(page.getByLabel("Fin · Colombia", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Sin fin del evento definido:", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Agregar fase", exact: true }).click();
  await expect(page.locator("table").nth(1)).toContainText(
    "Hasta el final del evento",
  );
  await page
    .getByRole("button", { name: "Editar fase Hasta el final", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Editar fase Hasta el final",
    exact: true,
  });
  await expect(
    dialog.getByLabel("Vender hasta el final del evento"),
  ).toBeChecked();
  await dialog.getByLabel("Vender hasta el final del evento").uncheck();
  await dialog
    .getByLabel("Fin de la fase", { exact: true })
    .fill(
      new Date(Date.now() + 86400000 - 5 * 3600000).toISOString().slice(0, 16),
    );
  await dialog
    .getByRole("button", { name: "Guardar fase", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("table").nth(1)).not.toContainText(
    "Hasta el final del evento",
  );
});
