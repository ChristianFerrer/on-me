"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fill, type Dict, type Locale } from "@/lib/i18n";

type JoinDict = Dict["join"];

type ErrorKey = keyof JoinDict["errors"];

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
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (!name.trim()) return setError("name");
    if (!consent) return setError("consent");

    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop, name, phone, consent: true, locale }),
      });

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const code = (data as { error?: string } | null)?.error;
        setError(isErrorKey(code, t.errors) ? code : "generic");
        setBusy(false);
        return;
      }

      // La cookie ya viene puesta por el servidor; el token no pasa por aquí.
      // `refresh` garantiza que la tarjeta se pida de nuevo con esa cookie.
      router.replace("/c");
      router.refresh();
    } catch {
      setError("generic");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <label htmlFor="name" className="overline text-ink-faint">
          {t.nameLabel}
        </label>
        <input
          id="name"
          name="name"
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
        <label htmlFor="phone" className="overline text-ink-faint">
          {t.phoneLabel}
        </label>
        <input
          id="phone"
          name="phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder={t.phonePlaceholder}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="done"
          aria-invalid={error === "phone"}
          aria-describedby="phone-hint"
          className="numeral field mt-2"
        />
        <p id="phone-hint" className="mt-2 text-[0.8rem] leading-snug text-ink-faint">
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

      <Button type="submit" tone="tomato" size="xl" disabled={busy}>
        {busy ? t.submitting : t.submit}
      </Button>
    </form>
  );
}

function isErrorKey(
  value: string | undefined,
  errors: JoinDict["errors"],
): value is ErrorKey {
  return typeof value === "string" && value in errors;
}
