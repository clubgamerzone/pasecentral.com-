import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("fases desactivadas desaparecen de compra y taquilla y no permiten vender", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Administración demo", exact: true })
    .click();
  await expect(page.locator(".nav-foot")).toContainText("Administración demo");
  const state = await (await page.request.get("/api/state")).json();
  const event = state.events.find(
    (e: { status: string }) => e.status === "published",
  );
  const vip = state.types.find(
    (t: { event_id: string; name: string }) =>
      t.event_id === event.id && t.name === "VIP",
  );
  const phases = state.phases.filter(
    (p: { ticket_type_id: string; active: boolean }) =>
      p.ticket_type_id === vip.id && p.active,
  );
  expect(phases.length).toBeGreaterThan(0);
  const headers = { origin: "http://127.0.0.1:3100" };
  try {
    for (const phase of phases) {
      const response = await page.request.post("/api/commands", {
        headers,
        data: {
          action: "phase_active",
          event_id: event.id,
          phase_id: phase.id,
          active: false,
        },
      });
      expect(response.ok()).toBeTruthy();
    }
    await page.goto(`/events/${event.slug}`);
    await expect(
      page.getByLabel("Cantidad General", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Cantidad VIP", { exact: true })).toHaveCount(
      0,
    );
    await page.goto("/box-office");
    await page
      .getByLabel("Evento activo", { exact: true })
      .selectOption(event.id);
    await expect(
      page.getByLabel("Cantidad General", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Cantidad VIP", { exact: true })).toHaveCount(
      0,
    );
    for (const action of ["reserve", "sell"]) {
      const response = await page.request.post("/api/commands", {
        headers,
        data: {
          action,
          event_id: event.id,
          items: [{ ticket_type_id: vip.id, quantity: 1 }],
          buyer_name: "Ensayo ficticio",
          buyer_email: "layout@example.test",
          admission_age_confirmed: true,
          idempotency_key: randomUUID(),
          ...(action === "sell"
            ? { method: "transfer", verified: true, reference: "ENSAYO" }
            : {}),
        },
      });
      expect(response.ok()).toBeFalsy();
    }
    await page
      .getByLabel("Medio de cobro", { exact: true })
      .selectOption("complimentary");
    await expect(
      page.getByLabel("Cantidad VIP", { exact: true }),
    ).toBeVisible();
  } finally {
    for (const phase of phases) {
      const response = await page.request.post("/api/commands", {
        headers,
        data: {
          action: "phase_active",
          event_id: event.id,
          phase_id: phase.id,
          active: true,
        },
      });
      expect(response.ok()).toBeTruthy();
    }
  }
});
