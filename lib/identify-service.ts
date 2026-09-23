import { db } from "@/lib/db/client";
import type { DeviceContext } from "@/lib/auth/device";
import { checkPin } from "@/lib/auth/device";
import { countClaimedFromInvites, countInvitationsSent, createInvitation } from "@/lib/invitations";
import { applyRewardRedeem, applyStampBatch, type InvalidReason, type PassState } from "@/lib/scan";
import { ensurePass, findCustomer, firstName, logScan } from "@/lib/scan-service";

/**
 * Flujo identificador: escanear resuelve quién es el cliente -y solo eso-,
 * antes de decidir nada. El flujo clásico (lib/scan-service.ts) decide y
 * aplica en el mismo gesto; este separa "quién es" de "qué le hago", para
 * que el barista vea el perfil completo antes de elegir sellos y canje.
 *
 * Comparte con el clásico lo que de verdad es lo mismo -resolver al
 * cliente, garantizar su pase, sumar sellos cruzando de tarjeta, canjear
 * premios- vía lib/scan.ts y las funciones exportadas de scan-service.ts.
 * Lo que no comparte es la decisión: aquí no hay decideScan, el barista
 * decide a mano con lo que ve en pantalla.
 */

export type IdentifyResult =
  | {
      kind: "profile";
      customerId: string;
      name: string;
      stamps: number;
      goal: number;
      /** Cafés gratis completados y sin canjear, acumulados. */
      rewardsPending: number;
      /** Tarjetas completadas en toda su historia -no solo la activa-. */
      cardsCompleted: number;
      /** Cafés gratis ya reclamados en toda su historia -cardsCompleted menos los que aún quedan pendientes-. */
      rewardsClaimed: number;
      /** Cuánta gente ha invitado en total, sea cual sea el estado de esas invitaciones. */
      invitedCount: number;
      /** Clientes nuevos que se dieron de alta con una invitación suya. */
      newCustomersFromInvites: number;
      /** ISO, fecha de alta. */
      createdAt: string;
      phoneLast4: string;
      /** E.164 completo, o `null` si se dio de alta antes de guardarlo -migración 0003-. */
      phone: string | null;
      /** Tope de sellos que el selector de esta pantalla deja pedir de una vez, ver /admin/ajustes. */
      maxStamps: number;
    }
  | { kind: "invalid"; reason: InvalidReason };

/** Resuelve al cliente y deja rastro -kind 'identify'- sin sellar ni canjear nada. */
export async function identifyCustomer(
  ctx: DeviceContext,
  token: string,
): Promise<IdentifyResult> {
  const { shop } = ctx;
  const customer = await findCustomer({ token });

  if (!customer) {
    await logScan(ctx, null, "identify", {});
    return { kind: "invalid", reason: "unknown_token" };
  }

  if (customer.shop_id !== shop.id) {
    await logScan(ctx, null, "identify", {});
    return { kind: "invalid", reason: "other_shop" };
  }

  const [pass, invitedCount, newCustomersFromInvites] = await Promise.all([
    ensurePass(customer.id),
    countInvitationsSent(customer.id),
    countClaimedFromInvites(customer.id),
  ]);

  await logScan(ctx, customer.id, "identify", {});

  return {
    kind: "profile",
    customerId: customer.id,
    name: firstName(customer.name),
    stamps: pass.stamps,
    goal: shop.stamps_goal,
    rewardsPending: pass.reward_pending_count,
    cardsCompleted: pass.cards_completed,
    rewardsClaimed: pass.cards_completed - pass.reward_pending_count,
    invitedCount,
    newCustomersFromInvites,
    createdAt: customer.created_at,
    phoneLast4: customer.phone_last4,
    phone: customer.phone,
    maxStamps: shop.max_stamps_per_scan,
  };
}

export type IdentifyApplyOptions = {
  /** Sellos a sumar -puede ser 0: hay quien solo viene a canjear, sin comprar más-. */
  addStamps: number;
  /** Cafés gratis a canjear ahora, de los que ya tenía acumulados -puede ser 0-. */
  redeemCount: number;
  pin?: string;
};

