import Link from "next/link";
import { PanelIcon, QrIcon, ScanIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { assertNoQueryError, db } from "@/lib/db/client";
import { getI18n } from "@/lib/i18n/server";

/**
 * Portal del equipo: los tres sitios a los que alguien del local necesita
 * llegar sin memorizar ni teclear una ruta — el cartel del QR, el escáner
 * de barra y el panel. Pública a propósito: cada destino ya tiene su propia
 * puerta (sesión de dispositivo, login de Supabase), así que enseñar el
 * enlace no abre nada que no estuviera ya protegido donde importa.
 *
 * Asume un solo local, como el resto del piloto: el primero que haya.
 */
export default async function InicioPage() {
  const { locale, t } = await getI18n();

  // Sin local todavía no es un error: es un DB recién provisionado. Un error
  // real de Supabase, en cambio, no debe leerse como "sin local todavía".
  const { data: shop, error } = await db()
    .from("shops")
    .select("slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  assertNoQueryError(error, "shops.first");

  return (
    <div className="aurora-night min-h-dvh w-full text-chalk" lang={locale}>
      <main className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col gap-10 px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-2xl sm:justify-center sm:pt-10">
        <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <Logo size="lg" tone="chalk" />
          <p className="eyebrow text-chalk/40">{t.home.subtitle}</p>
        </div>

        <nav className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {shop ? (
            <Tile
              href={`/j/${shop.slug}/qr`}
              icon={<QrIcon className="size-7" />}
              title={t.home.qr}
              body={t.home.qrBody}
            />
          ) : null}
          <Tile
            href="/s"
            icon={<ScanIcon className="size-7" />}
            title={t.home.scanner}
            body={t.home.scannerBody}
          />
          <Tile
            href="/admin"
            icon={<PanelIcon className="size-7" />}
            title={t.home.panel}
            body={t.home.panelBody}
          />
        </nav>
      </main>
    </div>
  );
}

function Tile({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-ink/70 p-6 ring-1 ring-inset ring-chalk/10 backdrop-blur transition-colors hover:bg-ink/90 sm:gap-6 sm:p-7"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-lime text-ink">
        {icon}
      </span>
      <span>
        <span className="block text-[1.125rem] font-semibold">{title}</span>
        <span className="mt-1 block text-[0.875rem] text-chalk/50">{body}</span>
      </span>
    </Link>
  );
}
