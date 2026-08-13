import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDict,
  isLocale,
  negotiateLocale,
  type Dict,
  type Locale,
} from "./index";

/**
 * Resuelve el idioma en servidor, por este orden:
 *   1. cookie `onme_lang` (elección explícita, la fija el middleware con ?lang=)
 *   2. cabecera Accept-Language del navegador
 *   3. español
 *
 * Se resuelve antes de renderizar, así que nunca hay un parpadeo de idioma.
 */
export async function resolveLocale(): Promise<Locale> {
  const jar = await cookies();
  const chosen = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const h = await headers();
  return negotiateLocale(h.get("accept-language")) ?? DEFAULT_LOCALE;
}

/** Atajo para páginas: devuelve idioma y diccionario de una tacada. */
export async function getI18n(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await resolveLocale();
  return { locale, t: getDict(locale) };
}