export type IdentifyApplyResult =
  | {
      kind: "applied";
      name: string;
      stamps: number;
      goal: number;
      added: number;
      rewardsEarned: number;
      redeemed: number;
      /** Cafés gratis que le siguen quedando pendientes tras este canje. */
      rewardsRemaining: number;
    }
  | { kind: "invalid"; reason: InvalidReason };

export type IdentifyApplyOutcome =
  | { status: "ok"; result: IdentifyApplyResult }
  | { status: "pin_required" }
  | { status: "pin_wrong" };

/**
 * Aplica de una vez lo que el barista eligió en el perfil: sellos, canje, o
 * los dos. El PIN solo hace falta si de verdad se canjea algo -sellar solo
 * sigue sin pedir nada, igual que en el flujo clásico-. Sin ceremonia de
 * "vista previa": el propio panel de perfil ya es la vista previa.
 */
export async function applyIdentifiedVisit(
  ctx: DeviceContext,
  customerId: string,
  options: IdentifyApplyOptions,
): Promise<IdentifyApplyOutcome> {
  const { shop, device } = ctx;
  // Nunca más del tope del local, ni aunque llegue un valor viejo desde un
  // cliente que todavía no ha recargado tras un cambio en /admin/ajustes.
  const addStamps = Math.min(shop.max_stamps_per_scan, Math.max(0, Math.floor(options.addStamps)));
  const redeemRequested = Math.max(0, Math.floor(options.redeemCount));

  const customer = await findCustomer({ customerId });
  if (!customer) {
    return { status: "ok", result: { kind: "invalid", reason: "unknown_token" } };
  }
  if (customer.shop_id !== shop.id) {
    return { status: "ok", result: { kind: "invalid", reason: "other_shop" } };
  }

  if (redeemRequested > 0 && !checkPin(device, options.pin)) {
    return { status: options.pin ? "pin_wrong" : "pin_required" };
  }

  const pass = await ensurePass(customer.id);
  const before: PassState = {
    stamps: pass.stamps,
    cardsCompleted: pass.cards_completed,
    rewardsPending: pass.reward_pending_count,
  };

  const batch =
    addStamps > 0
      ? applyStampBatch(before, shop.stamps_goal, addStamps)
      : { pass: before, applied: 0, rewardsEarned: 0 };

  // Nunca más de lo que de verdad tiene acumulado, ni aunque el barista se
  // equivoque al escribir la cantidad.
  const redeemed = Math.min(redeemRequested, batch.pass.rewardsPending);
  const after = redeemed > 0 ? applyRewardRedeem(batch.pass, redeemed) : batch.pass;

  // Igual que en el flujo clásico: un sello = una fila, y solo el conjunto
  // -no cada unidad- lleva su propio tiempo, que aquí no existe -no hay
  // gesto de cámara-a-resultado que medir, es un botón tras revisar el
  // perfil-, así que ninguna fila lleva duration_ms.
  for (let i = 0; i < batch.applied; i++) {
    await logScan(ctx, customer.id, "stamp", {});
  }
  for (let i = 0; i < redeemed; i++) {
    await logScan(ctx, customer.id, "redeem_reward", {});
  }

  await db()
    .from("passes")
    .update({
      stamps: after.stamps,
      cards_completed: after.cardsCompleted,
      reward_pending_count: after.rewardsPending,
    })
    .eq("id", pass.id);

  for (let i = 0; i < batch.rewardsEarned; i++) {
    await createInvitation({ shop, padrinoId: customer.id, locale: customer.locale });
  }

  return {
    status: "ok",
    result: {
      kind: "applied",
      name: firstName(customer.name),
      stamps: after.stamps,
      goal: shop.stamps_goal,
      added: batch.applied,
      rewardsEarned: batch.rewardsEarned,
      redeemed,
      rewardsRemaining: after.rewardsPending,
    },
  };
}
