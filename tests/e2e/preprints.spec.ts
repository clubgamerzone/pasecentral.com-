import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const eventId = "00000000-0000-4000-8000-000000000002";
const headers = { origin: "http://127.0.0.1:3100" };
async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".nav-foot")).toContainText(name);
}
test("lote sin activar se imprime sin vender, taquilla confirma pago y acceso lo usa una vez", async ({
  page,
}) => {
  await login(page, "Administración demo");
  await page
    .getByRole("link", { name: "Boletas preimpresas", exact: true })
    .click();
  await page.getByLabel("Evento del inventario").selectOption(eventId);
  await page.getByLabel("Nombre del lote").fill("Lote físico de ensayo");
  await page.getByLabel("Cantidad de boletas por preparar").fill("3");
  await page
    .getByLabel("Localidad del lote")
    .selectOption({ label: "General" });
  const phase = await page
    .getByLabel("Precio que se imprimirá")
    .locator("option")
    .nth(1)
    .getAttribute("value");
  await page.getByLabel("Precio que se imprimirá").selectOption(phase!);
  await page
    .getByRole("button", { name: "Crear lote y ver boletas", exact: true })
    .click();
  await expect(page.locator("h1")).toHaveText(
    "Boletas preimpresas sin activar",
  );
  await expect(page.locator(".ticket")).toHaveCount(3);
  const batchId = new URL(page.url()).pathname.split("/")[3];
  const original = await (
    await page.request.post("/api/preprints", {
      headers,
      data: { batch_id: batchId },
    })
  ).json();
  const paper = original.tickets[0],
    blocked = original.tickets[1];
  await expect(
    page.getByRole("button", {
      name: "Compartir PDF por WhatsApp",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page
    .getByRole("button", { name: "Quitar selección", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: `Imprimir boleta ${paper.visible_number}`,
      exact: true,
    })
    .check();
  const printResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/commands") &&
      r.request().postDataJSON()?.action === "preprint_print_request",
  );
  await page
    .getByRole("button", { name: "Imprimir seleccionadas (1)", exact: true })
    .click();
  expect((await (await printResponse).json()).jobs).toHaveLength(1);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Papel impreso y verificado", exact: true })
    .click();
  const denied = await page.request.post("/api/commands", {
    headers,
    data: {
      action: "scan_auto",
      credential: paper.credential,
      request_id: randomUUID(),
      device_id: "Test",
      gate_label: "P1",
    },
  });
  expect((await denied.json()).result).toBe("not_activated");
  await page
    .getByRole("link", { name: "Volver al inventario", exact: true })
    .click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Lote físico de ensayo" });
  await row
    .getByRole("button", { name: "Desactivar pendientes", exact: true })
    .waitFor();
  const entry = page
    .getByRole("row")
    .filter({ hasText: blocked.visible_number });
  await entry
    .getByRole("button", { name: "Desactivar esta boleta", exact: true })
    .click();
  await page
    .getByLabel("Motivo de la desactivación")
    .fill("Boleta extraviada en ensayo");
  await page
    .getByRole("checkbox", {
      name: "Entiendo que esta acción no se puede deshacer",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Desactivar definitivamente", exact: true })
    .click();
  await expect(entry).toContainText("Desactivada");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/preprints-inventory-mobile.png",
    fullPage: true,
  });
  await login(page, "Taquilla demo");
  await page.goto("/box-office/preprints");
  await page
    .getByRole("button", { name: "Activar venta", exact: true })
    .click();
  await page
    .getByLabel("Escanea el QR de la boleta sin activar")
    .fill(paper.credential);
  await page
    .getByRole("button", { name: "Consultar boleta", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: /Boleta N.º/ })).toBeVisible();
  await page
    .getByLabel("Medio de pago de la activación")
    .selectOption("transfer");
  await page
    .getByLabel("Referencia de la transferencia", { exact: true })
    .fill("ENSAYO-PREIMPRESA");
  await page
    .getByRole("checkbox", {
      name: "Verifiqué el importe en la cuenta del comercio",
      exact: true,
    })
    .check();
  await page.screenshot({
    path: "test-results/preprint-activation-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Confirmar cobro y activar boleta",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/tickets\//);
  await expect(page.locator(".ticket")).toHaveCount(1);
  const orderId = new URL(page.url()).pathname.split("/")[2];
  const active = await (
    await page.request.post("/api/tickets", {
      headers,
      data: { order_id: orderId },
    })
  ).json();
  expect(active.tickets[0].credential).toBe(paper.credential);
  expect(active.tickets[0].visible_number).toBe(paper.visible_number);
  await login(page, "Acceso demo");
  const noInventory = await page.request.get(
    `/api/preprints?event_id=${eventId}`,
  );
  expect(noInventory.status()).toBe(403);
  const scan = () =>
    page.request.post("/api/commands", {
      headers,
      data: {
        action: "scan_auto",
        credential: paper.credential,
        request_id: randomUUID(),
        device_id: "Test",
        gate_label: "P1",
      },
    });
  expect((await (await scan()).json()).result).toBe("accepted");
  expect((await (await scan()).json()).result).toBe("already_used");
});

test("gestor desactiva y elimina boletas desde vista previa e inventario sin reutilizar sus QR", async ({
  page,
}) => {
  await login(page, "Administración demo");
  const s = await (await page.request.get("/api/state")).json();
  const type = s.types.find(
    (t: { event_id: string; name: string }) =>
      t.event_id === eventId && t.name === "General",
  );
  const phase = s.phases.find(
    (p: { ticket_type_id: string; channel: string; active: boolean }) =>
      p.ticket_type_id === type.id && p.channel === "box_office" && p.active,
  );
  const created = await page.request.post("/api/commands", {
    headers,
    data: {
      action: "preprint_create",
      event_id: eventId,
      ticket_type_id: type.id,
      phase_id: phase.id,
      name: "Lote para retirar",
      quantity: 3,
      idempotency_key: randomUUID(),
    },
  });
  expect(created.ok()).toBeTruthy();
  const batchId = (await created.json()).batch_id;
  const doc = await (
    await page.request.post("/api/preprints", {
      headers,
      data: { batch_id: batchId },
    })
  ).json();
  await page.goto(`/box-office/preprints/${batchId}`);
  await expect(page.locator(".ticket")).toHaveCount(3);
  await page
    .locator(".ticket")
    .first()
    .getByRole("button", { name: "Eliminar boleta", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Eliminar boleta",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator(".ticket")).toHaveCount(3);
  await page
    .locator(".ticket")
    .first()
    .getByRole("button", { name: "Eliminar boleta", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Eliminar boleta", exact: true });
  await dialog
    .getByLabel("Motivo de la eliminación")
    .fill("Retiro de papel de ensayo");
  await dialog
    .getByRole("checkbox", {
      name: "Entiendo que esta acción no se puede deshacer",
      exact: true,
    })
    .check();
  await dialog
    .getByRole("button", { name: "Eliminar definitivamente", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/box-office/preprints\\?event=${eventId}`),
  );
  let row = page.getByRole("row").filter({ hasText: "Lote para retirar" });
  await row
    .getByRole("link", { name: "Imprimir pendientes", exact: true })
    .click();
  await expect(page.locator(".ticket")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Desactivar lote", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Desactivar lote", exact: true });
  await dialog
    .getByLabel("Motivo de la desactivación")
    .fill("Dejar inválido todo el lote");
  await dialog
    .getByRole("checkbox", {
      name: "Entiendo que esta acción no se puede deshacer",
      exact: true,
    })
    .check();
  await dialog
    .getByRole("button", { name: "Desactivar definitivamente", exact: true })
    .click();
  row = page.getByRole("row").filter({ hasText: "Lote para retirar" });
  await expect(row.getByRole("cell").nth(4)).toHaveText("2");
  await page.setViewportSize({ width: 390, height: 844 });
  await row.getByRole("button", { name: "Eliminar lote", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Eliminar lote", exact: true });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: "test-results/preprint-delete-confirm-mobile.png",
    fullPage: true,
  });
  await dialog
    .getByLabel("Motivo de la eliminación")
    .fill("Lote de ensayo retirado");
  await dialog
    .getByRole("checkbox", {
      name: "Entiendo que esta acción no se puede deshacer",
      exact: true,
    })
    .check();
  await dialog
    .getByRole("button", { name: "Eliminar definitivamente", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  const inventory = await (
    await page.request.get(`/api/preprints?event_id=${eventId}`)
  ).json();
  expect(inventory.batches.some((b: { id: string }) => b.id === batchId)).toBe(
    false,
  );
  for (const t of doc.tickets) {
    const scan = await page.request.post("/api/commands", {
      headers,
      data: {
        action: "scan_auto",
        credential: t.credential,
        request_id: randomUUID(),
        device_id: "Test",
        gate_label: "P1",
      },
    });
    expect((await scan.json()).result).toBe("unknown_ticket");
  }
});
