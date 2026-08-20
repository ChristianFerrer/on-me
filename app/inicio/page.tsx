import Link from "next/link";
import { CardIcon, InfoIcon, PanelIcon, QrIcon, ScanIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { assertNoQueryError, db } from "@/lib/db/client";
import { getI18n } from "@/lib/i18n/server";

/**
 * Portal de todos: los sitios a los que alguien -del equipo o cliente-
 * necesita llegar sin memorizar ni teclear una ruta — la tarjeta propia,
 * el cartel del QR, el escáner de barra y el panel. Pública a propósito:
 * cada destino ya tiene su propia puerta (sesión de cliente, de
 * dispositivo, login de Supabase), así que enseñar el enlace no abre nada
 * que no estuviera ya protegido donde importa.
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
    <div className="aurora-night h-dvh w-full overflow-hidden text-chalk sm:h-auto sm:min-h-dvh sm:overflow-visible" lang={locale}>
      <main className="mx-auto flex h-dvh w-full max-w-[30rem] flex-col gap-6 px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:h-auto sm:min-h-dvh sm:max-w-2xl sm:justify-center sm:pt-10">
        <div className="flex shrink-0 flex-col items-center gap-2.5 text-center sm:items-start sm:text-left">
          <Logo size="lg" tone="chalk" />
          <p className="eyebrow text-chalk/40">{t.home.subtitle}</p>
        </div>

        <nav className="grid min-h-0 flex-1 grid-cols-2 auto-rows-fr gap-2 sm:flex-none sm:gap-3">
          <Tile
            href="/c"
            icon={<CardIcon className="size-6 sm:size-7" />}
            title={t.home.myCard}
            body={t.home.myCardBody}
          />
          {shop ? (
            <Tile
              href={`/j/${shop.slug}/qr`}
              icon={<QrIcon className="size-6 sm:size-7" />}
              title={t.home.qr}
              body={t.home.qrBody}
            />
          ) : null}
          <Tile
            href="/s"
            icon={<ScanIcon className="size-6 sm:size-7" />}
            title={t.home.scanner}
            body={t.home.scannerBody}
          />
          <Tile
            href="/admin/constelacion-sol"
            icon={<PanelIcon className="size-6 sm:size-7" />}
            title={t.home.panel}
            body={t.home.panelBody}
          />
          <Tile
            href="/como-funciona"
            icon={<InfoIcon className="size-6 sm:size-7" />}
            title={t.home.instructions}
            body={t.home.instructionsBody}
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
      className="glass-dark flex aspect-square flex-col justify-center gap-2.5 overflow-hidden p-4 transition-[filter] hover:brightness-125 sm:aspect-auto sm:gap-4 sm:p-7"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-lime text-ink sm:size-12">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.9375rem] font-semibold sm:text-[1.125rem]">{title}</span>
        <span className="mt-0.5 line-clamp-2 block text-[0.75rem] text-chalk/50 sm:mt-1 sm:text-[0.875rem]">
          {body}
        </span>
      </span>
    </Link>
  );
}
