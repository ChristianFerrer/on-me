import Link from "next/link";
import { cn } from "@/lib/cn";
import { LOCALES, type Locale } from "@/lib/i18n";

/**
 * Conmutador de idioma: dos pastillas, la activa rellena.
 *
 * Son enlaces normales a `?lang=xx`; el proxy guarda la cookie y limpia la
 * URL, así que funciona sin JavaScript y no ensucia el enlace que el cliente
 * tenga guardado.
 */
export function LangSwitch({
  locale,
  tone = "ink",
  className,
}: {
  locale: Locale;
  tone?: "ink" | "chalk";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {LOCALES.map((code) => {
        const active = code === locale;

        return (
          <Link
            key={code}
            href={`?lang=${code}`}
            prefetch={false}
            hrefLang={code}
            aria-current={active ? "true" : undefined}
            className={cn(
              "eyebrow flex size-10 items-center justify-center rounded-full transition-colors",
              active
                ? tone === "ink"
                  ? "bg-ink text-chalk"
                  : "bg-chalk text-ink"
                : tone === "ink"
                  ? "text-ink/50 hover:bg-[rgba(12,18,16,0.07)]"
                  : "text-chalk/45 hover:bg-[rgba(255,255,255,0.08)]",
            )}
          >
            {code}
          </Link>
        );
      })}
    </div>
  );
}
