import { test, expect, type Page } from "@playwright/test";
import { USERS } from "../../src/lib/seed";
test("enlace de recuperación inválido borra credenciales de URL y no concede sesión", async ({
  page,
}) => {
  await page.goto(
    "/#type=recovery&access_token=invalid-access-token-example&refresh_token=invalid-refresh-token",
  );
  await expect(page).toHaveURL(/\/forgot-password\?invalid=1$/);
  await expect(
    page.getByRole("link", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
});
async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".nav-foot")).toContainText(name);
}
test("organizador crea dos fiestas y configura localidad, fases y personal", async ({
  page,
}) => {
  await login(page, "Administración demo");
  for (const title of ["Fiesta uno", "Fiesta dos"]) {
    await page.goto("/admin/events/new");
    await page.getByLabel("Nombre del evento").fill(title);
    await page
      .getByLabel("Dirección corta")
      .fill(`${title.toLowerCase().replace(" ", "-")}-${Date.now()}`);
    await page.getByLabel("Aforo total").fill("25");
    await page.getByLabel("Nombre del recinto").fill("Recinto ficticio");
    await page
      .getByLabel("Dirección", { exact: true })
      .fill("Dirección de prueba");
    const now = new Date(),
      end = new Date(Date.now() + 86400000);
    const local = (d: Date) =>
      new Date(d.getTime() - 5 * 3600000).toISOString().slice(0, 16);
    await page.getByLabel("Inicio del evento").fill(local(now));
    await page.getByLabel("Fin del evento").fill(local(end));
    await page
      .getByLabel("Apertura de puertas")
      .fill(local(new Date(Date.now() - 60000)));
    await page.getByLabel("Cierre de puertas").fill(local(end));
    await page.getByRole("button", { name: "Crear borrador" }).click();
    await expect(page.locator("h1")).toHaveText(title);
    await page.getByRole("link", { name: "Localidades y precios" }).click();
    await page.getByLabel("Nueva localidad").fill("General");
    await page.getByLabel("Cupo de la localidad").fill("25");
    await page.getByRole("button", { name: "Agregar localidad" }).click();
    await expect(page.locator("table").first()).toContainText("General");
    for (const channel of ["web", "box_office"]) {
      await page.getByLabel("Canal", { exact: true }).selectOption(channel);
      await page
        .getByLabel("Nombre de la fase")
        .fill(channel === "web" ? "Preventa" : "Taquilla");
      await page.getByLabel("Precio en COP").fill("20000");
      await page
        .getByLabel("Inicio · Bogotá", { exact: true })
        .fill(local(new Date(Date.now() - 60000)));
      await page.getByLabel("Fin · Bogotá", { exact: true }).fill(local(end));
      await page.getByRole("button", { name: "Agregar fase" }).click();
      await expect(page.locator("table").nth(1)).toContainText(
        channel === "web" ? "Preventa" : "Taquilla",
      );
    }
    await page.getByRole("link", { name: "Equipo", exact: true }).click();
    await page.getByLabel("Usuario registrado").selectOption(USERS[2].id);
    await page.getByLabel("Rol operativo").selectOption("box_office");
    await page.getByRole("button", { name: "Asignar permiso" }).click();
    await expect(page.locator("table")).toContainText("Taquilla demo");
    await page.getByRole("link", { name: "Evento", exact: true }).click();
    await page.getByRole("button", { name: "Publicar evento" }).click();
    await expect(page.locator(".heading .badge")).toHaveText("En venta");
  }
});
test("taquilla vende, descarga PDF, acceso admite una sola vez y caja cierra", async ({
  page,
}) => {
  await login(page, "Taquilla demo");
  await page.goto("/box-office/cash-session");
  await page
    .getByLabel("Evento de la caja")
    .selectOption("00000000-0000-4000-8000-000000000002");
  const open = page.getByRole("button", { name: "Abrir caja" });
  if (await open.isVisible()) {
    await page.getByLabel("Fondo inicial").fill("10000");
    await open.click();
    await expect(
      page.getByRole("heading", { name: "Caja abierta", exact: true }),
    ).toBeVisible();
  }
  await page.goto("/box-office");
  await page
    .getByLabel("Evento activo", { exact: true })
    .selectOption("00000000-0000-4000-8000-000000000002");
  await page.getByLabel("Cantidad General").selectOption("1");
  await page.getByRole("button", { name: "Confirmar cobro y emitir" }).click();
  await expect(page.locator(".ticket")).toHaveCount(1);
  await expect(page.locator(".ticket img")).toBeVisible();
  const orderId = new URL(page.url()).pathname.split("/")[2];
  const doc = await page.request.post("/api/tickets", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: { order_id: orderId },
  });
  expect(doc.ok()).toBeTruthy();
  const credential = (await doc.json()).tickets[0].credential;
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF" }).click();
  expect((await download).suggestedFilename()).toContain(".pdf");
  await login(page, "Acceso demo");
  await expect(page.getByLabel("Evento activo", { exact: true })).toHaveCount(
    0,
  );
  const attempts: string[] = [];
  let loseResponse = true;
  await page.route("**/api/commands", async (route) => {
    const command = route.request().postDataJSON();
    if (command.action !== "scan_auto") return route.continue();
    attempts.push(command.request_id);
    if (loseResponse) {
      loseResponse = false;
      await route.fetch();
      return route.abort();
    }
    return route.continue();
  });
  await page.getByLabel("Escanea el QR").fill(credential);
  await expect(page.locator(".scan-result")).toContainText("Error de conexión");
  await expect(page.locator(".scan-popup")).toContainText(
    "No autorices el ingreso",
  );
  await expect(page.getByLabel("Escanea el QR")).toHaveValue(credential);
  await page.getByRole("button", { name: "Validar entrada" }).click();
  await expect(page.locator(".scan-popup")).toContainText("Ingreso autorizado");
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toBe(attempts[1]);
  await expect(page.locator(".scan-result")).toContainText(
    "Ingreso autorizado",
  );
  await page.getByLabel("Escanea el QR").fill(credential);
  await expect(page.locator(".scan-popup")).toContainText(
    "Entrada ya utilizada",
  );
  await expect(page.locator(".scan-result")).toContainText(
    "Entrada ya utilizada",
  );
  await login(page, "Taquilla demo");
  await page.goto("/box-office/cash-session");
  await page
    .getByLabel("Evento de la caja")
    .selectOption("00000000-0000-4000-8000-000000000002");
  await page.getByLabel("Efectivo declarado").fill("65000");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar caja" }).click();
  await expect(page.locator("table").last()).toContainText(/\$\s*65\.000/);
});
test("comprador reserva varias entradas y pago demo emite QR distintos", async ({
  page,
}) => {
  await login(page, "Comprador demo");
  await page.goto("/events/noche-tropical-demo");
  await page.getByLabel("Cantidad General").selectOption("2");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Reservar y continuar" }).click();
  await expect(page.locator(".status-banner")).toContainText(
    "Esperando confirmación",
  );
  await page.getByRole("button", { name: "Simular aprobación" }).click();
  await expect(page.locator(".ticket")).toHaveCount(2);
  const sources = await page
    .locator(".ticket img")
    .evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src));
  expect(sources[0]).not.toBe(sources[1]);
  await page.goto("/account/tickets");
  await expect(page.locator("table")).toContainText("Confirmada");
});
test("protege API, exportación y CSRF", async ({ page }) => {
  const unauth = await page.request.post("/api/commands", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: { action: "cash_open" },
  });
  expect(unauth.status()).toBe(401);
  await login(page, "Comprador demo");
  const csrf = await page.request.post("/api/commands", {
    headers: { origin: "https://otro-sitio.invalid" },
    data: { action: "cash_open" },
  });
  expect(csrf.status()).toBe(403);
  expect((await page.request.get("/api/reports?kind=sales")).status()).toBe(
    403,
  );
  await login(page, "Administración demo");
  const exportRes = await page.request.get("/api/reports?kind=sales");
  expect(exportRes.ok()).toBeTruthy();
  expect(exportRes.headers()["content-type"]).toContain("text/csv");
});
test("dashboard y catálogo se adaptan a escritorio y móvil", async ({
  page,
}) => {
  await login(page, "Administración demo");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Todo está bajo control" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/events");
  await expect(page.locator(".event-card").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/catalog-mobile.png",
    fullPage: true,
  });
});
