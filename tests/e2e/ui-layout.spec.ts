import { test, expect } from "@playwright/test";
test("registro de comprador mantiene etiquetas y condiciones legibles", async ({
  page,
}) => {
  // Render the connected registration UI without contacting Auth or creating accounts.
  await page.route("**/api/state", async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    await route.fulfill({ response, json: { ...state, demo: false } });
  });
  await page.goto("/login?register=1");
  await expect(
    page.getByRole("button", { name: "Crear cuenta", exact: true }),
  ).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ["Género", "Rango de edad (opcional)"]) {
      const select = page.getByLabel(name, { exact: true });
      const geometry = await select.evaluate((control) => {
        const label = control
          .parentElement!.querySelector("span")!
          .getBoundingClientRect();
        const bounds = control.getBoundingClientRect();
        return { above: label.bottom <= bounds.top + 1, right: bounds.right };
      });
      expect(geometry.above).toBeTruthy();
      expect(geometry.right).toBeLessThanOrEqual(width);
    }
    const terms = page
      .locator(".inline-check")
      .filter({ hasText: "condiciones de creación" });
    await expect(terms.locator(":scope > span")).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    await page.screenshot({
      path: `test-results/buyer-register-${width}.png`,
      fullPage: true,
    });
  }
});
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
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 640 });
    const problems = await dialog.evaluate((modal) => {
      const bounds = modal.getBoundingClientRect();
      const errors: string[] = [];
      if (bounds.left < 0 || bounds.right > innerWidth)
        errors.push("modal fuera de pantalla");
      if (modal.scrollWidth > modal.clientWidth + 1)
        errors.push("modal con desbordamiento horizontal");
      for (const field of modal.querySelectorAll(".field")) {
        const label = field.querySelector(":scope > label, :scope > span");
        const control = field.querySelector(
          ":scope > input:not([type=checkbox]), :scope > select",
        );
        if (!label || !control) continue;
        const l = label.getBoundingClientRect();
        const c = control.getBoundingClientRect();
        if (l.bottom > c.top + 1)
          errors.push("etiqueta superpuesta al control");
        if (c.right > bounds.right || c.left < bounds.left)
          errors.push("control fuera del modal");
      }
      return errors;
    });
    expect(problems).toEqual([]);
    await dialog.screenshot({ path: `test-results/phase-modal-${width}.png` });
    const save = dialog.getByRole("button", {
      name: "Guardar fase",
      exact: true,
    });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
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

test("compra y regalo caben en móvil sin partir las condiciones en columnas", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Comprador demo", exact: true })
    .click();
  await expect(page.locator(".nav-foot")).toContainText("Comprador demo");
  const state = await (await page.request.get("/api/state")).json();
  const event = state.events.find(
    (e: { status: string }) => e.status === "published",
  );
  await page.goto(`/events/${event.slug}`);
  await expect(
    page.getByLabel("Correo para entrega", { exact: true }),
  ).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const gift of [false, true]) {
      await page.getByLabel("Es un regalo", { exact: true }).setChecked(gift);
      const terms = page
        .locator(".inline-check")
        .filter({ hasText: "condiciones de compra" });
      await expect(terms.locator(":scope > span")).toHaveCount(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width + 1);
      await page.screenshot({
        path: `test-results/buyer-purchase-${width}-${gift}.png`,
        fullPage: true,
      });
    }
  }
});
