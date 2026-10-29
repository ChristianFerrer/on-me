#!/usr/bin/env node
// @ts-check
/**
 * Convierte el reporter JSON de Playwright (tests/e2e/.last-run.json,
 * ver playwright.config.ts) en un reporte en español, pensado para leer
 * de un vistazo qué falló y qué hacer con eso -lo que pidió el usuario:
 * "que al final envíe un reporte de los errores y las remediaciones"-.
 *
 * No decide remediaciones por arte de magia: las de la tabla REMEDIATIONS
 * de abajo son patrones conocidos de este proyecto -p.ej. "el selector de
 * cantidad no aparece" apunta a Scanner.tsx-. Un fallo que no calce con
 * ninguno sale con su mensaje crudo, para que alguien lo mire a mano.
 *
 * Uso: node tests/e2e/support/report.mjs [ruta/al/.last-run.json]
 */
import { readFile, writeFile } from "node:fs/promises";

const INPUT = process.argv[2] ?? "tests/e2e/.last-run.json";
const OUTPUT = "tests/e2e/REPORT.md";

const REMEDIATIONS = [
  {
    when: /ERR_CONNECTION|net::ERR|ECONNREFUSED|Timeout.*waitForURL|navigation/i,
    fix: "El deploy en E2E_BASE_URL no respondió. Comprueba que https://on-me.vercel.app (o el E2E_BASE_URL dado) esté arriba antes de reintentar.",
  },
  {
    when: /getByLabel.*cómo te llamas|getByLabel.*tu móvil|CustomerForm/i,
    fix: "El formulario de alta cambió sus aria-label o sus campos. Revisa components/client/CustomerForm.tsx y lib/i18n/dictionaries.ts §join.",
  },
  {
    when: /getByRole\('group', .*cafés a sellar|quantityLabel|quantityNone/i,
    fix: "El selector de cantidad del escáner cambió. Revisa components/barista/Scanner.tsx (grupo con role=\"group\" y la taza de 0 cafés).",
  },
  {
    when: /getByRole\('menu'\)|aria-haspopup|menuitem/i,
    fix: "El menú hamburguesa del escáner cambió su estructura. Revisa components/barista/Scanner.tsx (el `<div role=\"menu\">` y sus `role=\"menuitem\"`).",
  },
  {
    when: /canjear|identifyRedeemAmountCta|rewardsPending/i,
    fix: "El canje de café gratis cambió. Revisa components/barista/CustomerProfilePanel.tsx y, si el dato de partida no cuadra, vuelve a sembrar con `npm run test:e2e:seed` antes de repetir la corrida.",
  },
  {
    when: /searchTitle|getByLabel.*nombre o móvil/i,
    fix: "La búsqueda manual cambió su campo o su copy. Revisa components/barista/ManualSearch.tsx.",
  },
  {
    when: /relation .* does not exist|arrivals/i,
    fix: "Falta una tabla en la base de datos -revisa `supabase/migrations/` contra lo aplicado de verdad en el proyecto Supabase (mcp__supabase__list_migrations)-.",
  },
];

function pickRemediation(message) {
  const hit = REMEDIATIONS.find((r) => r.when.test(message));
  return hit?.fix ?? "Sin patrón conocido: revisar el mensaje de error y la traza/captura adjunta en playwright-report/.";
}

/** Recorre el árbol suites[].specs[].tests[].results[] del reporter JSON. */
function collectTests(suites, acc = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = test.results?.at(-1);
        acc.push({
          file: suite.file ?? spec.file,
          title: spec.title,
          status: result?.status ?? "unknown",
          duration: result?.duration ?? 0,
          error: result?.error?.message ?? result?.errors?.[0]?.message ?? null,
        });
      }
    }
    collectTests(suite.suites, acc);
  }
  return acc;
}

async function main() {
  const raw = await readFile(INPUT, "utf8").catch((err) => {
    throw new Error(`No pude leer ${INPUT} -¿se corrió "npm run test:e2e" antes?-: ${err.message}`);
  });
  const json = JSON.parse(raw);
  const tests = collectTests(json.suites);

  const passed = tests.filter((t) => t.status === "passed");
  const failed = tests.filter((t) => t.status !== "passed");

  const lines = [];
  lines.push("# Reporte de la suite end-to-end de OnMe");
  lines.push("");
  lines.push(`Corrida: ${new Date().toISOString()}`);
  lines.push(`Base URL: ${json.config?.projects?.[0]?.use?.baseURL ?? "?"}`);
  lines.push("");
  lines.push(`**${passed.length} de ${tests.length} pruebas pasaron.**`);
  lines.push("");

  if (failed.length === 0) {
    lines.push("Sin errores que reportar: todos los flujos cubiertos funcionan.");
  } else {
    lines.push("## Errores y remediaciones");
    lines.push("");
    for (const t of failed) {
      lines.push(`### ❌ ${t.title}`);
      lines.push(`- Archivo: \`${t.file}\``);
      lines.push(`- Estado: ${t.status}`);
      if (t.error) lines.push(`- Error: \`\`\`\n${t.error}\n\`\`\``);
      lines.push(`- Remediación sugerida: ${pickRemediation(t.error ?? t.title)}`);
      lines.push("");
    }
  }

  lines.push("## Todas las pruebas");
  lines.push("");
  for (const t of tests) {
    lines.push(`- ${t.status === "passed" ? "✅" : "❌"} ${t.title} (${t.duration}ms)`);
  }

  await writeFile(OUTPUT, lines.join("\n") + "\n", "utf8");
  console.log(`Reporte escrito en ${OUTPUT}: ${passed.length}/${tests.length} pruebas pasaron.`);
  if (failed.length > 0) process.exitCode = 1;
}

await main();
