import { headers } from "next/headers";
import { ClaimForm } from "@/components/client/ClaimForm";
import { MarkOpened } from "@/components/client/MarkOpened";
import { ButtonLink } from "@/components/ui/Button";
import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { normalizeInviteCode } from "@/lib/crypto";
import { assertNoQueryError, db } from "@/lib/db/client";
import { fill, formatDate } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { firstName } from "@/lib/scan-service";

const CLAIMABLE = ["created", "sent", "opened"];

/**
 * Un invitado abre su enlace una vez, dos si acaso. Treinta por minuto es
 * holgado para una persona y hace inviable recorrer el espacio de códigos
 * probando uno detrás de otro.
 */
const VIEWS_PER_MINUTE = 30;

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

  // Era la única puerta pública sin contador de intentos: sin esto se puede
  // barrer el espacio de códigos a la caza de una invitación válida.
  const limit = rateLimit(
    `invite-view:${clientIp(await headers())}`,
    VIEWS_PER_MINUTE,
    60_000,
  );
  if (!limit.ok) {
    return (
      <Notice title={t.errors.generic} body={t.join.errors.rate} backHomeLabel={t.errors.backHome} />
    );
  }

  const { data: invitation, error: invitationError } = await db()
    .from("invitations")
    .select("id, code, state, expires_at, shop_id, padrino_id")
    .eq("code", code)
    .maybeSingle();

  assertNoQueryError(invitationError, `invitations.code=${code}`);

  if (!invitation) {
    return <Notice title={t.guest.invalid} body={t.errors.notFoundBody} backHomeLabel={t.errors.backHome} />;
  }

  const expired =
    invitation.state === "expired" || new Date(invitation.expires_at) < new Date();

  if (expired) {
    return (
      <Notice title={t.guest.expired} body={t.guest.expiredBody} backHomeLabel={t.errors.backHome} />
    );
  }

  if (!CLAIMABLE.includes(invitation.state)) {
    return <Notice title={t.guest.used} body={t.guest.expiredBody} backHomeLabel={t.errors.backHome} />;
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
    return <Notice title={t.guest.invalid} body={t.errors.notFoundBody} backHomeLabel={t.errors.backHome} />;
  }

  // Solo el nombre de pila: nunca se enseña a nadie el apellido de otro.
  const padrino = padrinoResult.data ? firstName(padrinoResult.data.name) : "—";

  return (
    <Screen className="gap-7 pb-8">
      <MarkOpened code={code} />
      <TopBar />

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
  title,
  body,
  backHomeLabel,
}: {
  title: string;
  body: string;
  /* CLI-03: para mucha gente esta es la única pantalla de OnMe que verá jamás
     -invitación caducada, usada, inválida o rate-limited-; sin ningún botón
     no tenía ningún siguiente paso salvo cerrar la pestaña. */
  backHomeLabel: string;
}) {
  return (
    <Screen tone="quiet" className="gap-6">
      <TopBar />
      <div className="flex flex-1 flex-col justify-center">
        <Slab className="p-7">
          <h1 className="display text-[1.875rem]">{title}</h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/70">{body}</p>
          <ButtonLink href="/inicio" tone="ink" size="md" className="mt-6">
            {backHomeLabel}
          </ButtonLink>
        </Slab>
      </div>
    </Screen>
  );
}
