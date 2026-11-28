import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const headers = { origin: "http://127.0.0.1:3100" };
async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".nav-foot")).toContainText(name);
}
async function purchase(page: Page, quantity: number) {
  const s = await (await page.request.get("/api/state")).json();
  const type = s.types.find(
    (t: { event_id: string; name: string }) =>
      t.event_id === "00000000-0000-4000-8000-000000000002" &&
      t.name === "General",
  );
  const reserved = await page.request.post("/api/commands", {
    headers,
    data: {
      action: "reserve",
      event_id: type.event_id,
      items: [{ ticket_type_id: type.id, quantity }],
      buyer_name: "Persona de ensayo",
      buyer_email: s.actor.email,
      admission_age_confirmed: true,
      idempotency_key: randomUUID(),
    },
  });
  expect(reserved.ok()).toBeTruthy();
  const order = await reserved.json();
  const paid = await page.request.post("/api/commands", {
    headers,
    data: { action: "demo_payment", order_id: order.order_id },
  });
  expect(paid.ok()).toBeTruthy();
  return { order_id: order.order_id, type };
}
test("comprador entra a sus boletas, desliza en móvil y abre solo su vista personal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Invitation QA promotes this shared demo identity; restore a buyer-only persona for this test.
  await login(page, "Administración demo");
  const resetRole = await page.request.post("/api/commands", {
    headers,
    data: {
      action: "team_update",
      user_id: "00000000-0000-4000-8000-000000000015",
      platform_admin: false,
      assignments: [],
    },
  });
  expect(resetRole.ok()).toBeTruthy();
  await login(page, "Comprador demo");
  await expect(page).toHaveURL(/\/account\/tickets$/);
  await purchase(page, 3);
  await page.reload();
  const state = await (await page.request.get("/api/state")).json();
  const count = state.tickets.filter(
    (t: { owner_user_id: string }) => t.owner_user_id === state.actor.id,
  ).length;
  await expect(page.locator(".wallet-ticket-card")).toHaveCount(count);
  await expect(
    page
      .locator(".wallet-ticket-card")
      .first()
      .getByRole("img", { name: /Boleta con QR/ }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/wallet-home-mobile.png" });
  await page
    .getByRole("button", { name: "Boleta siguiente", exact: true })
    .click();
  await expect(page.locator(".wallet-position")).toHaveText(
    `Entrada 2 de ${count}`,
  );
  await expect(
    page
      .locator(".wallet-ticket-card")
      .nth(1)
      .getByRole("img", { name: /Boleta con QR/ }),
  ).toBeVisible();
  await expect(page.locator(".wallet-position")).toHaveText(
    `Entrada 2 de ${count}`,
  );
  await expect
    .poll(() => page.locator(".wallet-track").evaluate((e) => e.scrollLeft))
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.locator(".wallet-gallery").screenshot({
    path: "test-results/wallet-mobile.png",
  });
  await expect(page.locator(".wallet-position")).toHaveText(
    `Entrada 2 de ${count}`,
  );
  await page
    .locator(".wallet-ticket-card")
    .nth(1)
    .getByRole("link", { name: "Ver entrada", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tickets\/.*\?mine=1$/);
  await expect(page.locator(".ticket").first()).toBeVisible();
});
test("personal mantiene su puesto, ve acceso a sus tiquetes y no hereda permisos sobre boletas ajenas en su carrusel", async ({
  page,
}) => {
  await login(page, "Administración demo");
  await expect(page).toHaveURL(/\/admin$/);
  const own = await purchase(page, 2);
  const other = await page.request.post("/api/commands", {
    headers,
    data: {
      action: "sell",
      event_id: own.type.event_id,
      items: [{ ticket_type_id: own.type.id, quantity: 1 }],
      method: "transfer",
      verified: true,
      reference: "ENSAYO",
      idempotency_key: randomUUID(),
    },
  });
  expect(other.ok()).toBeTruthy();
  const otherDoc = await (
    await page.request.post("/api/tickets", {
      headers,
      data: { order_id: (await other.json()).order_id },
    })
  ).json();
  const denied = await page.request.post("/api/tickets", {
    headers,
    data: {
      order_id: otherDoc.order.id,
      owner_only: true,
      preview_ticket_id: otherDoc.tickets[0].id,
    },
  });
  expect(denied.status()).toBe(403);
  await page.reload();
  await page.getByRole("link", { name: /Ver mis tiquetes/ }).click();
  const state = await (await page.request.get("/api/state")).json();
  const owned = state.tickets.filter(
    (t: { owner_user_id: string }) => t.owner_user_id === state.actor.id,
  );
  await expect(page.locator(".wallet-ticket-card")).toHaveCount(owned.length);
  await expect(page.locator(".wallet-track")).not.toContainText(
    otherDoc.tickets[0].visible_number,
  );
  const ownDoc = await (
    await page.request.post("/api/tickets", {
      headers,
      data: { order_id: own.order_id, owner_only: true },
    })
  ).json();
  const preview = await (
    await page.request.post("/api/tickets", {
      headers,
      data: {
        order_id: own.order_id,
        owner_only: true,
        preview_ticket_id: ownDoc.tickets[0].id,
      },
    })
  ).json();
  expect(preview.id).toBe(ownDoc.tickets[0].id);
  expect(preview.image).toMatch(/^data:image\/png;base64,/);
  expect(preview.credential).toBeUndefined();
  expect(preview.share).toBeUndefined();
  await page.screenshot({
    path: "test-results/wallet-staff-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  for (const [name, path] of [
    ["Organización demo", "/admin"],
    ["Taquilla demo", "/box-office"],
    ["Acceso demo", "/access"],
  ]) {
    await login(page, name);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});
