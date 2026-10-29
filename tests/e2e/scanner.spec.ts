import { expect, test } from "@playwright/test";
import { E2E_DEVICE_TOKEN } from "./support/fixtures";

/**
 * Pantalla del escáner (/s) -ver components/barista/Scanner.tsx-: orden de
 * la cabecera (lupa a la izquierda, menú a la derecha), el propio menú
 * hamburguesa, y el selector de cantidad con la taza seleccionable como
 * "0 cafés".
 *
 * El enrolamiento del dispositivo (/s/<token>) no es estrictamente de una
 * sola vez -cada visita crea una sesión más, nunca invalida las
 * anteriores-, así que repetirlo en cada test es seguro: ver
 * app/s/[device]/route.ts.
 */
test.beforeEach(async ({ page }) => {
  await page.goto(`/s/${E2E_DEVICE_TOKEN}`);
  await page.waitForURL("**/s");
});

test("la cabecera tiene la lupa a la izquierda y el menú a la derecha", async ({ page }) => {
  const search = page.getByRole("link", { name: "buscar" });
  const menu = page.getByRole("button", { name: "menú" });

  await expect(search).toBeVisible();
  await expect(menu).toBeVisible();

  const [searchBox, menuBox] = await Promise.all([search.boundingBox(), menu.boundingBox()]);
  expect(searchBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(searchBox!.x).toBeLessThan(menuBox!.x);
});

test("el menú hamburguesa abre, muestra inicio/código de alta/cambiar de modo, y cierra con Escape", async ({
  page,
}) => {
  const menuButton = page.getByRole("button", { name: "menú" });
  await menuButton.click();

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  // El menú no se sale de la pantalla -bug ya corregido de anclaje a la izquierda-.
  const box = await menu.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);

  await expect(menu.getByRole("menuitem", { name: "inicio" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "código de alta" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "modo identificador" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("la taza del selector es seleccionable como «0 cafés» y los números se pueden elegir", async ({ page }) => {
  const group = page.getByRole("group", { name: "cafés a sellar" });
  await expect(group).toBeVisible();

  const cup = group.getByRole("button", { name: "no sellar ningún café" });
  const three = group.getByRole("button", { name: /3 café/ });

  await expect(cup).toBeVisible();
  await expect(three).toBeVisible();

  await three.click();
  await expect(three).toHaveAttribute("aria-pressed", "true");
  await expect(cup).toHaveAttribute("aria-pressed", "false");

  await cup.click();
  await expect(cup).toHaveAttribute("aria-pressed", "true");
  await expect(three).toHaveAttribute("aria-pressed", "false");
});
