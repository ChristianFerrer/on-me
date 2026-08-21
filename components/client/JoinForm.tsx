"use client";

import { CustomerForm } from "@/components/client/CustomerForm";
import type { Dict, Locale } from "@/lib/i18n";

type JoinDict = Dict["join"];

/**
 * Alta desde el QR de la barra. El listón es 40 segundos sin ayuda y con
 * cola detrás, así que hay tres campos y ni uno más: nombre, móvil y el
 * consentimiento, que es la base legal y no se puede quitar.
 */
export function JoinForm({
  shop,
  shopName,
  locale,
  t,
  privacyHref,
}: {
  shop: string;
  shopName: string;
  locale: Locale;
  t: JoinDict;
  privacyHref: string;
}) {
  return (
    <CustomerForm
      idPrefix=""
      endpoint="/api/join"
      buildBody={({ name, phone }) => ({ shop, name, phone })}
      locale={locale}
      t={t}
      shopName={shopName}
      privacyHref={privacyHref}
      submitLabel={t.submit}
      submittingLabel={t.submitting}
    />
  );
}
