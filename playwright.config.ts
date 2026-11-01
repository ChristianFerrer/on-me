import { defineConfig, devices } from "@playwright/test";

/**
 * Suite end-to-end -distinta de los QA puntuales con `playwright` a pelo que
 * se usaron durante toda la sesión de rediseño de /c y /s-: esta vive en el
 * repo, pensada para volver a correrla, no para un script de usar y tirar.
 *
 * Dos formas de correrla, mismas specs en los dos casos:
 *
 *   - Contra un deploy real -`E2E_BASE_URL`, por defecto el de
 *     producción-: no hace falta `next dev` ni ningún secreto en esta
 *     máquina, el deploy ya los tiene puestos en Vercel.
 *   - Contra un `next start` levantado aquí mismo -`E2E_BASE_URL` apuntando
 *     a localhost-: entonces SÍ hace falta `SUPABASE_SERVICE_ROLE_KEY` y el
 *     resto de lib/env.ts en esta máquina -ver .env.local o las variables
 *     de entorno del sandbox-, y Playwright arranca el servidor solo (ver
 *     `webServer` más abajo) en vez de pedir que ya esté corriendo.
 *
 * Todo lo que tocan estas pruebas vive bajo el local `e2e-test`
 * -ver tests/e2e/support/seed.mjs-, aislado del resto de locales reales:
 * nunca hay clientes, sellos ni canjes de verdad de por medio, sea cual
 * sea el servidor contra el que corran.
 */
const baseURL = process.env.E2E_BASE_URL ?? "https://on-me.vercel.app";
const isLocalServer = /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(baseURL);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // comparten el mismo local/dispositivo de prueba -ver seed.ts-, no conviene que compitan entre sí
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "tests/e2e/.last-run.json" }],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // Solo cuando se apunta a localhost: compila y levanta la app de verdad
  // -no `next dev`, que es más lento y no es lo que corre en producción-
  // antes de la primera prueba. `reuseExistingServer` para no chocar si ya
  // hay un `next start` corriendo a mano en ese puerto.
  webServer: isLocalServer
    ? {
        command: "npm run build && npm run start",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // El Chromium del sandbox de desarrollo es una revisión fija distinta
    // de la que este `@playwright/test` pediría por su cuenta -y
    // descargarla no es una opción aquí-, así que se apunta a ese binario
    // en vez de dejar que Playwright intente resolverlo solo. En CI o en
    // cualquier otra máquina con sus propios navegadores, basta con dejar
    // esta variable sin definir.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
    // El sandbox solo permite salir a Internet por un proxy local -ver
    // HTTPS_PROXY-: Chromium no lo detecta solo salvo que se le pase como
    // flag, así que se reenvía aquí. `bypass` para que el tráfico a
    // localhost -el `next start` de arriba- no intente pasar por ahí: ese
    // proxy solo sabe tunelizar HTTPS de salida a Internet, no reenviar
    // HTTP a un puerto de esta misma máquina.
    proxy: process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" }
      : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
