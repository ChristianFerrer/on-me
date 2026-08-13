import Link from "next/link";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n";

/**
 * Barra superior: una pastilla de grafito flotando sobre el degradado.
 *
 * Es lo único fijo del producto. No es navegación —OnMe no tiene a dónde
 * navegar— sino identidad e idioma, que es todo lo que necesita alguien que
 * acaba de escanear un QR en una barra.
 */
export function TopBar({
  locale,
  back,
  backLabel,
  className,
}: {
  locale: Locale;
  /** Ruta de vuelta. Sustituye al logotipo cuando existe. */
  back?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 rounded-full bg-ink py-2.5 pl-5 pr-2.5",
        className,
      )}
    >
      {back ? (
        <Link
          href={back}
          prefetch={false}
          className="flex items-center gap-2 text-[0.9375rem] font-medium text-chalk/70 transition-colors hover:text-chalk"
        >
          <span aria-hidden>←</span>
          {backLabel}
        </Link>
      ) : (
        <Logo size="sm" tone="chalk" />
      )}

      <LangSwitch locale={locale} tone="chalk" />
    </header>
  );
}
