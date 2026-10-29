import { expect, test } from "@playwright/test";
import { E2E_JOIN_NAME, E2E_SHOP_SLUG } from "./support/fixtures";

/**
 * Alta desde el QR de la barra (/j/<shop>) -ver app/j/[shop]/page.tsx-.
 * Cada corrida usa un teléfono distinto (prefijo +34600000, reservado para
 * pruebas, ver fixtures.ts/seed.mjs) para no colisionar con el cliente que
 * haya dejado una corrida anterior; el teardown del local de prueba se
 * los lleva a todos sin tener que listarlos aquí.
 */
test("un cliente nuevo se da de alta y llega a su tarjeta", async ({ page }) => {
  const phone = `+34600000${Math.floor(Math.random() * 900 + 100)}`;

  await page.goto(`/j/${E2E_SHOP_SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByLabel("cómo te llamas").fill(E2E_JOIN_NAME);
  await page.getByLabel("tu móvil").fill(phone);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "crear mi tarjeta" }).click();

  await page.waitForURL("**/c");
  // La tarjeta recién creada muestra el nombre del cliente en algún lado.
  await expect(page.getByText(E2E_JOIN_NAME, { exact: false }).first()).toBeVisible();
});
