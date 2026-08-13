import Link from "next/link";
import { redirect } from "next/navigation";
import { InvitePanel } from "@/components/client/InvitePanel";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Screen, Sheet } from "@/components/ui/Screen";
import { loadCard } from "@/lib/card";
import { env } from "@/lib/env";
import { fill } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { readCustomerToken } from "@/lib/session";

export default async function InvitePage() {
  const { locale, t } = await getI18n();
  const token = await readCustomerToken();
  const card = token ? await loadCard(token) : null;

  if (!card) redirect("/c");

  const existing = card.activeInvites[0];
  const initialInvite = existing
    ? { code: existing.code, url: `${env.baseUrl}/i/${existing.code}` }
    : null;

  return (
    <Screen className="gap-6 pb-8">
      <header className="flex items-center justify-between gap-3">
        <Link href="/c" prefetch={false} className="overline text-ink-faint">
          ← {t.common.back}
        </Link>
        <LangSwitch locale={locale} label={t.common.switchTo} />
      </header>

      <div className="stagger flex flex-col gap-6">
        <div className="relative">
          <span
            aria-hidden
            className="halftone halftone-lg anim-drift absolute -right-8 -top-8 -z-10 size-36 rounded-full text-fuchsia"
          />
          <p className="overline text-ink-faint">{t.invite.eyebrow}</p>
          <h1 className="display-tight mt-2 text-[clamp(2.5rem,13vw,3.4rem)]">
            {t.invite.title}
          </h1>
          <p className="mt-3 text-[1.05rem] font-medium leading-snug text-ink-soft">
            {fill(t.invite.subtitle, { shop: card.shop.name })}
          </p>
        </div>

        <Sheet className="bg-ink p-5 text-paper" tint="var(--color-saffron)">
          <ul className="flex flex-col gap-3">
            {[
              t.invite.rules.one,
              fill(t.invite.rules.two, { days: card.shop.invite_ttl_days }),
              fill(t.invite.rules.three, { bonus: card.shop.bonus_stamps }),
            ].map((rule, index) => (
              <li key={rule} className="flex items-start gap-3">
                <span className="numeral mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-saffron text-[0.8rem] font-semibold text-ink">
                  {index + 1}
                </span>
                <span className="text-[0.95rem] leading-snug text-paper/85">
                  {rule}
                </span>
              </li>
            ))}
          </ul>
        </Sheet>

        <InvitePanel
          t={t.invite}
          shopName={card.shop.name}
          initialInvite={initialInvite}
          quotaFull={!card.canCreateInvite && !initialInvite}
          activeCount={card.activeInvites.length}
        />
      </div>
    </Screen>
  );
}
