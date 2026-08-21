"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fill, type Dict, type Locale } from "@/lib/i18n";

type JoinDict = Dict["join"];
type ErrorKey = keyof JoinDict["errors"];

/**
 * Los tres campos de siempre -nombre, móvil, consentimiento- que tanto el
 * alta desde el QR (JoinForm) como el alta desde una invitación (ClaimForm)
 * necesitan, con el mismo patrón de error/busy. Antes vivían duplicados en
 * los dos sitios y ya habían divergido una vez; ahora cada uno es una
 * envoltura fina sobre este componente, parametrizada por endpoint y con un
 * hueco para su propio estado especial -el "ya eras cliente" de ClaimForm-.
 */
export function CustomerForm({
  idPrefix,
  endpoint,
  buildBody,
  locale,
  t,
  shopName,
  privacyHref,
  submitLabel,
  submittingLabel,
  onSpecialOutcome,
  specialSlot,
}: {
  idPrefix: string;
  endpoint: string;
  buildBody: (fields: { name: string; phone: string }) => Record<string, unknown>;
  locale: Locale;
  t: JoinDict;
  shopName: string;
  privacyHref: string;
  submitLabel: string;
  submittingLabel: string;
  /**
   * Se llama con el código de error del servidor antes del manejo genérico.
   * Devuelve `true` si ya se ha encargado de mostrar su propio estado -p.ej.
   * "existing_customer" en ClaimForm-, para no pintar además el error genérico.
   */
  onSpecialOutcome?: (errorCode: string | undefined) => boolean;
  /** Sustituye el formulario entero mientras el estado especial esté activo. */
  specialSlot?: React.ReactNode;
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
    // Mismo mínimo que el servidor (z.string().min(5)) antes de limpiar
    // separadores: sin esto, el error de formato solo aparecía después de
    // esperar la respuesta del servidor -CLI-22-.
    if (phone.trim().length < 5) return setError("phone");
    if (!consent) return setError("consent");

    setError(null);
    setBusy(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...buildBody({ name, phone }), consent: true, locale }),
      });

      const data: unknown = await response.json().catch(() => null);
      const code = (data as { error?: string } | null)?.error;

      if (onSpecialOutcome?.(code)) {
        setBusy(false);
        return;
      }

      if (!response.ok) {
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

  if (specialSlot) return <>{specialSlot}</>;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <input
        id={`${idPrefix}name`}
        name="name"
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
        id={`${idPrefix}phone`}
        name="phone"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder={`${t.phonePlaceholder} *`}
        aria-label={t.phoneLabel}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        enterKeyHint="done"
        required
        aria-invalid={error === "phone"}
        aria-describedby={`${idPrefix}phone-hint`}
        className="numeral field"
      />

      <p id={`${idPrefix}phone-hint`} className="px-1 text-[0.8125rem] leading-snug text-ink/50">
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
        {busy ? submittingLabel : submitLabel}
        <span className="size-2 rounded-full bg-lime" aria-hidden />
      </Button>
    </form>
  );
}

/** Casilla de consentimiento, sin el control nativo del sistema. */
export function Consent({
  checked,
  onChange,
  invalid,
  label,
  linkLabel,
  href,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  invalid: boolean;
  label: string;
  linkLabel: string;
  href: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl px-1 py-2",
        invalid && "text-coral",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-px flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
          checked ? "border-ink bg-ink" : "border-ink/30 bg-white/40",
          invalid && !checked && "border-coral",
        )}
      >
        {checked ? (
          <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-lime stroke-[2.2]">
            <path d="M2 6.2 4.6 8.8 10 3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className="text-[0.8125rem] leading-snug text-ink/70">
        {label}{" "}
        <a href={href} className="font-semibold text-ink underline underline-offset-2">
          {linkLabel}
        </a>
      </span>
    </label>
  );
}

function isErrorKey(
  value: string | undefined,
  errors: JoinDict["errors"],
): value is ErrorKey {
  return typeof value === "string" && value in errors;
}
