"use client";

import Link from "next/link";
import {
  ChartIcon,
  HomeIcon,
  LogOutIcon,
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
 *
 * Los enlaces llevan el `prefetch` por defecto de `Link` a propósito -antes
 * iba a `false` en todos, sin ninguna razón escrita en ningún sitio-: son
 * cinco pantallas estables, sin token de un solo uso que un prefetch
 * pudiera gastar de más, así que no hay motivo para pagar el viaje entero
 * a Supabase justo al pulsar en vez de mientras el dedo -o el ratón- ya
 * está encima del enlace.
 */
async function signOut() {
  await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
  // Recarga entera, no `router.push` -mismo patrón que LoginForm.tsx tras
  // entrar-: con la cookie ya borrada, volver a pedir la página actual de
  // cero basta -cada una de las cinco comprueba sesión en el propio
  // servidor y manda sola al login si no la encuentra-, sin necesidad de
  // fijar aquí a qué ruta exacta debe volver cada una.
  window.location.reload();
}

export function BottomNav({
  t,
  active,
  email,
}: {
  t: AdminDict;
  active?: AdminSection;
  /** Cuenta con la que se ha entrado -ver getAdminContext-, para que quede claro cuál es antes de tocar "cerrar sesión". */
  email?: string;
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
        {email ? (
          <div className="mx-auto flex w-full max-w-[30rem] items-center justify-between gap-2 border-b border-white/8 px-4 py-1 sm:max-w-[34rem] lg:max-w-[38rem]">
            <span className="truncate text-[0.625rem] text-chalk/40">{email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex shrink-0 items-center gap-1 text-[0.625rem] font-semibold text-chalk/55 transition-colors hover:text-chalk"
            >
              <LogOutIcon className="size-3" />
              {t.signOut}
            </button>
          </div>
        ) : null}
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
            className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2.5 text-chalk/45 transition-colors hover:text-chalk/70"
          >
            <HomeIcon className="size-5" />
            <span className="w-full truncate text-center text-[0.625rem] font-semibold leading-none">{t.navHome}</span>
          </Link>
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
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
        <Link href="/inicio" className="px-2 pb-6 pt-2">
          <Logo tone="chalk" />
        </Link>
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
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

        {email ? (
          <div className="mt-auto flex flex-col gap-2 px-1 pt-4">
            <p className="truncate px-2 text-[0.75rem] text-chalk/40">{email}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[0.875rem] font-semibold text-chalk/55 transition-colors hover:bg-white/6 hover:text-chalk"
            >
              <LogOutIcon className="size-5" />
              {t.signOut}
            </button>
          </div>
        ) : null}
      </nav>
    </>
  );
}
