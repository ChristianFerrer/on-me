import { expect, test } from "@playwright/test";
import { E2E_CUSTOMERS, E2E_DEVICE_TOKEN } from "./support/fixtures";

/**
 * Plan B sin cámara (/s/buscar -ver ManualSearch.tsx-) seguido del canje
 * directo del café gratis ya pendiente (CustomerProfilePanel.tsx) -ver
 * también la investigación de esta sesión: ¿hace falta un QR para cobrar
 * el café gratis? No: por aquí se cobra sin escanear nada-.
 */
test.beforeEach(async ({ page }) => {
  await page.goto(`/s/${E2E_DEVICE_TOKEN}`);
  await page.waitForURL("**/s");
});

test("buscar por nombre encuentra al cliente y canjear su café gratis cierra con su ficha", async ({ page }) => {
  const customer = E2E_CUSTOMERS.rewardReady;

  await page.goto("/s/buscar");
  await page.getByLabel("nombre o móvil del cliente").fill(customer.name);

  const hit = page.getByRole("link", { name: new RegExp(customer.name) });
  await expect(hit).toBeVisible();
  await hit.click();

  await page.waitForURL(/\/s\/cliente\//);
  await expect(page.getByRole("heading", { level: 1, name: customer.name })).toBeVisible();

  const redeemButton = page.getByRole("button", { name: "canjear 1" });
  await expect(redeemButton).toBeVisible();
  await redeemButton.click();

  // Sin PIN -dispositivo de prueba sembrado sin pin_hash-: pasa directo al
  // resumen de cierre, con la misma ficha del cliente.
  await expect(page.getByRole("heading", { level: 1, name: customer.name })).toBeVisible();
  await expect(redeemButton).toHaveCount(0);
});

test("buscar por móvil también encuentra al cliente", async ({ page }) => {
  const customer = E2E_CUSTOMERS.nearComplete;

  await page.goto("/s/buscar");
  await page.getByLabel("nombre o móvil del cliente").fill(customer.phone.replace("+34", ""));

  await expect(page.getByRole("link", { name: new RegExp(customer.name) })).toBeVisible();
});
