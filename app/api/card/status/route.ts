import { NextResponse } from "next/server";
import { loadCard } from "@/lib/card";
import { readCustomerToken } from "@/lib/session";

/**
 * Lo que CardLive.tsx sondea para que la tarjeta se actualice sola -sin
 * refrescar- cuando el barista sella o canjea mientras el cliente tiene la
 * pantalla abierta.
 *
 * Deliberadamente no es Realtime de Supabase: todas las tablas tienen RLS
 * activo sin ninguna política -deny-all a propósito, ver lib/db/client.ts-,
 * y el cliente no tiene sesión de Supabase Auth con la que motivar una
 * política nueva, solo esta cookie propia. Habilitarlo exigiría o saltarse
 * ese modelo de seguridad, o construir un subsistema de auth aparte solo
 * para esto. Sondear por aquí, en cambio, es el mismo patrón que ya usa
 * todo lo demás: el navegador solo habla con `/api/*`, nunca con Supabase.
 *
 * Sin `stamps_goal` ni las invitaciones en sí: eso no cambia sin que el
 * cliente navegue -y si cambia, una recarga real ya lo trae-, así que el
 * payload se queda en lo que de verdad puede moverse solo mientras mira la
 * pantalla.
 */
export async function GET() {
  const token = await readCustomerToken();
  if (!token) return NextResponse.json({ error: "no_card" }, { status: 401 });

  const card = await loadCard(token);
  if (!card) return NextResponse.json({ error: "no_card" }, { status: 401 });

  return NextResponse.json({
    stamps: card.stamps,
    rewardPending: card.rewardPending,
    cardsCompleted: card.cardsCompleted,
    inviteCount: card.activeInvites.length + card.pendingGrants,
    returnedGuests: card.returnedGuests,
    hasInvited: card.invitesSentCount > 0,
  });
}
