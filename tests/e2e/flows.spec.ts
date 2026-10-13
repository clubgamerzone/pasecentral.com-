import { test, expect, type Page } from "@playwright/test";
import { USERS } from "../../src/lib/seed";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
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
test("edita evento, localidad agotada, portada y galería con imágenes privadas en borrador", async ({
  page,
  browser,
}) => {
  await login(page, "Administración demo");
  await page.goto("/admin/events/new");
  const slug = `galeria-prueba-${Date.now()}`;
  await page.getByLabel("Nombre del evento").fill("Galería ficticia · DEMO");
  await page.getByLabel("Dirección corta").fill(slug);
  await page.getByLabel("Aforo total").fill("20");
  await page.getByLabel("Nombre del recinto").fill("Recinto de prueba");
  await page
    .getByLabel("Dirección", { exact: true })
    .fill("Dirección ficticia");
  const local = (ms: number) =>
    new Date(ms - 5 * 3600000).toISOString().slice(0, 16);
  for (const label of ["Inicio del evento", "Apertura de puertas"])
    await page.getByLabel(label).fill(local(Date.now()));
  for (const label of ["Fin del evento", "Cierre de puertas"])
    await page.getByLabel(label).fill(local(Date.now() + 86400000));
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await expect(
    page.getByRole("heading", { name: "Editar evento" }),
  ).toBeVisible();
  const url = page.url(),
    id = url.split("/").pop()!;
  await page.getByLabel("Nombre del evento").fill("Evento editado · DEMO");
  await page
    .getByLabel("Descripción del evento")
    .fill("Conoce el lugar.\nInformación adicional para compradores.");
  await page
    .getByRole("button", { name: "Guardar cambios del evento" })
    .click();
  await expect(page.locator("h1")).toHaveText("Evento editado · DEMO");
  const make = async (background: string) =>
    sharp({ create: { width: 640, height: 360, channels: 3, background } })
      .png()
      .toBuffer();
  await page.getByLabel("Agregar imágenes del evento").setInputFiles([
    { name: "uno.png", mimeType: "image/png", buffer: await make("#149ea0") },
    { name: "dos.png", mimeType: "image/png", buffer: await make("#da7635") },
  ]);
  await expect(
    page.getByRole("button", { name: "Usar de portada" }),
  ).toHaveCount(1);
  const imageUrl = await page
    .locator(".event-image-grid img")
    .first()
    .getAttribute("src");
  const anonymous = await browser.newContext();
  expect(
    (await anonymous.request.get(`http://127.0.0.1:3100${imageUrl}`)).status(),
  ).toBe(404);
  await page.getByRole("button", { name: "Usar de portada" }).click();
  await expect(page.locator(".toast")).toContainText("Portada actualizada");
  await page.getByRole("link", { name: "Localidades y precios" }).click();
  await page.getByLabel("Nueva localidad").fill("General");
  await page.getByLabel("Cupo de la localidad").fill("3");
  await page.getByRole("button", { name: "Agregar localidad" }).click();
  await page
    .getByRole("button", { name: "Editar General", exact: true })
    .click();
  await page.getByLabel("Cupo total de General").fill("0");
  await page.getByRole("button", { name: "Guardar localidad" }).click();
  await expect(page.locator("table").first()).toContainText("General");
  await page
    .getByRole("button", { name: "Editar General", exact: true })
    .click();
  await expect(page.getByLabel("Cupo total de General")).toHaveValue("0");
  await page.getByLabel("Cupo total de General").fill("5");
  await page.getByRole("button", { name: "Guardar localidad" }).click();
  for (const channel of ["web", "box_office"]) {
    await page.getByLabel("Canal", { exact: true }).selectOption(channel);
    await page.getByLabel("Nombre de la fase").fill(`Precio ${channel}`);
    await page.getByLabel("Precio en COP").fill("10000");
    await page
      .getByLabel("Inicio · Bogotá", { exact: true })
      .fill(local(Date.now() - 3600000));
    await page
      .getByLabel("Fin · Bogotá", { exact: true })
      .fill(local(Date.now() + 86400000));
    await page.getByRole("button", { name: "Agregar fase" }).click();
    await expect(page.locator("table").nth(1)).toContainText(`Precio ${channel}`);
  }
  await page.goto(url);
  await page.getByRole("button", { name: "Publicar evento" }).click();
  await expect(page.locator(".toast")).toContainText("publicado");
  const publicPage = await anonymous.newPage();
  await publicPage.goto(`http://127.0.0.1:3100/events/${slug}`);
  await expect(
    publicPage.getByText("Información adicional para compradores.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(publicPage.locator(".event-main-image")).toBeVisible();
  expect(
    (await anonymous.request.get(`http://127.0.0.1:3100${imageUrl}`)).status(),
  ).toBe(200);
  const initial = await publicPage
    .locator(".event-main-image")
    .getAttribute("src");
  await publicPage
    .getByRole("button", { name: "Ver imagen 1 del evento" })
    .click();
  await expect(publicPage.locator(".event-main-image")).not.toHaveAttribute(
    "src",
    initial!,
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Eliminar imagen 2" }).click();
  await expect(page.locator(".event-image-grid img")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Portada actual" }),
  ).toBeVisible();
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  await anonymous.close();
});
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
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        document.documentElement.dataset.sharedFile = file?.name;
        document.documentElement.dataset.sharedType = file?.type;
        document.documentElement.dataset.sharedPdf = file
          ? (await file.text()).slice(0, 4)
          : "";
      },
      configurable: true,
    });
  });
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
  const shareButton = page.getByRole("button", {
    name: "Compartir PDF por WhatsApp",
    exact: true,
  });
  await expect(shareButton).toBeEnabled();
  await shareButton.click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-shared-file",
    /^entradas-.*\.pdf$/,
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-shared-type",
    "application/pdf",
  );
  await expect(page.locator("html")).toHaveAttribute("data-shared-pdf", "%PDF");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    }),
  );
  const fallbackDownload = page.waitForEvent("download");
  await shareButton.click();
  expect((await fallbackDownload).suggestedFilename()).toMatch(
    /^entradas-.*\.pdf$/,
  );
  await expect(
    page.getByText("El PDF contiene todas tus entradas", { exact: false }),
  ).toBeVisible();
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

