import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";

/**
 * Barra superior: una pastilla de grafito flotando sobre el degradado.
 *
 * Es lo único fijo del producto. No es navegación —OnMe no tiene a dónde
 * navegar— sino identidad, que es todo lo que necesita alguien que acaba de
 * escanear un QR en una barra. El idioma ya no se elige aquí: se detecta
 * solo, del navegador.
 */
export function TopBar({
  back,
  backLabel,
  className,
}: {
  /** Ruta de vuelta. Sustituye al logotipo cuando existe. */
  back?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "glass-dark flex items-center gap-3 rounded-full py-2.5 px-5",
        className,
      )}
    >
      {back ? (
        <Link
          href={back}
          prefetch={false}
          className="flex items-center gap-2 text-[0.9375rem] font-medium text-chalk/70 transition-colors hover:text-chalk"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          {backLabel}
        </Link>
      ) : (
        <Logo size="sm" tone="chalk" />
      )}
    </header>
  );
}
