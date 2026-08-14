import Link from "next/link";
import {
  ChartIcon,
  FunnelIcon,
  GateIcon,
  PulseIcon,
  TabletIcon,
} from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];
export type AdminSection = "gates" | "embudo" | "senales" | "dispositivos" | "atribuciones";

/**
 * Navegación del panel. Tres secciones viven dentro de `/admin` (anclas) y
 * dos son pantallas propias — por eso conviven `href="/admin#..."` con
 * rutas normales en la misma barra: para quien la usa es un único mapa del
 * panel, no dos mecanismos distintos.
 */
export function AdminNav({ t, active }: { t: AdminDict; active?: AdminSection }) {
  const items: { key: AdminSection; href: string; label: string; icon: React.ReactNode }[] = [
    { key: "gates", href: "/admin#gates", label: t.gates, icon: <GateIcon className="size-4" /> },
    { key: "embudo", href: "/admin#embudo", label: t.title, icon: <FunnelIcon className="size-4" /> },
    { key: "senales", href: "/admin#senales", label: t.ops, icon: <PulseIcon className="size-4" /> },
    {
      key: "dispositivos",
      href: "/admin/dispositivos",
      label: t.devices,
      icon: <TabletIcon className="size-4" />,
    },
    {
      key: "atribuciones",
      href: "/admin/atribuciones",
      label: t.attributions,
      icon: <ChartIcon className="size-4" />,
    },
  ];

  return (
    <nav className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          prefetch={false}
          className={cn(
            "btn shrink-0 gap-1.5 px-4 py-2.5 text-[0.8125rem]",
            active === item.key
              ? "bg-lime text-ink"
              : "bg-ink-2 text-chalk/70 hover:text-chalk",
          )}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
