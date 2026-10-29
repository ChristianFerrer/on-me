import { expect, test } from "@playwright/test";
import { E2E_CUSTOMERS } from "./support/fixtures";

/**
 * Tarjeta del cliente (/c) -ver app/c/page.tsx y app/c/[token]/route.ts-.
 * Entrar por /c/<token> pone la cookie httpOnly y redirige a /c, igual que
 * cuando alguien escanea su propio QR guardado: no hay cookie que fijar a
 * mano desde Playwright.
 */
test.describe("tarjeta de cliente", () => {
  test("cliente a 1 sello de completar la tarjeta ve el aviso de recompensa cercana", async ({ page }) => {
    await page.goto(`/c/${E2E_CUSTOMERS.nearComplete.token}`);
    await page.waitForURL("**/c");

    await expect(page.getByText(E2E_CUSTOMERS.nearComplete.name, { exact: false }).first()).toBeVisible();
    // "te falta 1 café y el siguiente es gratis" -2 de 3 sellos sembrados-.
    await expect(page.getByText("te falta 1 café", { exact: false })).toBeVisible();
  });

  test("cliente con café gratis pendiente ve el código para canjearlo", async ({ page }) => {
    await page.goto(`/c/${E2E_CUSTOMERS.rewardReady.token}`);
    await page.waitForURL("**/c");

    await expect(page.getByText(E2E_CUSTOMERS.rewardReady.name, { exact: false }).first()).toBeVisible();
    await expect(page.getByText("enseña este código en la barra", { exact: false })).toBeVisible();
  });

  test("token inválido no revienta: vuelve a /c con el error de tarjeta no encontrada", async ({ page }) => {
    await page.goto("/c/esto-no-es-un-token-real");
    await page.waitForURL("**/c**");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
