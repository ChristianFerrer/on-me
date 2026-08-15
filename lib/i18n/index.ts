import { dictionaries, type Dict } from "./dictionaries";

export const LOCALES = ["es", "en"] as const;
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
 * Cualquier cosa que no sea inglés cae en español: el piloto es en Barcelona.
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
    if (base === "en") return "en";
    if (base === "es") return "es";
  }
  return DEFAULT_LOCALE;
}

/** Formatea una fecha corta en el idioma activo, sin cargar librerías. */
export function formatDate(date: Date | string, locale: Locale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(d);
}

export function formatDateTime(date: Date | string, locale: Locale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(d);
}

/**
 * Ordinal corto para la etiqueta de cada anillo del mapa de saltos: "1er
 * salto", "2º salto"... En español el apócope ("1er", "3er") solo aplica
 * antes de un sustantivo masculino singular como "salto"; en inglés basta
 * la regla estándar 1st/2nd/3rd/nth con la excepción de 11-13.
 */
export function ordinalHop(n: number, locale: Locale): string {
  if (locale === "es") {
    if (n === 1) return "1er";
    if (n === 3) return "3er";
    return `${n}º`;
  }
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

export type { Dict };
