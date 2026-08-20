"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChartIcon,
  OrbitIcon,
  PulseIcon,
  TabletIcon,
} from "@/components/ui/Icons";
import { Logo, Mark } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];
export type AdminSection = "constelacion" | "metricas" | "dispositivos" | "atribuciones";

/** Ancho del sidebar de escritorio: el resto de las páginas del panel reservan este mismo hueco. */
export const ADMIN_SIDEBAR_WIDTH = "16rem";
/** Ancho del sidebar plegado -solo iconos-, disponible en las pantallas que pasan `collapsible`. */
export const ADMIN_SIDEBAR_WIDTH_COLLAPSED = "4.75rem";
/** Variable CSS con el ancho real del sidebar en este momento -16rem salvo que esta página lo haya plegado-: las pantallas a medida (los mapas de constelación) la leen para no dejar un hueco vacío o quedar tapadas cuando el sidebar se pliega. */
const SIDEBAR_WIDTH_VAR = "--admin-sidebar-width";

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
 *
 * `collapsible` -apagado por defecto- añade un botón para plegar el sidebar
 * a solo iconos: pensado para las pantallas a pantalla completa (los mapas
 * de constelación), donde el lienzo agradece cada centímetro. El resto del
 * panel no lo pasa, así que se queda igual que siempre.
 */
export function BottomNav({
  t,
  active,
  collapsible = false,
}: {
  t: AdminDict;
  active?: AdminSection;
  collapsible?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isCollapsed = collapsible && collapsed;

  useEffect(() => {
    const width = isCollapsed ? ADMIN_SIDEBAR_WIDTH_COLLAPSED : ADMIN_SIDEBAR_WIDTH;
    document.documentElement.style.setProperty(SIDEBAR_WIDTH_VAR, width);
    return () => {
      document.documentElement.style.removeProperty(SIDEBAR_WIDTH_VAR);
    };
  }, [isCollapsed]);

  const items: { key: AdminSection; href: string; label: string; icon: React.ReactNode }[] = [
    { key: "constelacion", href: "/admin/constelacion-sol", label: t.referralMap, icon: <OrbitIcon className="size-5" /> },
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
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-black lg:hidden">
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
        style={{ width: isCollapsed ? ADMIN_SIDEBAR_WIDTH_COLLAPSED : ADMIN_SIDEBAR_WIDTH }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col gap-1 rounded-none border-y-0 border-l-0 border-r border-white/10 bg-black p-4 transition-[width] duration-200 ease-[var(--ease-out-soft)] lg:flex",
          isCollapsed && "items-center px-2",
        )}
      >
        {collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-pressed={isCollapsed}
            aria-label={isCollapsed ? t.constelacionExpandSidebar : t.constelacionCollapseSidebar}
            className="btn glass-dark absolute -right-3 top-6 size-6 shrink-0 text-chalk/60 hover:text-chalk"
          >
            {isCollapsed ? <ArrowRightIcon className="size-3.5" /> : <ArrowLeftIcon className="size-3.5" />}
          </button>
        ) : null}

        <Link href="/inicio" prefetch={false} className={cn("pb-6 pt-2", isCollapsed ? "px-0" : "px-2")}>
          {isCollapsed ? <Mark className="size-3.5" /> : <Logo tone="chalk" />}
        </Link>
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            prefetch={false}
            title={isCollapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl py-2.5 text-[0.875rem] font-semibold transition-colors",
              isCollapsed ? "justify-center px-2.5" : "px-3",
              active === item.key
                ? "bg-lime/12 text-lime"
                : "text-chalk/55 hover:bg-white/6 hover:text-chalk",
            )}
          >
            {item.icon}
            {isCollapsed ? null : item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
