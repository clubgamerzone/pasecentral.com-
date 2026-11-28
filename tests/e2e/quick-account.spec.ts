import { test, expect } from "@playwright/test";

test("cuenta rápida conserva selección, confirma correo y retoma compra con correo de cuenta", async ({
  page,
}) => {
  await page.route("**/api/state", async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    await route.fulfill({ response, json: { ...state, demo: false } });
  });
  await page.goto("/events/noche-tropical-demo");
  await page.getByLabel("Cantidad General", { exact: true }).selectOption("2");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByLabel("Nombre completo", { exact: true })
    .fill("Persona de ensayo");
  await page
    .getByLabel("Correo para tu cuenta y tus entradas", { exact: true })
    .fill("quick@example.test");
  await page
    .getByLabel("Contraseña (mínimo 10 caracteres)")
    .fill("fictional-password-123");
  await page
    .getByLabel("Género", { exact: true })
    .selectOption("prefer_not_to_say");
  await page
    .getByRole("checkbox", { name: /Acepto las condiciones de creación/ })
    .check();
  let next = "";
  await page.route("**/api/auth", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.action).toBe("signup");
    expect(body.name).toBe("Persona de ensayo");
    expect(body.email).toBe("quick@example.test");
    expect(body.terms_accepted).toBe(true);
    next = body.next;
    await route.fulfill({
      json: { ok: true, message: "Revisa tu correo para confirmar la cuenta." },
    });
  });
  await page
    .getByRole("button", { name: "Crear cuenta y continuar", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Revisa tu correo");
  await expect(
    page.getByLabel("Contraseña (mínimo 10 caracteres)"),
  ).toHaveCount(0);
  expect(next).toContain("?selection=");
  const login = page.getByRole("link", {
    name: "Ya tengo cuenta · Iniciar sesión",
    exact: true,
  });
  const href = await login.getAttribute("href");
  expect(new URL(href!, "http://localhost").searchParams.get("next")).toBe(
    next,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/quick-account-mobile.png",
    fullPage: true,
  });
  await page.unroute("**/api/auth");
  await page.unroute("**/api/state");
  await page.goto(href!);
  await page
    .getByRole("button", { name: "Comprador demo", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp("/events/noche-tropical-demo\\?selection="),
  );
  await expect(
    page.getByLabel("Cantidad General", { exact: true }),
  ).toHaveValue("2");
  await expect(page.locator('input[name="buyer_email"]')).toHaveCount(0);
  await expect(
    page.getByLabel("Correo para entrega", { exact: true }),
  ).toContainText("customer@example.test");
});
