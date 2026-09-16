"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChartIcon,
  HomeIcon,
  LogOutIcon,
  OrbitIcon,
  PulseIcon,
  TabletIcon,
} from "@/components/ui/Icons";
import { Logo, Mark } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];
export type AdminSection = "constelacion" | "metricas" | "dispositivos" | "atribuciones";

/** Ancho del sidebar de escritorio expandido -ver también el valor estático en globals.css-. */
export const ADMIN_SIDEBAR_WIDTH = "16rem";
/** Ancho del sidebar colapsado -icono nada más-, y valor por defecto de `--admin-sidebar-width` en globals.css. */
const ADMIN_SIDEBAR_WIDTH_COLLAPSED = "4.5rem";
const SIDEBAR_STORAGE_KEY = "onme_admin_sidebar";

function applySidebarWidth(collapsed: boolean) {
  document.documentElement.style.setProperty(
    "--admin-sidebar-width",
    collapsed ? ADMIN_SIDEBAR_WIDTH_COLLAPSED : ADMIN_SIDEBAR_WIDTH,
  );
}

/**
 * Navegación fija del panel: cuatro páginas de verdad, no anclas — cada una
 * hace su propia comprobación de sesión, así que basta con enlazar a la
 * ruta y dejar que la propia página decida si hay que enseñar el login.
 *
 * En móvil -y tablet vertical, hasta 1000px- sigue siendo una barra
 * inferior tipo pestañas de app -el pulgar manda-; a partir de 1000px se
 * convierte en un sidebar fijo a la izquierda. Es el mismo componente, dos
 * marcados -uno oculto en cada punto de quiebre-, no dos componentes
 * separados: así ambos comparten la lista de items y no pueden
 * desincronizarse.
 *
 * El sidebar arranca colapsado -solo iconos, ADMIN_SIDEBAR_WIDTH_COLLAPSED-
 * y un botón lo expande a etiquetas de texto visibles
 * (ADMIN_SIDEBAR_WIDTH). El estado se recuerda en localStorage -clave
 * SIDEBAR_STORAGE_KEY- para que quien lo expande no tenga que repetirlo en
 * cada pantalla del panel -cada una monta su propio BottomNav, no hay
 * layout compartido que sobreviva a la navegación-, pero el primer pintado
 * siempre es el colapsado: `--admin-sidebar-width` en globals.css ya trae
 * ese valor de fábrica, así que no hace falta JS para acertar en el caso
 * por defecto, y solo se reajusta por JS -tras montar- cuando localStorage
 * dice que esta persona ya lo había dejado expandido.
 *
 * Los enlaces van con `prefetch={false}`: el valor por defecto de `Link`
 * precarga en cuanto el enlace entra en el viewport -no solo al pasar el
 * ratón por encima-, y aquí las cinco entradas del panel están todas a la
 * vista a la vez, así que ese "por defecto" dispara cinco páginas enteras
 * -sesión + datos- de golpe nada más pintarse cualquiera de ellas. Los
 * logs de Vercel lo confirmaron: un montón de peticiones simultáneas justo
 * al entrar a cualquier pantalla del panel, no al pulsar. En su lugar,
 * `prefetchOnIntent` de aquí abajo pide la precarga a mano, una sola ruta
 * cada vez, solo cuando de verdad hay intención de ir -encima con el
 * ratón, foco de teclado, o el dedo tocando en móvil-.
 */
function prefetchOnIntent(router: ReturnType<typeof useRouter>, href: string) {
  router.prefetch(href);
}

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
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    function readStoredPreference() {
      try {
        if (window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "expanded") {
          setCollapsed(false);
          applySidebarWidth(false);
        }
      } catch {
        // Sin localStorage: se queda colapsado, que ya es el valor por defecto.
      }
    }

    readStoredPreference();
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      applySidebarWidth(next);
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
      } catch {
        // Se pliega/expande igual, solo no lo recuerda para la próxima.
      }
      return next;
    });
  }

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
            prefetch={false}
            onMouseEnter={() => prefetchOnIntent(router, "/inicio")}
            onFocus={() => prefetchOnIntent(router, "/inicio")}
            onTouchStart={() => prefetchOnIntent(router, "/inicio")}
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
              onMouseEnter={() => prefetchOnIntent(router, item.href)}
              onFocus={() => prefetchOnIntent(router, item.href)}
              onTouchStart={() => prefetchOnIntent(router, item.href)}
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
        className="fixed inset-y-0 left-0 z-40 hidden flex-col gap-1 overflow-hidden rounded-none border-y-0 border-l-0 border-r border-white/10 bg-black p-4 transition-[width] duration-200 ease-out-soft nav:flex"
      >
        <div className={cn("flex items-center pb-6 pt-2", collapsed ? "justify-center" : "justify-between")}>
          <Link
            href="/inicio"
            prefetch={false}
            onMouseEnter={() => prefetchOnIntent(router, "/inicio")}
            onFocus={() => prefetchOnIntent(router, "/inicio")}
            aria-label={t.navHome}
            className="shrink-0"
          >
            {collapsed ? <Mark className="size-2.5 bg-lime" /> : <Logo tone="chalk" />}
          </Link>
          {!collapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={t.collapseSidebar}
              title={t.collapseSidebar}
              className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-chalk/45 transition-colors hover:bg-white/6 hover:text-chalk"
            >
              <ArrowLeftIcon className="size-4" />
            </button>
          ) : null}
        </div>

        {collapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={t.expandSidebar}
            title={t.expandSidebar}
            className="mb-1 flex items-center justify-center rounded-xl px-3 py-2.5 text-chalk/45 transition-colors hover:bg-white/6 hover:text-chalk"
          >
            <ArrowRightIcon className="size-5" />
          </button>
        ) : null}

        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            prefetch={false}
            onMouseEnter={() => prefetchOnIntent(router, item.href)}
            onFocus={() => prefetchOnIntent(router, item.href)}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-semibold transition-colors",
              collapsed && "justify-center px-0",
              active === item.key
                ? "bg-lime/12 text-lime"
                : "text-chalk/55 hover:bg-white/6 hover:text-chalk",
            )}
          >
            {item.icon}
            {!collapsed ? <span className="whitespace-nowrap">{item.label}</span> : null}
          </Link>
        ))}

        {email ? (
          <div className={cn("mt-auto flex flex-col gap-2 pt-4", collapsed ? "items-center" : "px-1")}>
            {!collapsed ? <p className="truncate px-2 text-[0.75rem] text-chalk/40">{email}</p> : null}
            <button
              type="button"
              onClick={() => void signOut()}
              title={collapsed ? `${t.signOut} · ${email}` : undefined}
              aria-label={t.signOut}
              className={cn(
                "flex items-center gap-3 rounded-xl py-2.5 text-left text-[0.875rem] font-semibold text-chalk/55 transition-colors hover:bg-white/6 hover:text-chalk",
                collapsed ? "justify-center px-0" : "px-3",
              )}
            >
              <LogOutIcon className="size-5" />
              {!collapsed ? <span className="whitespace-nowrap">{t.signOut}</span> : null}
            </button>
          </div>
        ) : null}
      </nav>
    </>
  );
}
