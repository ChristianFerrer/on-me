import Link from "next/link";
import {
  ChartIcon,
  OrbitIcon,
  PulseIcon,
  TabletIcon,
} from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];
export type AdminSection = "constelacion" | "metricas" | "dispositivos" | "atribuciones";

/** Ancho del sidebar de escritorio: el resto de las páginas del panel reservan este mismo hueco. */
export const ADMIN_SIDEBAR_WIDTH = "16rem";

/**
 * Navegación fija del panel: cuatro páginas de verdad, no anclas — cada una
 * hace su propia comprobación de sesión, así que basta con enlazar a la
 * ruta y dejar que la propia página decida si hay que enseñar el login.
 *
 * En móvil sigue siendo una barra inferior tipo pestañas de app -el pulgar
 * manda-; a partir de `lg` se convierte en un sidebar fijo a la izquierda
 * con el logo arriba, porque en una pantalla ancha una barra inferior
 * angosta desperdicia el resto del espacio y un menú lateral es el patrón
 * esperado de cualquier panel de escritorio. Es el mismo componente, dos
 * marcados -uno oculto en cada breakpoint-, no dos componentes separados:
 * así ambos comparten la lista de items y no pueden desincronizarse.
 */
export function BottomNav({ t, active }: { t: AdminDict; active?: AdminSection }) {
  const items: { key: AdminSection; href: string; label: string; icon: React.ReactNode }[] = [
    { key: "constelacion", href: "/admin", label: t.referralMap, icon: <OrbitIcon className="size-5" /> },
    { key: "metricas", href: "/admin/metricas", label: t.navMetrics, icon: <PulseIcon className="size-5" /> },
    {
      key: "dispositivos",
      href: "/admin/dispositivos",
      label: t.devices,
      icon: <TabletIcon className="size-5" />,
    },
    {
      key: "atribuciones",
      href: "/admin/atribuciones",
      label: t.attributions,
      icon: <ChartIcon className="size-5" />,
    },
  ];

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-ink/95 backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex w-full max-w-[30rem] items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)] sm:max-w-[34rem] lg:max-w-[38rem]">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2.5 transition-colors",
                active === item.key ? "text-lime" : "text-chalk/45 hover:text-chalk/70",
              )}
            >
              {item.icon}
              <span className="w-full truncate text-center text-[0.625rem] font-semibold leading-none">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      <nav
        style={{ width: ADMIN_SIDEBAR_WIDTH }}
        className="glass-dark fixed inset-y-0 left-0 z-40 hidden flex-col gap-1 rounded-none border-y-0 border-l-0 p-4 lg:flex"
      >
        <Link href="/inicio" prefetch={false} className="px-2 pb-6 pt-2">
          <Logo tone="chalk" />
        </Link>
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            prefetch={false}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-semibold transition-colors",
              active === item.key
                ? "bg-lime/12 text-lime"
                : "text-chalk/55 hover:bg-white/6 hover:text-chalk",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
