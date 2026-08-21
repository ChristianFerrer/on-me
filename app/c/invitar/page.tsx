import { redirect } from "next/navigation";
import { InvitePanel } from "@/components/client/InvitePanel";
import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { loadCard } from "@/lib/card";
import { env } from "@/lib/env";
import { fill } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { readCustomerToken } from "@/lib/session";

export default async function InvitePage() {
  const { t } = await getI18n();
  const token = await readCustomerToken();
  const card = token ? await loadCard(token) : null;

  if (!card) redirect("/c");

  const initialInvites = card.activeInvites.map((invite) => ({
    code: invite.code,
    url: `${env.baseUrl}/i/${invite.code}`,
  }));

  return (
    <Screen className="gap-7 pb-8">
      <TopBar back="/c" backLabel={t.common.back} />

      <div className="stagger flex flex-col gap-7">
        <div className="pt-4">
          <p className="eyebrow text-ink/45">{t.invite.eyebrow}</p>
          <h1 className="display-tight mt-3 text-[clamp(2.375rem,11vw,3rem)]">
            {t.invite.title}
          </h1>
          <p className="mt-4 text-[1rem] font-medium leading-relaxed text-ink/65">
            {fill(t.invite.subtitle, { shop: card.shop.name })}
          </p>
        </div>

        <Slab className="p-7">
          <ol className="flex flex-col gap-4">
            {[
              t.invite.rules.one,
              fill(t.invite.rules.two, { days: card.shop.invite_ttl_days }),
              fill(t.invite.rules.three, {
                bonus: card.shop.bonus_stamps,
                returnDays: card.shop.return_window_days,
              }),
            ].map((rule, index) => (
              <li key={rule} className="flex items-start gap-4">
                <span className="numeral mt-px w-4 shrink-0 text-[0.875rem] font-semibold text-lime">
                  {index + 1}
                </span>
                <span className="text-[0.9375rem] leading-snug text-chalk/70">
                  {rule}
                </span>
              </li>
            ))}
          </ol>
        </Slab>

        <InvitePanel
          t={t.invite}
          shopName={card.shop.name}
          initialInvites={initialInvites}
          canCreateInvite={card.canCreateInvite}
        />
      </div>
    </Screen>
  );
}
