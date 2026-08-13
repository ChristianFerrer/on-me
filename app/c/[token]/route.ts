import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { CUSTOMER_COOKIE } from "@/lib/session";

const YEAR = 60 * 60 * 24 * 365;

/**
 * Punto de entrada de una tarjeta. Cambia el token de la URL por una cookie
 * httpOnly y manda a `/c`.
 *
 * A partir de aquí el token no vuelve a aparecer en la barra de direcciones:
 * deja de filtrarse por `Referer`, por sincronización de navegador o por una
 * captura de pantalla compartida. La URL larga es la llave de arranque, no
 * la dirección permanente.
 *
 * Se sigue aceptando siempre, así que el enlace guardado en WhatsApp hace un
 * año continúa funcionando en un móvil nuevo.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const { data: customer } = await db()
    .from("customers")
    .select("id")
    .eq("token", token)
    .maybeSingle();

  if (!customer) {
    return NextResponse.redirect(new URL("/c?error=card", request.url));
  }

  const response = NextResponse.redirect(new URL("/c", request.url));
  response.cookies.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: YEAR,
  });

  return response;
}
