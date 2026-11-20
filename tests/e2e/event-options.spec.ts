import { test, expect } from "@playwright/test";
test("opciones del evento ocultan campos y guardan ilimitado/fechas nulas al crear y editar", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Administración demo", exact: true })
    .click();
  await page.goto("/admin/events/new");
  await expect(page.getByLabel("Fin del evento", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel("Cierre de puertas", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Apertura de puertas", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Definir fin del evento", { exact: true }).check();
  await expect(
    page.getByLabel("Fin del evento", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Definir fin del evento", { exact: true }).uncheck();
  await page.getByLabel("Definir cierre de puertas", { exact: true }).check();
  await expect(
    page.getByLabel("Cierre de puertas", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Definir cierre de puertas", { exact: true }).uncheck();
  await page.getByLabel("Aforo ilimitado", { exact: true }).check();
  await expect(page.getByLabel("Aforo total", { exact: true })).toHaveCount(0);
  await page.getByLabel("Nombre del evento").fill("Opciones ficticias · DEMO");
  await page
    .getByLabel("Enlace del evento", { exact: true })
    .fill(`opciones-${Date.now()}`);
  await page.getByLabel("Nombre del recinto").fill("Recinto ficticio");
  await page
    .getByLabel("Dirección", { exact: true })
    .fill("Dirección ficticia");
  const start = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 16);
  await page.getByLabel("Inicio del evento", { exact: true }).fill(start);
  await page
    .getByRole("button", { name: "Crear borrador", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Editar evento", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Aforo ilimitado", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Definir fin del evento", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("Definir cierre de puertas", { exact: true }),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    page.getByLabel("Aforo ilimitado", { exact: true }),
  ).toBeChecked();
  await page.getByLabel("Aforo ilimitado", { exact: true }).uncheck();
  await page.getByLabel("Aforo total", { exact: true }).fill("75");
  await page
    .getByRole("button", { name: "Guardar cambios del evento", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Evento actualizado");
  await page.reload();
  await expect(page.getByLabel("Aforo total", { exact: true })).toHaveValue(
    "75",
  );
  await expect(page.getByLabel("Fin del evento", { exact: true })).toHaveCount(
    0,
  );
});
test("enlace claro y cupo ilimitado por localidad, editable y con ruta pública en español", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Administración demo", exact: true })
    .click();
  await page.goto("/admin/events/new");
  const slug = `localidades-${Date.now()}`;
  await expect(
    page.getByText("Ejemplo: pasecentral.com/eventos/tuevento.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Nombre del evento")
    .fill("Localidades ficticias · DEMO");
  await page.getByLabel("Enlace del evento", { exact: true }).fill(slug);
  await page.getByLabel("Nombre del recinto").fill("Recinto ficticio");
  await page
    .getByLabel("Dirección", { exact: true })
    .fill("Dirección ficticia");
  await page.getByLabel("Aforo ilimitado", { exact: true }).check();
  const local = (ms: number) =>
    new Date(ms - 5 * 3600000).toISOString().slice(0, 16);
  await page
    .getByLabel("Inicio del evento", { exact: true })
    .fill(local(Date.now()));
  await page
    .getByRole("button", { name: "Crear borrador", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Editar evento", exact: true }),
  ).toBeVisible();
  const eventPath = new URL(page.url()).pathname;
  await page
    .getByRole("link", { name: "Localidades y precios", exact: true })
    .click();
  await page.getByLabel("Nueva localidad").fill("General");
  await page
    .getByLabel("Cupo ilimitado de la localidad", { exact: true })
    .check();
  await expect(
    page.getByLabel("Cupo de la localidad", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Agregar localidad", exact: true })
    .click();
  await expect(page.locator("table").first()).toContainText("Ilimitadas");
  await page
    .getByRole("button", { name: "Editar General", exact: true })
    .click();
  await page.getByLabel("Cupo ilimitado de General", { exact: true }).uncheck();
  await page.getByLabel("Cupo total de General", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Guardar localidad", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Localidad actualizada");
  await page.getByLabel("Nombre de la fase").fill("Fase ficticia");
  await page.getByLabel("Canal", { exact: true }).selectOption("both");
  await page.getByLabel("Precio en COP").fill("10000");
  await page
    .getByLabel("Fin · Colombia", { exact: true })
    .fill(local(Date.now() + 86400000));
  await page.getByRole("button", { name: "Agregar fase", exact: true }).click();
  await expect(page.locator("table").nth(1)).toContainText("Fase ficticia");
  await page.goto(eventPath);
  await page.getByLabel("Aforo ilimitado", { exact: true }).uncheck();
  await page.getByLabel("Aforo total", { exact: true }).fill("75");
  await page
    .getByRole("button", { name: "Guardar cambios del evento", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Evento actualizado");
  await page
    .getByRole("button", { name: "Publicar evento", exact: true })
    .click();
  await expect(page.locator(".heading .badge")).toHaveText("En venta");
  await page.goto(`/eventos/${slug}`);
  await expect(
    page.getByLabel("Cantidad General", { exact: true }),
  ).toBeVisible();
  await page.goto(`/events/${slug}`);
  await expect(
    page.getByLabel("Cantidad General", { exact: true }),
  ).toBeVisible();
});
