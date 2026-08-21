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
 * La portada del panel: lo primero que ve el dueño al entrar -/admin ahora
 * solo redirige aquí, ver app/admin/page.tsx-. Mismos datos, mismo layout,
 * mismo gesto de pan/zoom/imán que el viejo ConstelacionMap -ya retirado
 * de aquí, sigue existiendo como componente por si hiciera falta
 * recuperarlo-, pero pintada como un cielo de verdad: sol en el núcleo,
 * clientes como estrellas, líneas rectas de carta estelar en vez del
 * diagrama de burbujas de color plano.
 */
export default async function ConstelacionSolPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; focus?: string }>;
}) {
  const { locale, t } = await getI18n();
  const ctx = await getAdminContext();
  const { session, focus } = await searchParams;

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
          {session === "expired" ? (
            <p role="status" className="-mt-4 px-4 text-center text-[0.875rem] font-medium text-amber">
              {t.admin.sessionExpired}
            </p>
          ) : null}
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
      initialFocusId={focus}
    />
  );
}
