import { ClaimForm } from "@/components/client/ClaimForm";
import { MarkOpened } from "@/components/client/MarkOpened";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Logo } from "@/components/ui/Logo";
import { Screen, Sheet } from "@/components/ui/Screen";
import { normalizeInviteCode } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { fill, formatDate, type Locale } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { firstName } from "@/lib/scan-service";
import type { Dict } from "@/lib/i18n";

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
    return <Notice locale={locale} t={t} title={t.guest.invalid} body={t.errors.notFoundBody} />;
  }

  const expired =
    invitation.state === "expired" || new Date(invitation.expires_at) < new Date();

  if (expired) {
    return (
      <Notice locale={locale} t={t} title={t.guest.expired} body={t.guest.expiredBody} />
    );
  }

  if (!CLAIMABLE.includes(invitation.state)) {
    return <Notice locale={locale} t={t} title={t.guest.used} body={t.guest.expiredBody} />;
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
    return <Notice locale={locale} t={t} title={t.guest.invalid} body={t.errors.notFoundBody} />;
  }

  // Solo el nombre de pila: nunca se enseña a nadie el apellido de otro.
  const padrino = padrinoResult.data ? firstName(padrinoResult.data.name) : "—";

  return (
    <Screen className="gap-6 pb-8">
      <MarkOpened code={code} />

      <header className="flex items-center justify-between gap-3">
        <Logo size="sm" />
        <LangSwitch locale={locale} label={t.common.switchTo} />
      </header>

      <div className="stagger flex flex-col gap-6">
        <Sheet className="bg-cobalt p-6 text-paper" tint="var(--color-saffron)">
          <span
            aria-hidden
            className="halftone halftone-lg anim-drift absolute -right-12 -top-12 size-44 rounded-full text-paper"
          />
          <p className="overline text-paper/70">{t.guest.eyebrow}</p>
          <h1 className="display-tight mt-2 text-[clamp(2.4rem,12vw,3.2rem)]">
            {fill(t.guest.title, { padrino })}
          </h1>
          <p className="mt-3 text-[1.05rem] font-semibold text-paper/90">
            {fill(t.guest.at, { shop: shop.name })}
          </p>
          <p className="mt-4 text-[0.95rem] leading-snug text-paper/75">
            {t.guest.body}
          </p>
          <p className="overline mt-5 text-paper/60">
            {fill(t.guest.expires, {
              date: formatDate(invitation.expires_at, locale),
            })}
          </p>
        </Sheet>

        <ClaimForm
          code={code}
          locale={locale}
          t={t.join}
          guest={t.guest}
          shopName={shop.name}
          privacyHref="/privacidad"
        />
      </div>

      <footer className="mt-auto border-t-2 border-ink/15 pt-4">
        <p className="text-[0.85rem] leading-snug text-ink-faint">
          {shop.address}
          {shop.hours ? ` · ${shop.hours}` : ""}
        </p>
      </footer>
    </Screen>
  );
}

function Notice({
  locale,
  t,
  title,
  body,
}: {
  locale: Locale;
  t: Dict;
  title: string;
  body: string;
}) {
  return (
    <Screen className="justify-center gap-6">
      <header className="flex items-center justify-between gap-3">
        <Logo size="sm" />
        <LangSwitch locale={locale} label={t.common.switchTo} />
      </header>
      <Sheet className="bg-smoke p-6 text-paper" tint="var(--color-ink)">
        <h1 className="display text-[2rem] leading-tight">{title}</h1>
        <p className="mt-3 text-[0.95rem] leading-snug text-paper/85">{body}</p>
      </Sheet>
      <div className="flex-1" />
    </Screen>
  );
}
