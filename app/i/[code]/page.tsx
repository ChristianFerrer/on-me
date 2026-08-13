import { ClaimForm } from "@/components/client/ClaimForm";
import { MarkOpened } from "@/components/client/MarkOpened";
import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { normalizeInviteCode } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { fill, formatDate, type Locale } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { firstName } from "@/lib/scan-service";

const CLAIMABLE = ["created", "sent", "opened"];

/**
 * Landing del invitado. Es la única pantalla de OnMe que verá gente que no
 * conoce ni el local ni el producto, y muy probablemente no hable español:
 * por eso el conmutador de idioma va arriba y bien visible.
 */
export default async function GuestPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const { locale, t } = await getI18n();
  const code = normalizeInviteCode(raw);

  const { data: invitation } = await db()
    .from("invitations")
    .select("id, code, state, expires_at, shop_id, padrino_id")
    .eq("code", code)
    .maybeSingle();

  if (!invitation) {
    return <Notice locale={locale} title={t.guest.invalid} body={t.errors.notFoundBody} />;
  }

  const expired =
    invitation.state === "expired" || new Date(invitation.expires_at) < new Date();

  if (expired) {
    return (
      <Notice locale={locale} title={t.guest.expired} body={t.guest.expiredBody} />
    );
  }

  if (!CLAIMABLE.includes(invitation.state)) {
    return <Notice locale={locale} title={t.guest.used} body={t.guest.expiredBody} />;
  }

  const [shopResult, padrinoResult] = await Promise.all([
    db()
      .from("shops")
      .select("name, address, hours")
      .eq("id", invitation.shop_id)
      .maybeSingle(),
    db()
      .from("customers")
      .select("name")
      .eq("id", invitation.padrino_id)
      .maybeSingle(),
  ]);

  const shop = shopResult.data;
  if (!shop) {
    return <Notice locale={locale} title={t.guest.invalid} body={t.errors.notFoundBody} />;
  }

  // Solo el nombre de pila: nunca se enseña a nadie el apellido de otro.
  const padrino = padrinoResult.data ? firstName(padrinoResult.data.name) : "—";

  return (
    <Screen className="gap-7 pb-8">
      <MarkOpened code={code} />
      <TopBar locale={locale} />

      <div className="stagger flex flex-col gap-7">
        <div className="pt-4">
          <p className="eyebrow text-ink/45">{t.guest.eyebrow}</p>
          <h1 className="display-tight mt-3 text-[clamp(2.25rem,10.5vw,2.875rem)]">
            {fill(t.guest.title, { padrino })}
          </h1>
          <p className="mt-4 text-[1.0625rem] font-semibold text-ink/75">
            {fill(t.guest.at, { shop: shop.name })}
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink/60">
            {t.guest.body}
          </p>
          <p className="eyebrow mt-5 text-ink/40">
            {fill(t.guest.expires, {
              date: formatDate(invitation.expires_at, locale),
            })}
          </p>
        </div>

        <ClaimForm
          code={code}
          locale={locale}
          t={t.join}
          guest={t.guest}
          shopName={shop.name}
          privacyHref="/privacidad"
        />
      </div>

      <footer className="mt-auto pt-6 text-center">
        <p className="text-[0.8125rem] leading-relaxed text-ink/45">
          {shop.address}
          {shop.hours ? ` · ${shop.hours}` : ""}
        </p>
      </footer>
    </Screen>
  );
}

function Notice({
  locale,
  title,
  body,
}: {
  locale: Locale;
  title: string;
  body: string;
}) {
  return (
    <Screen tone="quiet" className="gap-6">
      <TopBar locale={locale} />
      <div className="flex flex-1 flex-col justify-center">
        <Slab className="p-7">
          <h1 className="display text-[1.875rem]">{title}</h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/60">{body}</p>
        </Slab>
      </div>
    </Screen>
  );
}
