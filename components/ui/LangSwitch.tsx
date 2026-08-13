import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n";

/**
 * Conmutador de idioma. Es un enlace normal a `?lang=xx`: el middleware
 * guarda la cookie y limpia la URL, así que funciona sin JavaScript y no
 * ensucia el enlace que el cliente tenga guardado.
 */
export function LangSwitch({
  locale,
  label,
  className,
  tone = "ink",
}: {
  locale: Locale;
  label: string;
  className?: string;
  tone?: "ink" | "paper";
}) {
  const next: Locale = locale === "es" ? "en" : "es";

  return (
    <Link
      href={`?lang=${next}`}
      prefetch={false}
      hrefLang={next}
      className={cn(
        "overline btn-press rounded-full border-2 px-3.5 py-2",
        tone === "ink"
          ? "riso-sm border-ink bg-paper text-ink"
          : "border-paper/40 text-paper/80 hover:border-paper hover:text-paper",
        className,
      )}
    >
      {label}
    </Link>
  );
}
