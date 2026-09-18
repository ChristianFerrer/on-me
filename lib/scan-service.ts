import { db } from "@/lib/db/client";
import type { CustomerRow, PassRow, ScanKind } from "@/lib/db/types";
import type { DeviceContext } from "@/lib/auth/device";
import { checkPin } from "@/lib/auth/device";
import { claimedInvitationFor, createInvitation } from "@/lib/invitations";
import {
  applyInvitationRedeem,
  applyRewardRedeem,
  applyStampBatch,
  decideScan,
  type ScanResponse,
} from "@/lib/scan";

export type ScanTarget = { token: string } | { customerId: string };

export type ScanOptions = {
  confirm?: boolean;
  pin?: string;
  durationMs?: number;
  manual?: boolean;
  /** Cafés a sellar de una vez -por defecto 1-, ver el selector en Scanner.tsx. */
  quantity?: number;
};

export type ScanOutcome =
  | { status: "ok"; result: ScanResponse }
  | { status: "pin_required" }
  | { status: "pin_wrong" };

/**
 * Orquesta un escaneo de barra: resuelve al cliente, pide la decisión a la
 * lógica pura y aplica los efectos.
 *
 * Lo que NO hace: decidir. Eso vive en `lib/scan.ts` y se testea aparte.
 */
export async function runScan(
  ctx: DeviceContext,
  target: ScanTarget,
  options: ScanOptions = {},
): Promise<ScanOutcome> {
  const { shop, device } = ctx;

  const customer = await findCustomer(target);

  if (!customer) {
    await logScan(ctx, null, "invalid", options);
    return { status: "ok", result: { kind: "invalid", reason: "unknown_token" } };
  }

  if (customer.shop_id !== shop.id) {
    // Un cliente de otro local: su tarjeta no vale aquí. Se registra igual,
    // porque saber cuánto pasa esto es señal operativa.
    await logScan(ctx, null, "invalid", options);
    return { status: "ok", result: { kind: "invalid", reason: "other_shop" } };
  }

  const pass = await ensurePass(customer.id);
  const invitation = await claimedInvitationFor(customer.id);

  const decision = decideScan({
    hasClaimedInvitation: invitation !== null,
    rewardPending: pass.reward_pending_count > 0,
  });

  // ------------------------------------------------------- sello inmediato
  if (decision.action === "stamp") {
    // Normalmente 1; el selector de cantidad en Scanner.tsx manda más
    // cuando piden varios cafés de una vez. `applyStampBatch` no se para si
    // alguno completa la tarjeta: quien pide 4 cafés con 8 ya puestos se
    // lleva el premio de los 2 que la completan y los 2 que sobran arrancan
    // la tarjeta siguiente, en la misma pasada -nadie vuelve a la barra
    // solo para que le sigan sellando lo que ya pagó-.
    const requested = Math.max(1, Math.floor(options.quantity ?? 1));
    const batch = applyStampBatch(
      {
        stamps: pass.stamps,
        cardsCompleted: pass.cards_completed,
        rewardsPending: pass.reward_pending_count,
      },
      shop.stamps_goal,
      requested,
    );

    // El tiempo de cámara a resultado es de un solo gesto: lo lleva solo
    // el primer sello de la tanda. Los siguientes salen del mismo escaneo,
    // sin abrir cámara de nuevo, así que no tienen un tiempo propio que
    // sumar al promedio de `ops.scanTime`.
    for (let i = 0; i < batch.applied; i++) {
      await logScan(ctx, customer.id, "stamp", i === 0 ? options : { ...options, durationMs: undefined });
    }

    await db()
      .from("passes")
      .update({
        stamps: batch.pass.stamps,
        cards_completed: batch.pass.cardsCompleted,
        reward_pending_count: batch.pass.rewardsPending,
      })
      .eq("id", pass.id);

    // Una invitación por cada tarjeta completada en la tanda -normalmente
    // una sola vuelta, pero nada impide que una meta pequeña se complete
    // más de una vez de golpe-. Si el padrino ya tiene el cupo lleno
    // alguna se queda sin crear, y no pasa nada: la recuperará más adelante.
    for (let i = 0; i < batch.rewardsEarned; i++) {
      await createInvitation({
        shop,
        padrinoId: customer.id,
        locale: customer.locale,
      });
    }

    return {
      status: "ok",
      result: {
        kind: "stamp",
        name: firstName(customer.name),
        stamps: batch.pass.stamps,
        goal: shop.stamps_goal,
        rewardsEarned: batch.rewardsEarned,
        added: batch.applied,
      },
    };
  }

  // ------------------------------- acciones que regalan producto: confirmar
  if (!options.confirm) {
    if (decision.action === "redeem_invitation" && invitation) {
      const padrino = await padrinoName(invitation.padrino_id);
      return {
        status: "ok",
        result: {
          kind: "redeem_invitation",
          name: firstName(customer.name),
          padrino,
          pending: true,
        },
      };
    }

    return {
      status: "ok",
      result: {
        kind: "redeem_reward",
        name: firstName(customer.name),
        pending: true,
      },
    };
  }

  if (!checkPin(device, options.pin)) {
    return { status: options.pin ? "pin_wrong" : "pin_required" };
  }

  // --------------------------------------------------- canje de invitación
  if (decision.action === "redeem_invitation" && invitation) {
    const scanId = await logScan(ctx, customer.id, "redeem_invitation", options);
    const redeemedAt = new Date().toISOString();

    await db()
      .from("invitations")
      .update({ state: "redeemed", redeemed_at: redeemedAt })
      .eq("id", invitation.id);

    if (scanId) {
      // La atribución nace aquí, en estado 'window'. No factura todavía: un
      // canje solo prueba que alguien vino a por algo gratis.
      await db().from("attributions").insert({
        shop_id: shop.id,
        invitation_id: invitation.id,
        padrino_id: invitation.padrino_id,
        ahijado_id: customer.id,
        redeemed_at: redeemedAt,
        redeem_scan_id: scanId,
        state: "window",
      });
    }

    const next = applyInvitationRedeem({
      stamps: pass.stamps,
      cardsCompleted: pass.cards_completed,
      rewardsPending: pass.reward_pending_count,
    });
    await db().from("passes").update({ stamps: next.stamps }).eq("id", pass.id);

    return {
      status: "ok",
      result: {
        kind: "redeem_invitation",
        name: firstName(customer.name),
        padrino: await padrinoName(invitation.padrino_id),
        pending: false,
      },
    };
  }

  // ------------------------------------------------------ canje del premio
  // Este flujo canjea de uno en uno -si hubiera más de un café gratis
  // acumulado, decideScan lo volverá a pedir en el próximo escaneo-. El
  // flujo identificador es el que deja elegir cuántos de golpe.
  const next = applyRewardRedeem({
    stamps: pass.stamps,
    cardsCompleted: pass.cards_completed,
    rewardsPending: pass.reward_pending_count,
  });

  await db()
    .from("passes")
    .update({ reward_pending_count: next.rewardsPending })
    .eq("id", pass.id);

  await logScan(ctx, customer.id, "redeem_reward", options);

  return {
    status: "ok",
    result: {
      kind: "redeem_reward",
      name: firstName(customer.name),
      pending: false,
    },
  };
}

