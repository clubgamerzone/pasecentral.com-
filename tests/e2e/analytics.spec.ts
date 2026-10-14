import { test, expect, type Page } from "@playwright/test";
const e1 = "00000000-0000-4000-8000-000000000002",
  e2 = "00000000-0000-4000-8000-000000000003";
async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".nav-foot")).toContainText(name);
}
test("taquilla captura audiencia por entrada y análisis compara eventos con CSV privado y diseño móvil", async ({
  page,
}) => {
  await login(page, "Administración demo");
  const before = await (await page.request.get("/api/analytics")).json();
  await page.goto("/box-office");
  await page.getByLabel("Evento activo", { exact: true }).selectOption(e1);
  await page.getByLabel("Cantidad General").selectOption("2");
  await page.getByLabel("Medio de cobro").selectOption("transfer");
  await page.getByLabel("Referencia de transferencia").fill("ENSAYO-ANALITICA");
  await page.getByRole("checkbox", { name: /Confirmé el importe/ }).check();
  await page
    .getByText("Datos opcionales de cada asistente", { exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Autorizo el uso/ }).check();
  await page
    .getByLabel("Género — General 1", { exact: true })
    .selectOption("female");
  await page
    .getByLabel("Rango de edad — General 1", { exact: true })
    .selectOption("25_34");
  await page
    .getByLabel("Género — General 2", { exact: true })
    .selectOption("male");
  await page
    .getByLabel("Rango de edad — General 2", { exact: true })
    .selectOption("13_17");
  await page.getByRole("button", { name: "Confirmar cobro y emitir" }).click();
  await expect(page.locator(".ticket")).toHaveCount(2);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Análisis de ventas y audiencia" }),
  ).toBeVisible();
  await expect(page.locator(".analytics-metrics")).toContainText(
    "Entradas vendidas",
  );
  const after = await (await page.request.get("/api/analytics")).json();
  expect(after.summary.sold_tickets - before.summary.sold_tickets).toBe(2);
  expect(after.summary.gender_provided - before.summary.gender_provided).toBe(
    2,
  );
  await page
    .getByLabel("Evento para análisis", { exact: true })
    .selectOption(e1);
  await page
    .getByLabel("Comparar con otro evento", { exact: true })
    .selectOption(e2);
  await expect(
    page.getByRole("heading", { name: "Resultados por evento" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Composición del público" }),
  ).toBeVisible();
  const rank = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Resultados por evento",
        exact: true,
      }),
    })
    .last();
  await expect(rank.locator("tbody tr")).toHaveCount(2);
  await page
    .getByLabel("Ordenar eventos por", { exact: true })
    .selectOption("net_cop");
  await page.getByLabel("Consolidar nombres iguales entre eventos").check();
  const table = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Ventas por localidad",
        exact: true,
      }),
    })
    .last();
  const url = await table
    .getByRole("link", { name: "Descargar CSV" })
    .getAttribute("href");
  expect(url).toContain("global_types");
  const csv = await page.request.get(url!);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('"Nombre","Evento"');
  expect(csv.headers()["cache-control"]).toContain("no-store");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Análisis de ventas y audiencia" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/analytics-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/reports");
  await expect(
    page.getByRole("heading", { name: "Auditoría de operaciones" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/analytics-desktop.png",
    fullPage: true,
  });
});
test("análisis deniega público, comprador y operadores sin gestión; rechaza filtros inválidos", async ({
  page,
}) => {
  expect((await page.request.get("/api/analytics")).status()).toBe(401);
  for (const name of ["Comprador demo", "Taquilla demo", "Acceso demo"]) {
    await login(page, name);
    expect((await page.request.get("/api/analytics")).status()).toBe(403);
  }
  await login(page, "Administración demo");
  expect(
    (
      await page.request.get("/api/analytics?from=2026-02-02&to=2026-01-01")
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.get("/api/analytics?format=csv&report=invalid")
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.get(
        "/api/analytics?events=00000000-0000-4000-8000-000000000999",
      )
    ).status(),
  ).toBe(403);
});