test("perfil con foto privada e invitación a varios eventos", async ({
  page,
}) => {
  await login(page, "Administración demo");
  await page.goto("/account/profile");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Mi perfil", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByLabel("Nombre completo", { exact: true })
    .fill("Administrador del ensayo");
  await page.getByLabel("Teléfono", { exact: true }).fill("3000000000");
  await page
    .getByLabel("Acerca de mí", { exact: true })
    .fill("Perfil ficticio de prueba");
  await page
    .getByRole("button", { name: "Guardar perfil", exact: true })
    .click();
  await expect(page.locator(".nav-foot")).toContainText(
    "Administrador del ensayo",
  );
  const image = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#1f7664" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Nombre completo", { exact: true })
    .fill("Nombre pendiente de guardar");
  await page.getByLabel("Cambiar foto", { exact: true }).setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(
    page.getByRole("button", { name: "Eliminar foto", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre completo", { exact: true })).toHaveValue(
    "Nombre pendiente de guardar",
  );
  const avatar = await page.request.get("/api/profile/avatar");
  expect(avatar.status()).toBe(200);
  expect(avatar.headers()["content-type"]).toBe("image/png");
  await page
    .getByRole("button", { name: "Eliminar foto", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Eliminar foto", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Nombre completo", { exact: true })
    .fill("Administración demo");
  await page
    .getByRole("button", { name: "Guardar perfil", exact: true })
    .click();
  await expect(page.locator(".nav-foot")).toContainText("Administración demo");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/users");
  await page
    .getByLabel("Nombre de la persona", { exact: true })
    .fill("Comprador invitado");
  await page
    .getByLabel("Correo de la invitación", { exact: true })
    .fill("customer@example.test");
  await page
    .getByLabel("Rol de la invitación", { exact: true })
    .selectOption("access_staff");
  const assignments = page
    .getByRole("group", { name: "Eventos asignados (puedes elegir varios)" })
    .getByRole("checkbox");
  await assignments.nth(0).check();
  await assignments.nth(1).check();
  await page
    .getByRole("button", { name: "Enviar invitación", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reenviar invitación", exact: true }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  const invite = state.invitations.find(
    (i: { email: string }) => i.email === "customer@example.test",
  );
  expect(invite.event_ids).toHaveLength(2);
  const outbox = JSON.parse(
    await readFile(`.local/outbox/invite-${invite.id}-1.json`, "utf8"),
  );
  const credential = outbox.text.match(/\/invite#([A-Za-z0-9_-]{43})/)[1];
  await login(page, "Comprador demo");
  await page.goto(`/invite#${credential}`);
  await expect(
    page.getByRole("button", { name: "Aceptar invitación", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/invite$/);
  await page
    .getByRole("button", { name: "Usar otra cuenta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "Comprador demo");
  await expect(page).toHaveURL(/\/invite$/);
  await page.getByRole("button", { name: "Ahora no", exact: true }).click();
  await expect(page).toHaveURL(/\/events$/);
  expect(
    await page.evaluate(() => sessionStorage.getItem("pc-invitation")),
  ).toBeNull();
  await page.goto(`/invite#${credential}`);
  await expect(
    page.getByRole("button", { name: "Aceptar invitación", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Aceptar invitación", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/profile$/);
  await expect(
    page.getByRole("link", { name: "Control de acceso", exact: true }),
  ).toBeVisible();
  const denied = await page.request.post("/api/commands", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      action: "invite_create",
      name: "Persona",
      email: "other@example.test",
      role: "platform_admin",
      event_ids: [],
    },
  });
  expect(denied.status()).toBe(403);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/profile/avatar")).status()).toBe(401);
});
