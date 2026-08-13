"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Slab } from "@/components/ui/Screen";
import { fill, type Dict, type Locale } from "@/lib/i18n";
import { Consent } from "./JoinForm";

type JoinDict = Dict["join"];
type GuestDict = Dict["guest"];

/**
 * El invitado acepta el café. Mismos tres campos que el alta normal.
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
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<keyof JoinDict["errors"] | null>(null);
  const [alreadyCustomer, setAlreadyCustomer] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (!name.trim()) return setError("name");
    if (!consent) return setError("consent");

    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/invite/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name, phone, consent: true, locale }),
      });

      const data: unknown = await response.json().catch(() => null);
      const outcome = (data as { error?: string } | null)?.error;

      if (outcome === "existing_customer") {
        // La cookie ya apunta a su tarjeta de siempre.
        setAlreadyCustomer(true);
        setBusy(false);
        return;
      }

      if (!response.ok) {
        setError(outcome === "phone" ? "phone" : "generic");
        setBusy(false);
        return;
      }

      router.replace("/c");
      router.refresh();
    } catch {
      setError("generic");
      setBusy(false);
    }
  }

  if (alreadyCustomer) {
    return (
      <Slab className="p-7">
        <h2 className="display text-[1.75rem]">{guest.alreadyCustomer}</h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/60">
          {guest.alreadyCustomerBody}
        </p>
        <ButtonLink href="/c" tone="lime" size="lg" className="mt-6">
          {guest.goToCard}
        </ButtonLink>
      </Slab>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <input
        id="claim-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t.namePlaceholder}
        aria-label={t.nameLabel}
        autoComplete="given-name"
        enterKeyHint="next"
        aria-invalid={error === "name"}
        className="field"
      />

      <input
        id="claim-phone"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder={t.phonePlaceholder}
        aria-label={t.phoneLabel}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        enterKeyHint="done"
        aria-invalid={error === "phone"}
        aria-describedby="claim-phone-hint"
        className="numeral field"
      />

      <p
        id="claim-phone-hint"
        className="px-1 text-[0.8125rem] leading-snug text-ink/50"
      >
        {t.phoneHint}
      </p>

      <Consent
        checked={consent}
        onChange={setConsent}
        invalid={error === "consent"}
        label={fill(t.consent, { shop: shopName })}
        linkLabel={t.consentLink}
        href={privacyHref}
      />

      {error ? (
        <p role="alert" className="px-1 text-[0.9375rem] font-semibold text-coral">
          {t.errors[error]}
        </p>
      ) : null}

      <Button type="submit" tone="ink" size="lg" disabled={busy} className="mt-1">
        {busy ? guest.claiming : guest.claim}
        <span className="size-2 rounded-full bg-lime" aria-hidden />
      </Button>
    </form>
  );
}
