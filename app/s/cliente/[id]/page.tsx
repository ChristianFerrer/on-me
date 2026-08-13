import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CustomerActions } from "@/components/barista/CustomerActions";
import { QrCode } from "@/components/ui/QrCode";
import { Screen } from "@/components/ui/Screen";
import { StampCard } from "@/components/ui/StampCard";
import { getDeviceContext, pinRequired } from "@/lib/auth/device";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { firstName } from "@/lib/scan-service";

type CustomerDetail = {
  id: string;
  name: string;
  phone_last4: string;
  token: string;
  shop_id: string;
  passes: { stamps: number; reward_pending: boolean }[];
};

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getDeviceContext();
  if (!ctx) redirect("/s");

  const { id } = await params;
  const { t } = await getI18n();

  const { data: customer } = await db()
    .from("customers")
    .select("id, name, phone_last4, token, shop_id, passes(stamps, reward_pending)")
    .eq("id", id)
    .maybeSingle()
    .returns<CustomerDetail>();

  // Un dispositivo solo ve clientes de su propio local.
  if (!customer || customer.shop_id !== ctx.shop.id) notFound();

  const stamps = customer.passes[0]?.stamps ?? 0;
  const rewardPending = customer.passes[0]?.reward_pending ?? false;

  return (
    <Screen tone="ink" className="gap-6">
      <header className="flex items-center justify-between gap-3 pt-2">
        <Link
          href="/s/buscar"
          prefetch={false}
          className="text-[0.9375rem] font-medium text-chalk/60 transition-colors hover:text-chalk"
        >
          ← {t.common.back}
        </Link>
        <span className="eyebrow rounded-full bg-white/8 px-3 py-1.5 text-chalk/50">
          {t.barista.manualBadge}
        </span>
      </header>

      <div>
        <h1 className="display text-[2.25rem]">{firstName(customer.name)}</h1>
        <p className="numeral mt-1 text-[0.9375rem] text-chalk/45">
          ··{customer.phone_last4}
        </p>
      </div>

      <section className="rounded-[var(--radius-card)] bg-ink-2 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <span className="numeral text-[1.5rem] font-semibold">
            {stamps}
            <span className="text-chalk/30">/{ctx.shop.stamps_goal}</span>
          </span>
          {rewardPending ? (
            <span className="eyebrow rounded-full bg-amber px-3 py-1.5 text-ink">
              {t.card.rewardTitle}
            </span>
          ) : null}
        </div>
        <StampCard
          stamps={stamps}
          goal={ctx.shop.stamps_goal}
          tone="dark"
          className="mt-5"
        />
      </section>

      <CustomerActions
        t={t.barista}
        customerId={customer.id}
        pinRequired={pinRequired(ctx.device)}
      />

      {/*
        Devolver la tarjeta a quien la perdió. Sin login, la recuperación usa
        el canal que ya existe: estar delante del mostrador. Este QR lleva la
        URL completa para que se abra con la cámara del móvil — el de la
        tarjeta del cliente, en cambio, lleva solo el token, porque lo lee
        nuestro escáner y cuantos menos módulos tenga, más rápido decodifica.
      */}
      <section className="mt-auto rounded-[var(--radius-card)] bg-white p-6">
        <p className="eyebrow text-ink/40">{t.barista.resend}</p>
        <p className="mt-1.5 text-[0.875rem] leading-snug text-ink/55">
          {t.barista.resendBody}
        </p>
        <QrCode
          value={`${env.baseUrl}/c/${customer.token}`}
          label={t.barista.resend}
          className="mx-auto mt-5 w-36"
        />
      </section>
    </Screen>
  );
}
