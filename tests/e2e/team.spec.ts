import { test, expect, type Page } from "@playwright/test";
const e1 = "00000000-0000-4000-8000-000000000002";
const customer = "00000000-0000-4000-8000-000000000015";
async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".nav-foot")).toContainText(name);
}
test("incluir acceso en invitación y editar taquilla/lector desde usuarios sin eliminar cuenta", async ({
  page,
}) => {
  await login(page, "Administración demo");
  await page.goto("/admin/users");
  await page
    .getByRole("button", {
      name: "Editar permisos de Administración demo",
      exact: true,
    })
    .click();
  const protectedDialog = page.getByRole("dialog", {
    name: "Editar usuario y permisos",
  });
  await protectedDialog
    .getByRole("checkbox", {
      name: "Administrador global (todos los eventos)",
      exact: true,
    })
    .uncheck();
  await protectedDialog
    .getByRole("button", { name: "Guardar usuario y permisos" })
    .click();
  await expect(protectedDialog.getByRole("alert")).toContainText(
    "último administrador global",
  );
  await protectedDialog
    .getByRole("button", { name: "Cancelar edición" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /Incluir acceso/ }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /Incluir acceso/ }).check();
  await page
    .getByLabel("Rol de la invitación", { exact: true })
    .selectOption("access_staff");
  await expect(
    page.getByRole("checkbox", { name: /Incluir acceso/ }),
  ).toHaveCount(0);
  await page
    .getByLabel("Rol de la invitación", { exact: true })
    .selectOption("box_office");
  await expect(
    page.getByRole("checkbox", { name: /Incluir acceso/ }),
  ).toBeChecked();
  // No emails sent; invitation acceptance is covered by transactional unit tests.
  await page
    .getByRole("button", {
      name: "Editar permisos de Comprador demo",
      exact: true,
    })
    .click();
  const modal = page.getByRole("dialog", { name: "Editar usuario y permisos" });
  const before = await (await page.request.get("/api/state")).json();
  const title = before.events.find((e: { id: string }) => e.id === e1).title;
  await modal
    .getByRole("checkbox", {
      name: `Cajero / taquilla — ${title}`,
      exact: true,
    })
    .check();
  await modal
    .getByRole("checkbox", {
      name: `Acceso / lector QR — ${title}`,
      exact: true,
    })
    .check();
  await modal
    .getByRole("checkbox", {
      name: `Administrador de evento — ${title}`,
      exact: true,
    })
    .uncheck();
  await modal
    .getByRole("button", { name: "Guardar usuario y permisos" })
    .click();
  await expect(modal).toHaveCount(0);
  const roles = await (await page.request.get("/api/state")).json();
  expect(
    roles.staff
      .filter(
        (s: { user_id: string; event_id: string; active: boolean }) =>
          s.user_id === customer && s.event_id === e1 && s.active,
      )
      .map((s: { role: string }) => s.role)
      .sort(),
  ).toEqual(["access_staff", "box_office"]);
  await page
    .getByRole("button", {
      name: "Editar permisos de Comprador demo",
      exact: true,
    })
    .click();
  await modal
    .getByRole("checkbox", {
      name: `Acceso / lector QR — ${title}`,
      exact: true,
    })
    .uncheck();
  await modal
    .getByRole("button", { name: "Guardar usuario y permisos" })
    .click();
  await expect(modal).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Usuarios y permisos", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await login(page, "Comprador demo");
  const permissions = await (await page.request.get("/api/state")).json();
  expect(permissions.permissions.sell).toContain(e1);
  expect(permissions.permissions.access).not.toContain(e1);
  expect(permissions.actor.id).toBe(customer);
});
test("administrador de evento invita y edita solo su evento, sin nombres ni rol global", async ({
  page,
}) => {
  await login(page, "Administración demo");
  const changed = await page.request.post("/api/commands", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {
      action: "team_update",
      user_id: customer,
      assignments: [{ event_id: e1, roles: ["organizer"] }],
    },
  });
  expect(changed.status()).toBe(200);
  await login(page, "Comprador demo");
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "Invitar a tu equipo", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .getByLabel("Rol de la invitación", { exact: true })
      .locator("option")
      .allTextContents(),
  ).not.toContain("Administrador global");
  await page
    .getByRole("button", {
      name: "Editar permisos de Taquilla demo",
      exact: true,
    })
    .click();
  const modal = page.getByRole("dialog", { name: "Editar usuario y permisos" });
  await expect(
    modal.getByRole("checkbox", {
      name: "Administrador global (todos los eventos)",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    modal.getByLabel("Nombre del usuario", { exact: true }),
  ).toHaveCount(0);
  const state = await (await page.request.get("/api/state")).json();
  expect(state.permissions.manage).toEqual([e1]);
  await expect(modal.locator("fieldset")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
});
