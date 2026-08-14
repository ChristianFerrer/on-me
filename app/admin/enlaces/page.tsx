import Link from "next/link";
import { redirect } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { getI18n } from "@/lib/i18n/server";

/**
 * Todos los enlaces operativos en un solo sitio: el QR de alta, el cartel a
 * pantalla completa, la barra y el propio panel. Antes había que recordar
 * o teclear cada ruta a mano; esto es el punto de partida para cualquiera
 * que abra OnMe por primera vez en un dispositivo nuevo.
 */
export default async function LinksPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin");

  const { t } = await getI18n();
  const slug = ctx.shop.slug;

  return (
    <Screen tone="ink" className="gap-7 pb-10">
      <header className="flex items-center justify-between gap-3 pt-2">
        <Link
          href="/admin"
          prefetch={false}
          className="text-[0.9375rem] font-medium text-chalk/60 transition-colors hover:text-chalk"
        >
          ← {t.common.back}
        </Link>
      </header>

      <div>
        <p className="eyebrow text-chalk/35">{ctx.shop.name}</p>
        <h1 className="display mt-1.5 text-[1.75rem]">{t.admin.linksTitle}</h1>
      </div>

      <nav className="flex flex-col gap-6">
        <Group title={t.admin.linksGroupJoin}>
          <LinkCard
            href={`/j/${slug}`}
            title={t.admin.linksJoin}
            body={t.admin.linksJoinBody}
            external
          />
          <LinkCard
            href={`/j/${slug}/qr`}
            title={t.admin.linksPoster}
            body={t.admin.linksPosterBody}
            external
          />
        </Group>

        <Group title={t.admin.linksGroupBar}>
          <LinkCard
            href="/s"
            title={t.admin.linksScanner}
            body={t.admin.linksScannerBody}
          />
          <LinkCard
            href="/s/buscar"
            title={t.admin.linksSearch}
            body={t.admin.linksSearchBody}
          />
        </Group>

        <Group title={t.admin.linksGroupPanel}>
          <LinkCard
            href="/admin"
            title={t.admin.linksFunnel}
            body={t.admin.linksFunnelBody}
          />
          <LinkCard
            href="/admin/atribuciones"
            title={t.admin.linksAttributions}
            body={t.admin.linksAttributionsBody}
          />
          <LinkCard
            href="/privacidad"
            title={t.admin.linksPrivacy}
            body={t.admin.linksPrivacyBody}
            external
          />
        </Group>
      </nav>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="eyebrow text-chalk/35">{title}</p>
      {children}
    </div>
  );
}

/** `external` abre en pestaña nueva: son las rutas que se comparten o se ponen en otro dispositivo. */
function LinkCard({
  href,
  title,
  body,
  external,
}: {
  href: string;
  title: string;
  body: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className="flex items-center justify-between gap-4 rounded-2xl bg-ink px-5 py-4 transition-colors hover:bg-ink-2"
    >
      <span className="min-w-0">
        <span className="block truncate text-[1.0625rem] font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[0.8125rem] text-chalk/45">{body}</span>
      </span>
      <span aria-hidden className="shrink-0 text-chalk/40">
        {external ? "↗" : "→"}
      </span>
    </Link>
  );
}
