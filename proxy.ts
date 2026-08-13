import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";

const YEAR = 60 * 60 * 24 * 365;

/**
 * Único cometido: convertir `?lang=en` en una cookie y limpiar la URL.
 *
 * El idioma no vive en la ruta a propósito. Las URLs de OnMe son objetos
 * físicos —un QR pegado en la barra, un enlace de WhatsApp que alguien
 * guarda un año— y tienen que ser cortas y estables. Un prefijo de idioma
 * duplicaría la identidad de cada tarjeta.
 */
export default function proxy(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang");
  if (!isLocale(lang)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.searchParams.delete("lang");

  const response = NextResponse.redirect(url);
  response.cookies.set(LOCALE_COOKIE, lang, {
    path: "/",
    maxAge: YEAR,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest).*)"],
};
