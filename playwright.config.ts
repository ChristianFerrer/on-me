import { defineConfig, devices } from "@playwright/test";

/**
 * Suite end-to-end -distinta de los QA puntuales con `playwright` a pelo que
 * se usaron durante toda la sesión de rediseño de /c y /s-: esta vive en el
 * repo, pensada para volver a correrla, no para un script de usar y tirar.
 *
 * Corre contra un deploy real -`E2E_BASE_URL`, por defecto el de
 * producción-, no contra `next dev` en local: el servidor necesita
 * `SUPABASE_SERVICE_ROLE_KEY` de verdad para que las rutas de API
 * funcionen, y ese secreto no vive en este repo ni en ningún sandbox de
 * desarrollo -cada quien lo tiene en su propio `.env.local` o en las
 * variables de entorno de Vercel-. Apuntar al deploy ya desplegado evita
 * tener que repetirlo aquí.
 *
 * Todo lo que tocan estas pruebas vive bajo el local `e2e-test`
 * -ver tests/e2e/support/seed.mjs-, aislado del resto de locales reales:
 * nunca hay clientes, sellos ni canjes de verdad de por medio.
 */
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
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://on-me.vercel.app",
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
    // flag, así que se reenvía aquí. En una máquina sin proxy de salida,
    // HTTPS_PROXY no está puesta y esto queda sin efecto.
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
