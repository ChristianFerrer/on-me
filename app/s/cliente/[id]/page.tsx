import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CustomerActions } from "@/components/barista/CustomerActions";
import { QrCode } from "@/components/ui/QrCode";
import { Screen, Sheet } from "@/components/ui/Screen";
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
    <Screen className="gap-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/s/buscar" prefetch={false} className="overline text-ink-faint">
          ← {t.common.back}
        </Link>
        <span className="overline rounded-full border-2 border-ink px-3 py-1.5">
          {t.barista.manualBadge}
        </span>
      </header>

      <div>
        <h1 className="display text-[2.4rem]">{firstName(customer.name)}</h1>
        <p className="numeral mt-1 text-ink-soft">··{customer.phone_last4}</p>
      </div>

      <Sheet
        className={rewardPending ? "bg-saffron p-5" : "bg-paper-deep p-5"}
        tint={rewardPending ? "var(--color-tomato)" : "var(--color-cobalt)"}
      >
        <StampCard stamps={stamps} goal={ctx.shop.stamps_goal} />
        <p className="numeral mt-4 text-sm font-semibold">
          {stamps}/{ctx.shop.stamps_goal}
          {rewardPending ? ` · ${t.card.rewardTitle}` : ""}
        </p>
      </Sheet>

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
      <Sheet className="mt-auto bg-paper p-5" tint="var(--color-jade)">
        <p className="overline text-ink-faint">{t.barista.resend}</p>
        <p className="mt-1.5 text-[0.95rem] leading-snug text-ink-soft">
          {t.barista.resendBody}
        </p>
        <QrCode
          value={`${env.baseUrl}/c/${customer.token}`}
          label={t.barista.resend}
          className="mx-auto mt-4 w-40"
        />
      </Sheet>
    </Screen>
  );
}
