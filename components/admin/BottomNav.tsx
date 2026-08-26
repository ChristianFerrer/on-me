"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChartIcon,
  ChevronDownIcon,
  HomeIcon,
  OrbitIcon,
  PulseIcon,
  TabletIcon,
} from "@/components/ui/Icons";
import { Logo, Mark } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];
export type AdminSection = "constelacion" | "metricas" | "dispositivos" | "atribuciones";

/** Ancho del sidebar de escritorio desplegado. */
export const ADMIN_SIDEBAR_WIDTH = "16rem";
/** Ancho del sidebar de escritorio plegado -solo iconos-, su estado por defecto. */
export const ADMIN_SIDEBAR_WIDTH_COLLAPSED = "4.75rem";
/** Variable CSS con el ancho real del sidebar en este momento: todas las páginas del panel la leen para su propio padding izquierdo, así que se ajustan solas al plegar/desplegar sin que cada una tenga que enterarse del estado por su cuenta. */
const SIDEBAR_WIDTH_VAR = "--admin-sidebar-width";

/**
 * Navegación fija del panel: cuatro páginas de verdad, no anclas — cada una
 * hace su propia comprobación de sesión, así que basta con enlazar a la
 * ruta y dejar que la propia página decida si hay que enseñar el login.
 *
 * En móvil sigue siendo una barra inferior tipo pestañas de app -el pulgar
 * manda-; a partir de `md` (768px, tablet vertical incluida -el uso
 * habitual de este rol-) se convierte en un sidebar fijo a la izquierda
 * con el logo arriba, porque en una pantalla ancha una barra inferior
 * angosta desperdicia el resto del espacio y un menú lateral es el patrón
 * esperado de cualquier panel de escritorio. Es el mismo componente, dos
 * marcados -uno oculto en cada breakpoint-, no dos componentes separados:
 * así ambos comparten la lista de items y no pueden desincronizarse.
 *
 * El sidebar de escritorio arranca plegado a solo iconos -mismo criterio
 * en las cuatro pantallas del panel, nunca una empieza distinta de las
 * demás- y un botón lo despliega a la versión con etiquetas cuando hace
 * falta. Plegado por defecto porque es el mismo panel de un piloto de un
 * solo local: la lista de cuatro secciones se reconoce por icono casi de
 * inmediato, y el ancho que se ahorra es ancho real para el contenido de
 * cada pantalla.
 */
export function BottomNav({
  t,
  active,
}: {
  t: AdminDict;
  active?: AdminSection;
}) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const width = collapsed ? ADMIN_SIDEBAR_WIDTH_COLLAPSED : ADMIN_SIDEBAR_WIDTH;
    document.documentElement.style.setProperty(SIDEBAR_WIDTH_VAR, width);
    return () => {
      document.documentElement.style.removeProperty(SIDEBAR_WIDTH_VAR);
    };
  }, [collapsed]);

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
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-black md:hidden">
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
        style={{ width: collapsed ? ADMIN_SIDEBAR_WIDTH_COLLAPSED : ADMIN_SIDEBAR_WIDTH }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col gap-1 rounded-none border-y-0 border-l-0 border-r border-white/10 bg-black p-4 transition-[width] duration-200 ease-[var(--ease-out-soft)] md:flex",
          collapsed && "items-center px-2",
        )}
      >
        <Link href="/inicio" prefetch={false} className={cn("pb-6 pt-2", collapsed ? "px-0" : "px-2")}>
          {collapsed ? <Mark className="size-3.5" /> : <Logo tone="chalk" />}
        </Link>
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            prefetch={false}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl py-2.5 text-[0.875rem] font-semibold transition-colors",
              collapsed ? "justify-center px-2.5" : "px-3",
              active === item.key
                ? "bg-lime/12 text-lime"
                : "text-chalk/55 hover:bg-white/6 hover:text-chalk",
            )}
          >
            {item.icon}
            {collapsed ? null : item.label}
          </Link>
        ))}

        {/* Plegar/desplegar: abajo del todo -no junto al logo, arriba- y con
            una flecha tipo chevron -el mismo ChevronDownIcon que ya usa el
            interruptor de controles de la vista sol, rotado- en vez de las
            flechas rectas de antes: "<" mientras el sidebar está desplegado
            -empuja hacia la izquierda para plegarlo-, ">" cuando ya está
            plegado -empuja hacia la derecha para desplegarlo de nuevo-.
            `right-3`, no `-right-3`: el negativo lo sacaba medio botón fuera
            del propio borde derecho del sidebar, asomando sobre el lienzo
            de al lado -parecía un control ajeno al panel, no parte de él-.
            Dentro del propio recuadro, pegado a su borde, se lee como lo
            que es: un control del sidebar, no un botón suelto encima del
            mapa. */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-pressed={collapsed}
          aria-label={collapsed ? t.constelacionExpandSidebar : t.constelacionCollapseSidebar}
          className="btn glass-dark absolute right-3 bottom-6 size-6 shrink-0 text-chalk/60 hover:text-chalk"
        >
          <ChevronDownIcon className={cn("size-3.5 transition-transform duration-200 ease-[var(--ease-out-soft)]", collapsed ? "-rotate-90" : "rotate-90")} />
        </button>
      </nav>
    </>
  );
}
