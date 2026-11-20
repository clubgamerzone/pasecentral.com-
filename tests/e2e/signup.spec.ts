import { test, expect } from "@playwright/test";

test("registro neutro permite entrar o recuperar sin afirmar cuenta nueva", async ({
  page,
}) => {
  await page.route("**/api/state", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), demo: false },
    });
  });
  let requests = 0;
  await page.route("**/api/auth", async (route) => {
    expect(route.request().postDataJSON().action).toBe("signup");
    requests++;
    await route.fulfill({
      json: {
        ok: true,
        message:
          "Si este correo es nuevo, recibirás un enlace para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión o recupera tu contraseña; registrarte otra vez no crea una cuenta adicional.",
      },
    });
  });
  await page.goto("/login?register=1&invitation=1");
  await page.getByLabel("Nombre completo").fill("Persona ficticia");
  await page
    .getByLabel("Género", { exact: true })
    .selectOption("prefer_not_to_say");
  await page.getByRole("checkbox").check();
  await page.getByLabel("Correo electrónico").fill("fixture@example.test");
  await page
    .getByLabel("Contraseña (mínimo 10 caracteres)")
    .fill("fictional-password-123");
  await page.getByRole("button", { name: /^Crear cuenta/ }).click();
  await expect(
    page.getByRole("heading", { name: "Continúa con tu cuenta" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Contraseña (mínimo 10 caracteres)"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Recuperar contraseña", exact: true }),
  ).toHaveAttribute("href", "/forgot-password");
  expect(requests).toBe(1);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
});
