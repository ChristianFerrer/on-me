import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { normalizeInviteCode } from "@/lib/crypto";
import { readCustomerToken } from "@/lib/session";

const Body = z.object({ code: z.string().trim().min(4).max(12) });

/**
 * Se llama al pulsar "enviar por WhatsApp".
 *
 * Marca el paso de `created` a `sent`, que es el numerador de la puerta P1
 * —la que mide si la gente de verdad quiere invitar—. Por eso se registra
 * cuando el cliente pulsa, no cuando se genera el código: generar es nuestro,
 * enviar es suyo.
 */
export async function POST(request: Request) {
  const token = await readCustomerToken();
  if (!token) return new NextResponse(null, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const { data: customer } = await db()
    .from("customers")
    .select("id")
    .eq("token", token)
    .maybeSingle();

  if (!customer) return new NextResponse(null, { status: 401 });

  // Solo el padrino puede marcar su propia invitación como enviada.
  await db()
    .from("invitations")
    .update({ state: "sent", sent_at: new Date().toISOString() })
    .eq("code", normalizeInviteCode(parsed.data.code))
    .eq("padrino_id", customer.id)
    .eq("state", "created");

  return new NextResponse(null, { status: 204 });
}
