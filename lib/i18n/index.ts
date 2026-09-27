import { dictionaries, type Dict } from "./dictionaries";

export const LOCALES = ["es", "en", "fr", "de"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "onme_lang";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getDict(locale: Locale): Dict {
  return dictionaries[locale];
}

/**
 * Interpolación mínima: `fill("sello {n} de {goal}", { n: 5, goal: 10 })`.
 * Deliberadamente sin librería — es una sustitución de llaves, no i18n con
 * plurales ICU. Cuando haga falta pluralizar, están `plural()` y las claves
 * explícitas del diccionario (`oneToGo` / `nToGo`).
 */
export function fill(
  template: string,
  vars: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** Elige entre la forma singular y la plural, que en ambos idiomas basta. */
export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Negocia el idioma a partir de la cabecera del navegador.
 * Cualquier idioma sin diccionario propio cae en español: el piloto es en Barcelona.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.split("=")[1]) : 1;
      return { tag: tag.trim().toLowerCase(), quality: Number.isNaN(quality) ? 0 : quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

const INTL_LOCALE: Record<Locale, string> = {
  es: "es-ES",
  en: "en-GB",
  fr: "fr-FR",
  de: "de-DE",
};

/** Formatea una fecha corta en el idioma activo, sin cargar librerías. */
export function formatDate(date: Date | string, locale: Locale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(d);
}

/** "julio 2026": para "cliente desde", donde el día exacto no aporta nada. */
export function formatMonthYear(date: Date | string, locale: Locale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(d);
}

/**
 * "hace 3 días" / "ahora": para la última transacción del panel de barra.
 * Menos de 30 segundos se trata como "ahora" a mano -`Intl.RelativeTimeFormat`
 * no tiene una unidad "instante", y "hace 0 segundos" lee peor que el texto
 * fijo que ya trae cada diccionario en `justNowLabel`-.
 */
export function formatRelativeTime(
  date: Date | string,
  locale: Locale,
  justNowLabel: string,
  now: Date = new Date(),
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  if (Math.abs(diffSec) < 30) return justNowLabel;

  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" });
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");
  return rtf.format(Math.round(diffMonth / 12), "year");
}

export function formatDateTime(date: Date | string, locale: Locale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(d);
}

export type { Dict };
