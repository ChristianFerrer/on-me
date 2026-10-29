#!/usr/bin/env node
// @ts-check
/**
 * Siembra y limpieza del local de prueba para la suite end-to-end.
 *
 * JS plano, no TypeScript -sin paso de compilación, corre con `node` a
 * secas-, a propósito: es un script, no parte de la app. Los valores que
 * siembra están fijos en tests/e2e/support/fixtures.ts; se repiten aquí a
 * mano porque un script fuera del build de Next no puede importar ese
 * módulo con el alias "@/..." sin arrastrar su propia configuración de
 * loader. Si cambian los de allá, cambian estos.
 *
 * Necesita las mismas variables de entorno que la propia app en local
 * -SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
 * APP_SALT, ver lib/env.ts-: no hay sandbox de desarrollo con esas
 * credenciales, así que esto lo corre quien tenga su propio .env.local o
 * las tenga puestas en CI.
 *
 * Uso:
 *   node tests/e2e/support/seed.mjs seed       -crea/actualiza el local de prueba-
 *   node tests/e2e/support/seed.mjs teardown   -borra TODO lo que cuelga de él-
 *
 * `teardown` solo borra filas con `shop_id` del local `e2e-test` -nunca
 * toca otro local-, y de paso limpia clientes sueltos que haya dejado
 * join.spec.ts en corridas anteriores (busca por el prefijo de teléfono
 * +34600000, reservado para pruebas, ver fixtures.ts).
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SHOP_SLUG = "e2e-test";
const SHOP_NAME = "E2E Test Shop";
const STAMPS_GOAL = 3;
const DEVICE_TOKEN = "e2e0test0device0token0000000001";
const CUSTOMERS = [
  { token: "e2e0test0customer0nearcomplete01", name: "E2E Near Complete", phone: "+34600000001", phoneLast4: "0001", stamps: 2, cardsCompleted: 0, rewardPending: 0 },
  { token: "e2e0test0customer0rewardready002", name: "E2E Reward Ready", phone: "+34600000002", phoneLast4: "0002", stamps: 0, cardsCompleted: 1, rewardPending: 1 },
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name}. Esta siembra necesita las mismas variables que la app en local -ver lib/env.ts-.`);
  }
  return value;
}

/** Mismo algoritmo que lib/crypto.ts:hashWithSalt -sha256(valor + sal)-: tiene que coincidir si algún día algo compara contra el hash real. */
function hashWithSalt(value, salt) {
  return createHash("sha256").update(`${value}${salt}`).digest("hex");
}

function client() {
  const url = process.env.SUPABASE_URL ?? requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function seed() {
  const db = client();
  const salt = requiredEnv("APP_SALT");

  const { data: shop, error: shopError } = await db
    .from("shops")
    .upsert(
      {
        slug: SHOP_SLUG,
        name: SHOP_NAME,
        stamps_goal: STAMPS_GOAL,
        invite_ttl_days: 30,
        return_window_days: 30,
        bonus_stamps: 3,
        max_active_invites: 2,
        default_country_code: "+34",
        default_locale: "es",
        timezone: "Europe/Madrid",
        max_stamps_per_scan: 5,
        theme: "dark",
        card_style: "digital",
        card_background: "lima",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (shopError) throw shopError;

  const { error: deviceError } = await db
    .from("devices")
    .upsert(
      { shop_id: shop.id, name: "E2E Device", token: DEVICE_TOKEN, active: true, pin_hash: null },
      { onConflict: "token" },
    );
  if (deviceError) throw deviceError;

  for (const c of CUSTOMERS) {
    const { data: customer, error: customerError } = await db
      .from("customers")
      .upsert(
        {
          shop_id: shop.id,
          name: c.name,
          phone_hash: hashWithSalt(c.phone, salt),
          phone_last4: c.phoneLast4,
          token: c.token,
          phone: c.phone,
          source: "qr",
          locale: "es",
        },
        { onConflict: "token" },
      )
      .select("id")
      .single();
    if (customerError) throw customerError;

    const { data: existingPass } = await db.from("passes").select("id").eq("customer_id", customer.id).maybeSingle();
    const passRow = {
      customer_id: customer.id,
      stamps: c.stamps,
      cards_completed: c.cardsCompleted,
      reward_pending_count: c.rewardPending,
    };
    const { error: passError } = existingPass
      ? await db.from("passes").update(passRow).eq("id", existingPass.id)
      : await db.from("passes").insert(passRow);
    if (passError) throw passError;
  }

  console.log(`Sembrado: local "${SHOP_SLUG}" (${shop.id}), 1 dispositivo, ${CUSTOMERS.length} clientes.`);
}

async function teardown() {
  const db = client();

  const { data: shop } = await db.from("shops").select("id").eq("slug", SHOP_SLUG).maybeSingle();
  if (!shop) {
    console.log(`Nada que borrar: no existe el local "${SHOP_SLUG}".`);
    return;
  }

  // Clientes que cuelgan del local -los dos fijos, más cualquiera que haya
  // creado join.spec.ts en corridas anteriores-: sus pases, escaneos e
  // invitaciones se van con ellos por `on delete cascade`, si está puesto
  // así en el esquema; si no, se borran explícitamente antes para no dejar
  // huérfanos.
  const { data: customers } = await db.from("customers").select("id").eq("shop_id", shop.id);
  const customerIds = (customers ?? []).map((c) => c.id);

  if (customerIds.length > 0) {
    await db.from("passes").delete().in("customer_id", customerIds);
    await db.from("scans").delete().in("customer_id", customerIds);
    await db.from("invitations").delete().in("padrino_id", customerIds);
    await db.from("customers").delete().in("id", customerIds);
  }

  await db.from("device_sessions").delete().eq(
    "device_id",
    (await db.from("devices").select("id").eq("shop_id", shop.id).maybeSingle()).data?.id ?? "00000000-0000-0000-0000-000000000000",
  );
  await db.from("devices").delete().eq("shop_id", shop.id);
  await db.from("shops").delete().eq("id", shop.id);

  console.log(`Local "${SHOP_SLUG}" y todo lo que colgaba de él, borrado.`);
}

const action = process.argv[2];
if (action === "seed") {
  await seed();
} else if (action === "teardown") {
  await teardown();
} else {
  console.error("Uso: node tests/e2e/support/seed.mjs <seed|teardown>");
  process.exit(1);
}

// Export para quien quiera llamarlo desde el globalSetup/globalTeardown de
// Playwright en vez de como proceso aparte.
export { seed, teardown };
