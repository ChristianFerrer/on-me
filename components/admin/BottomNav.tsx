"use client";

import Link from "next/link";
import {
  ChartIcon,
  HomeIcon,
  OrbitIcon,
  PulseIcon,
  TabletIcon,
} from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];
export type AdminSection = "constelacion" | "metricas" | "dispositivos" | "atribuciones";

/** Ancho del sidebar de escritorio -fijo, ver también el valor estático en globals.css-. */
export const ADMIN_SIDEBAR_WIDTH = "16rem";

/**
 * Navegación fija del panel: cuatro páginas de verdad, no anclas — cada una
 * hace su propia comprobación de sesión, así que basta con enlazar a la
 * ruta y dejar que la propia página decida si hay que enseñar el login.
 *
 * En móvil -y tablet vertical, hasta 1000px- sigue siendo una barra
 * inferior tipo pestañas de app -el pulgar manda-; a partir de 1000px se
 * convierte en un sidebar fijo a la izquierda con el logo arriba y
 * etiquetas de texto siempre visibles, sin plegar: a esa anchura ya sobra
 * sitio para el texto, y un sidebar que cambia de ancho según se pliega o
 * no añade una transición que no aporta nada en un panel de un solo local
 * de cuatro secciones. Es el mismo componente, dos marcados -uno oculto en
 * cada punto de quiebre-, no dos componentes separados: así ambos
 * comparten la lista de items y no pueden desincronizarse.
 */
export function BottomNav({
  t,
  active,
}: {
  t: AdminDict;
  active?: AdminSection;
}) {
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
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-black nav:hidden">
        <div className="mx-auto flex w-full max-w-[30rem] items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)] sm:max-w-[34rem] lg:max-w-[38rem]">
          {/* En escritorio el logo del sidebar ya hace de enlace a /inicio -ver
              más abajo-; en móvil no había forma de volver al portal salvo
              con el botón que cada pantalla llevaba por su cuenta en su
              propia cabecera. Se muda aquí, a la propia barra, para que las
              cuatro pantallas del panel lo compartan en vez de reinventarlo
              cada una -nunca "activo": /inicio no es ninguna de las cuatro
              secciones del panel. */}
          <Link
            href="/inicio"
            prefetch={false}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2.5 text-chalk/45 transition-colors hover:text-chalk/70"
          >
            <HomeIcon className="size-5" />
            <span className="w-full truncate text-center text-[0.625rem] font-semibold leading-none">{t.navHome}</span>
          </Link>
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
        className="fixed inset-y-0 left-0 z-40 hidden flex-col gap-1 rounded-none border-y-0 border-l-0 border-r border-white/10 bg-black p-4 nav:flex"
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
