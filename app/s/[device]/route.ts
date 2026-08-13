import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { hashWithSalt, newSessionToken } from "@/lib/crypto";
import { DEVICE_COOKIE } from "@/lib/session";
import { env } from "@/lib/env";

const NINETY_DAYS = 60 * 60 * 24 * 90;

/**
 * Alta de un dispositivo de barra. Se abre UNA vez en la vida del iPad.
 *
 * Canjea el device token —el secreto más valioso del sistema, porque acuña
 * sellos— por una sesión larga en cookie httpOnly, y deja la URL limpia. A
 * partir de aquí el barista vive en `/s` y el token no vuelve a aparecer en
 * la barra de direcciones de un dispositivo compartido.
 *
 * Es un Route Handler y no una página porque en Next solo aquí y en las
 * Server Actions se pueden escribir cookies.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ device: string }> },
) {
  const { device: token } = await params;

  const { data: device } = await db()
    .from("devices")
    .select("id, active")
    .eq("token", token)
    .maybeSingle();

  if (!device || !device.active) {
    return NextResponse.redirect(new URL("/s?error=device", request.url));
  }

  const sessionToken = newSessionToken();

  const { error } = await db().from("device_sessions").insert({
    device_id: device.id,
    token_hash: hashWithSalt(sessionToken),
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  });

  if (error) {
    return NextResponse.redirect(new URL("/s?error=session", request.url));
  }

  const response = NextResponse.redirect(new URL("/s", request.url));
  response.cookies.set(DEVICE_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: NINETY_DAYS,
  });

  return response;
}
