import Link from "next/link";
import { ConstelacionSolMap } from "@/components/admin/ConstelacionSolMap";
import { LoginForm } from "@/components/admin/LoginForm";
import { HomeIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { loadRealGiftGraph } from "@/lib/giftGraph/loadRealGiftGraph";
import { getI18n } from "@/lib/i18n/server";

/**
 * Vista de comparación de ConstelacionMap -no la portada del panel, cuelga
 * de ella-: mismos datos, mismo layout, mismo gesto de pan/zoom/imán, pero
 * pintada como un cielo de verdad -sol en el núcleo, clientes como
 * estrellas, líneas rectas de carta estelar- en vez del diagrama de
 * burbujas de color plano. Vive en su propia ruta para poder abrirla al
 * lado de /admin y comparar las dos, en vez de un modo/toggle sobre la
 * misma pantalla.
 */
export default async function ConstelacionSolPage() {
  const { locale, t } = await getI18n();
  const ctx = await getAdminContext();

  if (!ctx) {
    return (
      <Screen tone="ink" className="gap-8">
        <Link
          href="/inicio"
          prefetch={false}
          className="-m-2 mt-0 p-2 text-chalk/45 transition-colors hover:text-chalk"
          aria-label={t.home.eyebrow}
        >
          <HomeIcon className="size-6" />
        </Link>
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <Logo size="lg" tone="chalk" />
          <LoginForm t={t.admin} />
        </div>
      </Screen>
    );
  }

  const graph = await loadRealGiftGraph(ctx.shop.id, ctx.shop.name);

  return (
    <ConstelacionSolMap
      graph={graph}
      shopName={ctx.shop.name}
      stampsGoal={ctx.shop.stamps_goal}
      returnWindowDays={ctx.shop.return_window_days}
      locale={locale}
      t={t}
    />
  );
}
