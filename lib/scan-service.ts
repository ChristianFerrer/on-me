import { db } from "@/lib/db/client";
import type { CustomerRow, PassRow, ScanKind } from "@/lib/db/types";
import type { DeviceContext } from "@/lib/auth/device";
import { checkPin } from "@/lib/auth/device";
import { claimedInvitationFor, createInvitation } from "@/lib/invitations";
import {
  applyInvitationRedeem,
  applyRewardRedeem,
  applyStamp,
  decideScan,
  type ScanResponse,
} from "@/lib/scan";

/** Escaneos que cuentan para el antirrebote: los que de verdad mutaron algo. */
const MUTATING: ScanKind[] = ["stamp", "redeem_reward", "redeem_invitation"];

export type ScanTarget = { token: string } | { customerId: string };

export type ScanOptions = {
  confirm?: boolean;
  pin?: string;
  durationMs?: number;
  manual?: boolean;
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
  const now = new Date();

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
  const lastScanAt = await lastMutatingScanAt(customer.id);

  const decision = decideScan({
    now,
    lastScanAt,
    hasClaimedInvitation: invitation !== null,
    rewardPending: pass.reward_pending,
    confirmed: options.confirm,
  });

  if (decision.action === "duplicate") {
    await logScan(ctx, customer.id, "duplicate", options);
    return {
      status: "ok",
      result: { kind: "duplicate", minutesAgo: decision.minutesAgo },
    };
  }

  // ------------------------------------------------------- sello inmediato
  if (decision.action === "stamp") {
    const { pass: next, cardCompleted } = applyStamp(
      {
        stamps: pass.stamps,
        cardsCompleted: pass.cards_completed,
        rewardPending: pass.reward_pending,
      },
      shop.stamps_goal,
    );

    await db()
      .from("passes")
      .update({
        stamps: next.stamps,
        cards_completed: next.cardsCompleted,
        reward_pending: next.rewardPending,
      })
      .eq("id", pass.id);

    await logScan(ctx, customer.id, "stamp", options);

    if (cardCompleted) {
      // La invitación nace al completar tarjeta. Si el padrino ya tiene el
      // cupo lleno, no se crea y no pasa nada: la recuperará más adelante.
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
        // Al cerrar tarjeta el contador vuelve a cero, pero en barra hay que
        // leer "sello 10 de 10", no "sello 0 de 10".
        stamps: cardCompleted ? shop.stamps_goal : next.stamps,
        goal: shop.stamps_goal,
        cardCompleted,
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
      rewardPending: pass.reward_pending,
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
  const next = applyRewardRedeem({
    stamps: pass.stamps,
    cardsCompleted: pass.cards_completed,
    rewardPending: pass.reward_pending,
  });

  await db()
    .from("passes")
    .update({ reward_pending: next.rewardPending })
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

async function findCustomer(target: ScanTarget): Promise<CustomerRow | null> {
  const query = db().from("customers").select("*");
  const { data } =
    "token" in target
      ? await query.eq("token", target.token).maybeSingle()
      : await query.eq("id", target.customerId).maybeSingle();

  return data ?? null;
}

/** Todo cliente tiene pase; si faltara por una alta a medias, se crea. */
async function ensurePass(customerId: string): Promise<PassRow> {
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

async function lastMutatingScanAt(customerId: string): Promise<Date | null> {
  const { data } = await db()
    .from("scans")
    .select("created_at")
    .eq("customer_id", customerId)
    .in("kind", MUTATING)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? new Date(data.created_at) : null;
}

async function logScan(
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
