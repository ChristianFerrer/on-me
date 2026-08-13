import { NextResponse } from "next/server";
import { loadCard } from "@/lib/card";
import { createInvitation } from "@/lib/invitations";
import { env } from "@/lib/env";
import { readCustomerToken } from "@/lib/session";

/**
 * Saca una invitación de las que el cliente tiene pendientes.
 *
 * Normalmente la invitación ya existe: se crea sola al completar tarjeta.
 * Esta ruta cubre el caso en que en ese momento el cupo estaba lleno, para
 * que el derecho no se pierda, solo se aparque.
 */
export async function POST() {
  const token = await readCustomerToken();
  if (!token) return NextResponse.json({ error: "no_card" }, { status: 401 });

  const card = await loadCard(token);
  if (!card) return NextResponse.json({ error: "no_card" }, { status: 401 });

  if (!card.canCreateInvite) {
    return NextResponse.json(
      { error: "quota", active: card.activeInvites.length },
      { status: 409 },
    );
  }

  const invitation = await createInvitation({
    shop: card.shop,
    padrinoId: card.customer.id,
    locale: card.customer.locale,
  });

  if (!invitation) {
    return NextResponse.json({ error: "quota" }, { status: 409 });
  }

  return NextResponse.json({
    code: invitation.code,
    url: `${env.baseUrl}/i/${invitation.code}`,
    expiresAt: invitation.expires_at,
  });
}
