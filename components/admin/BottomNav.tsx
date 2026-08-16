import Link from "next/link";
import {
  ChartIcon,
  FunnelIcon,
  OrbitIcon,
  PulseIcon,
  TabletIcon,
} from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];
export type AdminSection = "constelacion" | "embudo" | "metricas" | "dispositivos" | "atribuciones";

/**
 * Barra inferior fija del panel, tipo pestañas de app. Cinco páginas de
 * verdad, no anclas: cada una hace su propia comprobación de sesión, así
 * que basta con enlazar a la ruta y dejar que la propia página decida si
 * hay que enseñar el login. La constelación -la portada del panel- es la
 * única que no lleva esta barra puesta encima, igual que antes tampoco la
 * llevaba en /admin/atribuciones/mapa: sigue siendo una exploración a
 * pantalla completa, no una pestaña más; aun así vive aquí como la
 * primera pestaña, porque "gates" -las puertas- se juntó con las señales
 * en /admin/metricas y le cedió el sitio.
 */
export function BottomNav({ t, active }: { t: AdminDict; active?: AdminSection }) {
  const items: { key: AdminSection; href: string; label: string; icon: React.ReactNode }[] = [
    { key: "constelacion", href: "/admin", label: t.referralMap, icon: <OrbitIcon className="size-5" /> },
    { key: "embudo", href: "/admin/embudo", label: t.title, icon: <FunnelIcon className="size-5" /> },
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-ink/95 backdrop-blur-lg">
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
  );
}
