"use client";

import { useState } from "react";
import { CustomerForm } from "@/components/client/CustomerForm";
import { ButtonLink } from "@/components/ui/Button";
import { Slab } from "@/components/ui/Screen";
import type { Dict, Locale } from "@/lib/i18n";

type JoinDict = Dict["join"];
type GuestDict = Dict["guest"];

/**
 * El invitado acepta el café. Mismos tres campos que el alta normal -ver
 * CustomerForm-.
 *
 * El desenlace interesante es `existing_customer`: si ya era cliente del
 * local, no se le da café gratis y no se cuenta como cliente nuevo, pero
 * tampoco se le deja tirado — se le devuelve su tarjeta con sus sellos.
 */
export function ClaimForm({
  code,
  locale,
  t,
  guest,
  shopName,
  privacyHref,
}: {
  code: string;
  locale: Locale;
  t: JoinDict;
  guest: GuestDict;
  shopName: string;
  privacyHref: string;
}) {
  const [alreadyCustomer, setAlreadyCustomer] = useState(false);

  return (
    <CustomerForm
      idPrefix="claim-"
      endpoint="/api/invite/claim"
      buildBody={({ name, phone }) => ({ code, name, phone })}
      locale={locale}
      t={t}
      shopName={shopName}
      privacyHref={privacyHref}
      submitLabel={guest.claim}
      submittingLabel={guest.claiming}
      onSpecialOutcome={(errorCode) => {
        if (errorCode !== "existing_customer") return false;
        // La cookie ya apunta a su tarjeta de siempre.
        setAlreadyCustomer(true);
        return true;
      }}
      specialSlot={
        alreadyCustomer ? (
          <Slab className="p-7">
            <h2 className="display text-[1.75rem]">{guest.alreadyCustomer}</h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/70">
              {guest.alreadyCustomerBody}
            </p>
            <ButtonLink href="/c" tone="lime" size="lg" className="mt-6">
              {guest.goToCard}
            </ButtonLink>
          </Slab>
        ) : null
      }
    />
  );
}
