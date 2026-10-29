/**
 * Datos fijos del local de prueba -no generados al vuelo-, para que las
 * pruebas y el script de siembra (seed.mjs) hablen de los mismos valores
 * sin tener que consultarse entre sí. Viven en TypeScript, no en el script
 * de siembra, para que los `.spec.ts` los importen con tipos; seed.mjs los
 * repite a mano -JS plano, sin paso de compilación- con un comentario que
 * apunta aquí como fuente de verdad.
 *
 * Todo bajo el slug `e2e-test`: un local real, aislado, que no es ninguno
 * de los locales de un cliente real -ver tests/e2e/support/seed.mjs-.
 */
export const E2E_SHOP_SLUG = "e2e-test";
export const E2E_SHOP_NAME = "E2E Test Shop";
export const E2E_STAMPS_GOAL = 3;

/** Token crudo del dispositivo -el que se visita una sola vez en `/s/<token>`-. */
export const E2E_DEVICE_TOKEN = "e2e0test0device0token0000000001";

/**
 * Dos clientes fijos, cada uno preparado para un caso distinto:
 *
 *   nearComplete  2 de 3 sellos: un sello más completa la tarjeta -para
 *                 probar que sellar dispara el premio en el mismo gesto-.
 *   rewardReady   0 sellos, 1 café gratis ya pendiente -para probar el
 *                 canje directo sin tener que sellar primero-.
 */
export const E2E_CUSTOMERS = {
  nearComplete: {
    token: "e2e0test0customer0nearcomplete01",
    name: "E2E Near Complete",
    phone: "+34600000001",
    phoneLast4: "0001",
  },
  rewardReady: {
    token: "e2e0test0customer0rewardready002",
    name: "E2E Reward Ready",
    phone: "+34600000002",
    phoneLast4: "0002",
  },
} as const;

/**
 * Teléfono nuevo para el flujo de alta -join.spec.ts-: no vive en la lista
 * de arriba porque cada corrida de ese test crea (y borra) su propio
 * cliente, a diferencia de los dos de arriba, que el teardown nunca toca
 * -son punto de partida fijo para los demás specs, no algo que cada
 * corrida vuelve a crear-.
 */
export const E2E_JOIN_PHONE = "+34600000099";
export const E2E_JOIN_NAME = "E2E Join Test";
