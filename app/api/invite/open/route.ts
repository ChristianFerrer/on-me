import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { normalizeInviteCode } from "@/lib/crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({ code: z.string().trim().min(4).max(12) });

/**
 * Marca que un humano ha abierto la invitación.
 *
 * Va por POST desde el navegador y no en el render de la landing a propósito:
 * WhatsApp descarga el enlace para generar la vista previa, así que hacerlo
 * en el GET contaría como "abierta" cada mensaje enviado e inflaría la
 * métrica justo entre las puertas P1 y P2.
 */
export async function POST(request: Request) {
  // Mismo motivo que en la landing: sin contador se puede sondear códigos.
  const limit = rateLimit(`invite-open:${clientIp(request.headers)}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const code = normalizeInviteCode(parsed.data.code);

  // Solo la primera vez: `opened_at` es el primer contacto, no el último.
  await db()
    .from("invitations")
    .update({ state: "opened", opened_at: new Date().toISOString() })
    .eq("code", code)
    .in("state", ["created", "sent"])
    .is("opened_at", null);

  return new NextResponse(null, { status: 204 });
}
