import { test, expect, type Page } from "@playwright/test";
test("fecha/hora de puertas, precio COP formateado y fase editable para ambos canales", async ({
  page,
}) => {
  await login(page, "Administración demo");
  await page.goto("/admin/events/new");
  const id = `fase-prueba-${Date.now()}`,
    local = (ms: number) =>
      new Date(ms - 5 * 3600000).toISOString().slice(0, 16);
  await page
    .getByLabel("Nombre del evento", { exact: true })
    .fill("Fases ficticias · DEMO");
  await page.getByLabel("Dirección corta").fill(id);
  await page.getByLabel("Aforo total").fill("10");
  await page.getByLabel("Nombre del recinto").fill("Recinto ficticio");
  await page
    .getByLabel("Dirección", { exact: true })
    .fill("Dirección ficticia");
  await page.getByLabel("Edad mínima").fill("0");
  await page
    .getByLabel("Inicio del evento", { exact: true })
    .fill(local(Date.now()));
  await page
    .getByLabel("Fin del evento", { exact: true })
    .fill(local(Date.now() - 86400000));
  expect(
    await page
      .getByLabel("Fin del evento", { exact: true })
      .evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(false);
  await page
    .getByLabel("Fin del evento", { exact: true })
    .fill(local(Date.now() + 86400000));
  await expect(
    page.getByLabel("Apertura de puertas", { exact: true }),
  ).toHaveAttribute("type", "time");
  await page
    .getByLabel("Apertura de puertas", { exact: true })
    .fill(local(Date.now()).slice(11));
  await page
    .getByLabel("Cierre de puertas", { exact: true })
    .fill(local(Date.now() + 86400000));
  await page
    .getByRole("button", { name: "Crear borrador", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Editar evento", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Localidades y precios", exact: true })
    .click();
  await page.getByLabel("Nueva localidad").fill("General");
  await page.getByLabel("Cupo de la localidad").fill("10");
  await page
    .getByRole("button", { name: "Agregar localidad", exact: true })
    .click();
  await page
    .getByLabel("Nombre de la fase", { exact: true })
    .fill("Preventa única");
  await page.getByLabel("Canal", { exact: true }).selectOption("both");
  await page.getByLabel("Precio en COP", { exact: true }).fill("30000");
  await expect(page.getByLabel("Precio en COP", { exact: true })).toHaveValue(
    "$ 30.000",
  );
  await page
    .getByLabel("Inicio · Colombia", { exact: true })
    .fill(local(Date.now() - 3600000));
  await page
    .getByLabel("Fin · Colombia", { exact: true })
    .fill(local(Date.now() + 86400000));
  await page.getByRole("button", { name: "Agregar fase", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar fase Preventa única", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Editar fase Preventa única",
    exact: true,
  });
  await dialog
    .getByLabel("Nombre de la fase", { exact: true })
    .fill("Preventa editada");
  await dialog.getByLabel("Precio en COP", { exact: true }).fill("1250000");
  await expect(dialog.getByLabel("Precio en COP", { exact: true })).toHaveValue(
    "$ 1.250.000",
  );
  await dialog
    .getByRole("button", { name: "Guardar fase", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Editar fase Preventa editada",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("table").nth(1)).toContainText("Ambos");
});
async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".nav-foot")).toContainText(name);
}
test("regalo con correo propio bloqueado, aceptación y transferencia selectiva renuevan titularidad y QR", async ({
  page,
  browser,
}) => {
  await login(page, "Comprador demo");
  await page.goto("/account/profile");
  await page.getByLabel("Género", { exact: true }).selectOption("female");
  await page
    .getByLabel("Rango de edad (opcional)", { exact: true })
    .selectOption("25_34");
  await page
    .getByRole("button", { name: "Guardar perfil", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Perfil actualizado");
  await page.goto("/events/noche-tropical-demo");
  await page.getByLabel("Cantidad General").selectOption("1");
  await expect(
    page.getByLabel("Correo para entrega", { exact: true }),
  ).toHaveAttribute("readonly", "");
  await expect(
    page.getByText("Datos opcionales de cada asistente", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Es un regalo", exact: true })
    .check();
  await page
    .getByLabel("Correo del destinatario del regalo")
    .fill("access_staff@example.test");
  await page.getByRole("checkbox", { name: /Acepto las/ }).check();
  await page.getByRole("button", { name: "Reservar y continuar" }).click();
  await page
    .getByRole("button", { name: "Simular aprobación · DEMO", exact: true })
    .click();
  await page.goto("/account/tickets");
  const outgoing = page
    .locator("article")
    .filter({ hasText: "access_staff@example.test" })
    .last();
  await expect(outgoing).toContainText("Pendiente");
  const ctx = await browser.newContext();
  const recipient = await ctx.newPage();
  await login(recipient, "Acceso demo");
  await recipient.goto("/account/profile");
  await recipient.getByLabel("Género", { exact: true }).selectOption("male");
  await recipient
    .getByLabel("Rango de edad (opcional)", { exact: true })
    .selectOption("35_44");
  await recipient
    .getByRole("button", { name: "Guardar perfil", exact: true })
    .click();
  await expect(recipient.locator(".toast")).toContainText("Perfil actualizado");
  await recipient.goto("/account/tickets");
  const incoming = recipient
    .locator("article")
    .filter({ hasText: "Regalo" })
    .last();
  await incoming.getByRole("checkbox").check();
  await incoming
    .getByRole("button", { name: "Aceptar entradas", exact: true })
    .click();
  await expect(incoming).toContainText("Aceptada");
  await recipient
    .getByRole("link", { name: "Ver entradas", exact: true })
    .last()
    .click();
  await expect(recipient.locator(".ticket")).toHaveCount(1);
  await page.reload();
  await expect(outgoing).toContainText("Aceptada");
  await recipient.goto("/account/tickets");
  const box = recipient.getByRole("checkbox", { name: /Seleccionar PC-/ });
  await box.last().check();
  await recipient
    .getByRole("button", { name: /Transferir entradas seleccionadas/ })
    .click();
  await recipient
    .getByLabel("Correo de una cuenta existente en Pase Central")
    .fill("customer@example.test");
  await recipient
    .getByRole("button", {
      name: "Enviar transferencia para aceptar",
      exact: true,
    })
    .click();
  await expect(recipient.locator(".toast")).toContainText(
    "Transferencia enviada",
  );
  await page.reload();
  const returned = page
    .locator("article")
    .filter({ hasText: "Transferencia" })
    .last();
  await returned.getByRole("checkbox").check();
  await returned
    .getByRole("button", { name: "Aceptar entradas", exact: true })
    .click();
  await expect(returned).toContainText("Aceptada");
  await ctx.close();
});
test("perfil explica eliminación, permite cancelarla y protege último administrador; organiza cuentas y bloquea menú contextual", async ({
  page,
}) => {
  await login(page, "Administración demo");
  await page.goto("/account/profile");
  await page
    .getByRole("button", { name: "Eliminar mi cuenta", exact: true })
    .click();
  const dialog = page.getByRole("alertdialog", {
    name: "Confirmar eliminación de cuenta",
  });
  await expect(dialog).toContainText("irreversible");
  await dialog
    .getByRole("button", { name: "Cancelar eliminación", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Eliminar mi cuenta", exact: true })
    .click();
  await dialog.getByLabel("Escribe ELIMINAR").fill("ELIMINAR");
  await dialog
    .getByRole("button", {
      name: "Eliminar cuenta y anular entradas",
      exact: true,
    })
    .click();
  await expect(page.locator(".toast")).toContainText("último administrador");
  await dialog
    .getByRole("button", { name: "Cancelar eliminación", exact: true })
    .click();
  await page.goto("/admin/organizations");
  await page
    .getByLabel("Nombre de la nueva organización")
    .fill("Organización ficticia · DEMO");
  await page
    .getByRole("button", { name: "Crear organización", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Organización creada");
  const form = page
    .locator("form")
    .filter({ hasText: "Nombre de Organización ficticia" });
  await form.getByRole("textbox").fill("Organización editada · DEMO");
  await form
    .getByRole("button", { name: "Guardar organización", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText(
    "Organización actualizada",
  );
  for (const path of ["/admin", "/terms", "/privacy"]) {
    await page.goto(path);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const event = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
          });
          return document.body.dispatchEvent(event);
        }),
      )
      .toBe(false);
  }
});
