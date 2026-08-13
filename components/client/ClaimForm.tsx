"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Screen";
import { cn } from "@/lib/cn";
import { fill, type Dict, type Locale } from "@/lib/i18n";

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
      const code_ = (data as { error?: string } | null)?.error;

      if (code_ === "existing_customer") {
        // La cookie ya apunta a su tarjeta de siempre.
        setAlreadyCustomer(true);
        setBusy(false);
        return;
      }

      if (!response.ok) {
        setError(code_ === "phone" ? "phone" : "generic");
        setBusy(false);
        return;
      }

      window.location.assign("/c");
    } catch {
      setError("generic");
      setBusy(false);
    }
  }

  if (alreadyCustomer) {
    return (
      <Sheet className="bg-saffron p-6" tint="var(--color-tomato)">
        <h2 className="display text-[1.9rem] leading-tight">
          {guest.alreadyCustomer}
        </h2>
        <p className="mt-3 text-[0.98rem] leading-snug">
          {guest.alreadyCustomerBody}
        </p>
        <ButtonLink href="/c" tone="ink" size="lg" className="mt-5">
          {guest.goToCard}
        </ButtonLink>
      </Sheet>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <label htmlFor="claim-name" className="overline text-ink-faint">
          {t.nameLabel}
        </label>
        <input
          id="claim-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t.namePlaceholder}
          autoComplete="given-name"
          enterKeyHint="next"
          aria-invalid={error === "name"}
          className="field mt-2"
        />
      </div>

      <div>
        <label htmlFor="claim-phone" className="overline text-ink-faint">
          {t.phoneLabel}
        </label>
        <input
          id="claim-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder={t.phonePlaceholder}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="done"
          aria-invalid={error === "phone"}
          aria-describedby="claim-phone-hint"
          className="numeral field mt-2"
        />
        <p
          id="claim-phone-hint"
          className="mt-2 text-[0.8rem] leading-snug text-ink-faint"
        >
          {t.phoneHint}
        </p>
      </div>

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4",
          error === "consent" ? "border-tomato bg-tomato/10" : "border-ink/20",
        )}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 size-6 shrink-0 accent-[var(--color-cobalt)]"
        />
        <span className="text-[0.9rem] leading-snug text-ink-soft">
          {fill(t.consent, { shop: shopName })}{" "}
          <a href={privacyHref} className="font-semibold text-cobalt underline">
            {t.consentLink}
          </a>
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-[0.95rem] font-semibold text-tomato">
          {t.errors[error]}
        </p>
      ) : null}

      <Button type="submit" tone="cobalt" size="xl" disabled={busy}>
        {busy ? guest.claiming : guest.claim}
      </Button>
    </form>
  );
}
