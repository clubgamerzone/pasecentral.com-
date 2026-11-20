import { test, expect } from "@playwright/test";
test("cambiar de sección conserva la app y presenta la pantalla antes de actualizar los datos", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Administración demo", exact: true })
    .click();
  await expect(page.locator(".nav-foot")).toContainText("Administración demo");
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).navigationProof =
      "same-document";
  });
  let release = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/state", async (route) => {
    await hold;
    await route.continue().catch(() => {});
  });
  let documentRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.resourceType() === "document")
      documentRequests++;
  });
  try {
    for (const [label, heading] of [
      ["Organizaciones", "Organizaciones"],
      ["Caja", "Tu caja, al día"],
      ["Explorar eventos", "Una entrada. Una gran noche."],
    ]) {
      const started = Date.now();
      await page
        .locator(".sidebar")
        .getByRole("link", { name: label, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible({ timeout: 3000 });
      expect(
        await page.evaluate(
          () => (window as unknown as Record<string, unknown>).navigationProof,
        ),
      ).toBe("same-document");
      console.log(
        JSON.stringify({
          section: label,
          ms: Date.now() - started,
          environment: "isolated demo; state response held",
        }),
      );
    }
    expect(documentRequests).toBe(0);
  } finally {
    release();
    await page.unroute("**/api/state");
  }
});