// ----------------------------------------------------------------- helpers
//
// findCustomer/ensurePass/logScan se exportan porque lib/identify-service.ts
// -el flujo identificador, ver Scanner.tsx/IdentifyScanner.tsx- necesita
// exactamente las mismas consultas: resolver al cliente, garantizar su pase
// y dejar rastro en `scans`. Duplicarlas ahí sería la misma query dos veces.

export async function findCustomer(target: ScanTarget): Promise<CustomerRow | null> {
  const query = db().from("customers").select("*");
  const { data } =
    "token" in target
      ? await query.eq("token", target.token).maybeSingle()
      : await query.eq("id", target.customerId).maybeSingle();

  return data ?? null;
}

/** Todo cliente tiene pase; si faltara por una alta a medias, se crea. */
export async function ensurePass(customerId: string): Promise<PassRow> {
  const { data } = await db()
    .from("passes")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (data) return data;

  const { data: created, error } = await db()
    .from("passes")
    .insert({ customer_id: customerId })
    .select("*")
    .single();

  if (error || !created) throw new Error("No se ha podido crear el pase");
  return created;
}

export async function logScan(
  ctx: DeviceContext,
  customerId: string | null,
  kind: ScanKind,
  options: ScanOptions,
): Promise<string | null> {
  const { data } = await db()
    .from("scans")
    .insert({
      shop_id: ctx.shop.id,
      device_id: ctx.device.id,
      customer_id: customerId,
      kind,
      manual: options.manual ?? false,
      duration_ms: options.durationMs ?? null,
    })
    .select("id")
    .single();

  return data?.id ?? null;
}

async function padrinoName(padrinoId: string): Promise<string> {
  const { data } = await db()
    .from("customers")
    .select("name")
    .eq("id", padrinoId)
    .maybeSingle();

  return data ? firstName(data.name) : "—";
}

/**
 * En barra se lee un nombre, no un nombre completo. Y nunca se enseña a un
 * cliente el apellido de otro: el padrino ve "tu invitado volvió", nada más.
 */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
