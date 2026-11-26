import { test, expect, type Page } from "@playwright/test";

const eventId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
type Command = Record<string, unknown>;

// Browser interaction tests use an isolated API double: no sales or emails in cloud databases.
async function setup(page: Page, cashOpen = true) {
  const commands: Command[] = [];
  const activated = new Set<string>();
  const completed: Command[] = [];
  let stateReads = 0;
  let failNext = false;
  await page.route("**/api/state", async (route) => {
    stateReads++;
    await route.fulfill({
      json: {
        demo: false,
        environment: "staging",
        actor: { id: actorId, name: "Operador de prueba" },
        profile: null,
        pending_invitation: null,
        invitations: [],
        permissions: { admin: false, manage: [], sell: [eventId], access: [] },
        events: [
          {
            id: eventId,
            title: "Evento de prueba",
            status: "published",
            available: 20,
          },
        ],
        sessions: cashOpen
          ? [
              {
                id: "cash-test",
                event_id: eventId,
                operator_id: actorId,
                closed_at: null,
              },
            ]
          : [],
        organizations: [],
        types: [],
        phases: [],
        orders: [],
        items: [],
        tickets: [],
        payments: [],
        movements: [],
        attempts: [],
        audit: [],
        jobs: [],
        refunds: [],
        people: [],
        staff: [],
        members: [],
      },
    });
  });
  await page.route("**/api/preprints?**", (route) =>
    route.fulfill({
      json: { batches: [], tickets: [], sellers: [], manager: false },
    }),
  );
  await page.route("**/api/commands", async (route) => {
    const body = route.request().postDataJSON() as Command;
    commands.push(body);
    const credential = String(body.credential);
    if (body.action === "preprint_lookup") {
      await route.fulfill({
        json: {
          event_id: eventId,
          visible_number: "ENSAYO-000001",
          unit_price_cop: 10000,
          status:
            credential === "pc:blocked"
              ? "blocked"
              : activated.has(credential)
                ? "activated"
                : "stock",
        },
      });
    } else if (body.action === "preprint_activate") {
      if (
        credential === "pc:blocked" ||
        activated.has(credential) ||
        (!cashOpen && body.method === "cash")
      ) {
        await route.fulfill({
          status: 409,
          json: {
            error:
              credential === "pc:blocked"
                ? "Boleta bloqueada: no se puede activar"
                : activated.has(credential)
                  ? "Esta boleta ya fue vendida y activada. No vuelvas a cobrarla."
                  : "Abre la caja de este evento antes de cobrar en efectivo",
          },
        });
      } else if (failNext) {
        failNext = false;
        await route.fulfill({
          status: 503,
          json: { error: "Error temporal de prueba" },
        });
      } else {
        activated.add(credential);
        completed.push(body);
        await route.fulfill({
          json: {
            order_id: "order-test",
            event_id: eventId,
            visible_number: "ENSAYO-000001",
            unit_price_cop: 10000,
          },
        });
      }
    } else
      await route.fulfill({
        status: 400,
        json: { error: "Acción inesperada en prueba" },
      });
  });
  await page.goto("/box-office?mode=preprints");
  await expect(page.getByLabel("Escanea para vender y activar")).toBeVisible();
  return {
    commands,
    fail: () => {
      failNext = true;
    },
    sales: () => completed,
    attempts: () => commands.filter((c) => c.action === "preprint_activate"),
    stateReads: () => stateReads,
  };
}

test("lectura automática y Enter venden una vez, conservan pantalla y rechazan QR repetido", async ({
  page,
}) => {
  const api = await setup(page);
  const scanner = page.getByLabel("Escanea para vender y activar");
  const reads = api.stateReads();
  await scanner.fill("pc:first");
  await expect.poll(() => api.sales().length).toBe(1);
  await expect(scanner).toHaveValue("");
  await expect(scanner).toBeFocused();
  expect(api.commands).toHaveLength(1);
  expect(api.stateReads()).toBe(reads);
  await scanner.fill("pc:second");
  await scanner.press("Enter");
  await scanner.press("Enter");
  await expect.poll(() => api.sales().length).toBe(2);
  await expect(scanner).toHaveValue("");
  await scanner.fill("pc:second");
  await scanner.press("Enter");
  await expect(page.locator(".scan-result")).toContainText("ya fue vendida");
  await expect(scanner).toHaveValue("");
  await expect(scanner).toBeFocused();
  expect(api.sales()).toHaveLength(2);
  await expect(page).toHaveURL(/box-office\?mode=preprints/);
  expect(api.commands.some((c) => c.action === "scan_auto")).toBe(false);
});

test("bloqueada y caja cerrada no registran ventas", async ({ page }) => {
  const api = await setup(page, false);
  const scanner = page.getByLabel("Escanea para vender y activar");
  await scanner.fill("pc:blocked");
  await scanner.press("Enter");
  await expect(page.locator(".scan-result")).toContainText("bloqueada");
  await expect(scanner).toHaveValue("");
  await scanner.fill("pc:stock");
  await scanner.press("Enter");
  await expect(page.locator(".scan-result")).toContainText("Abre la caja");
  await expect(
    page.getByRole("button", { name: "Abrir caja de Evento de prueba" }),
  ).toBeVisible();
  expect(api.sales()).toHaveLength(0);
});

test("transferencia exige verificación individual y limpia los datos después de vender", async ({
  page,
}) => {
  const api = await setup(page);
  await page
    .getByLabel("Medio de pago para la lectura")
    .selectOption("transfer");
  const scanner = page.getByLabel("Escanea para vender y activar");
  await scanner.fill("pc:transfer");
  await scanner.press("Enter");
  await expect(page.locator(".scan-result")).toContainText(
    "verifica la transferencia",
  );
  expect(api.sales()).toHaveLength(0);
  await page
    .getByLabel("Referencia de esta transferencia")
    .fill("FICTICIA-123");
  await page
    .getByLabel("Verifiqué el importe en la cuenta del comercio")
    .check();
  // Preparing a payment never starts a sale by itself; a scan/Enter triggers it.
  expect(api.sales()).toHaveLength(0);
  await scanner.fill("pc:transfer");
  await scanner.press("Enter");
  await expect.poll(() => api.sales().length).toBe(1);
  await expect(scanner).toHaveValue("");
  await expect(page.getByLabel("Referencia de esta transferencia")).toHaveValue(
    "",
  );
  await expect(
    page.getByLabel("Verifiqué el importe en la cuenta del comercio"),
  ).not.toBeChecked();
  await scanner.fill("pc:another-transfer");
  await scanner.press("Enter");
  await expect(page.locator(".scan-result")).toContainText(
    "verifica la transferencia",
  );
  expect(api.sales()).toHaveLength(1);
});

test("fallo de servidor permite reintentar con la misma clave sin repetir automáticamente", async ({
  page,
}) => {
  const api = await setup(page);
  api.fail();
  const scanner = page.getByLabel("Escanea para vender y activar");
  await scanner.fill("pc:retry");
  await scanner.press("Enter");
  await expect(page.locator(".scan-result")).toContainText("Error temporal");
  await expect(scanner).toHaveValue("");
  expect(api.attempts()).toHaveLength(1);
  await scanner.press("Enter");
  await expect(page.locator(".scan-result")).toContainText("Venta confirmada");
  expect(api.sales()).toHaveLength(1);
  expect(api.attempts()).toHaveLength(2);
  expect(api.attempts()[0].idempotency_key).toBe(
    api.attempts()[1].idempotency_key,
  );
});
