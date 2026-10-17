"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShopCardBackground, ShopCardStyle, ShopTheme } from "@/lib/db/types";
import { LOCALES, type Dict, type Locale } from "@/lib/i18n";

type AdminDict = Dict["admin"];

const MIN_STAMPS = 1;
const MAX_STAMPS = 20;

const LOCALE_LABEL: Record<Locale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  de: "Deutsch",
};

/**
 * Ajustes del local: tope de sellos, apariencia -tema, estilo de tarjeta,
 * logo- e idioma por defecto para las nuevas altas. El logo vive en su
 * propio formulario aparte: es el único campo que no es JSON -sube un
 * archivo-, así que necesita su propia petición.
 */
export function ShopSettingsForm({
  t,
  maxStampsPerScan,
  theme,
  cardStyle,
  cardBackground,
  defaultLocale,
  logoUrl,
}: {
  t: AdminDict;
  maxStampsPerScan: number;
  theme: ShopTheme;
  cardStyle: ShopCardStyle;
  cardBackground: ShopCardBackground;
  defaultLocale: Locale;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [maxStamps, setMaxStamps] = useState(maxStampsPerScan);
  const [themeValue, setThemeValue] = useState<ShopTheme>(theme);
  const [cardStyleValue, setCardStyleValue] = useState<ShopCardStyle>(cardStyle);
  const [cardBackgroundValue, setCardBackgroundValue] = useState<ShopCardBackground>(cardBackground);
  const [localeValue, setLocaleValue] = useState<Locale>(defaultLocale);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaved(false);
    setError(false);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maxStampsPerScan: maxStamps,
          theme: themeValue,
          cardStyle: cardStyleValue,
          cardBackground: cardBackgroundValue,
          defaultLocale: localeValue,
        }),
      });
      if (response.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-5">
      <form onSubmit={save} className="glass-dark flex flex-col gap-6 p-6">
        <div>
          <label htmlFor="max-stamps" className="text-[0.9375rem] font-semibold text-on-surface">
            {t.settingsMaxStampsLabel}
          </label>
          <p className="mt-1 text-[0.8125rem] text-on-surface/50">{t.settingsMaxStampsBody}</p>
          <input
            id="max-stamps"
            type="number"
            inputMode="numeric"
            min={MIN_STAMPS}
            max={MAX_STAMPS}
            value={maxStamps}
            onChange={(event) => {
              setMaxStamps(Number(event.target.value));
              setSaved(false);
            }}
            className="numeral field mt-3 max-w-[8rem] text-[1.125rem] font-semibold"
          />
        </div>

        <div>
          <p className="text-[0.9375rem] font-semibold text-on-surface">{t.settingsThemeLabel}</p>
          <p className="mt-1 text-[0.8125rem] text-on-surface/50">{t.settingsThemeBody}</p>
          <div className="mt-3 flex gap-2.5">
            <Toggle
              active={themeValue === "dark"}
              label={t.settingsThemeDark}
              onClick={() => {
                setThemeValue("dark");
                setSaved(false);
              }}
            />
            <Toggle
              active={themeValue === "light"}
              label={t.settingsThemeLight}
              onClick={() => {
                setThemeValue("light");
                setSaved(false);
              }}
            />
          </div>
        </div>

        <div>
          <p className="text-[0.9375rem] font-semibold text-on-surface">{t.settingsCardStyleLabel}</p>
          <p className="mt-1 text-[0.8125rem] text-on-surface/50">{t.settingsCardStyleBody}</p>
          <div className="mt-3 flex gap-2.5">
            <Toggle
              active={cardStyleValue === "digital"}
              label={t.settingsCardStyleDigital}
              onClick={() => {
                setCardStyleValue("digital");
                setSaved(false);
              }}
            />
            <Toggle
              active={cardStyleValue === "real"}
              label={t.settingsCardStyleReal}
              onClick={() => {
                setCardStyleValue("real");
                setSaved(false);
              }}
            />
          </div>
        </div>

        <div>
          <p className="text-[0.9375rem] font-semibold text-on-surface">{t.settingsBackgroundLabel}</p>
          <p className="mt-1 text-[0.8125rem] text-on-surface/50">{t.settingsBackgroundBody}</p>
          <div className="mt-3 flex gap-2.5">
            <Toggle
              active={cardBackgroundValue === "lima"}
              label={t.settingsBackgroundLima}
              onClick={() => {
                setCardBackgroundValue("lima");
                setSaved(false);
              }}
            />
            <Toggle
              active={cardBackgroundValue === "blanco"}
              label={t.settingsBackgroundBlanco}
              onClick={() => {
                setCardBackgroundValue("blanco");
                setSaved(false);
              }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="default-locale" className="text-[0.9375rem] font-semibold text-on-surface">
            {t.settingsLocaleLabel}
          </label>
          <p className="mt-1 text-[0.8125rem] text-on-surface/50">{t.settingsLocaleBody}</p>
          <select
            id="default-locale"
            value={localeValue}
            onChange={(event) => {
              setLocaleValue(event.target.value as Locale);
              setSaved(false);
            }}
            className="field mt-3 max-w-[11rem]"
          >
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {LOCALE_LABEL[locale]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || maxStamps < MIN_STAMPS || maxStamps > MAX_STAMPS}
            className="btn bg-lime px-6 py-3 text-[0.9375rem] font-bold text-ink disabled:opacity-40"
          >
            {saving ? t.settingsSaving : t.settingsSave}
          </button>
          {saved ? <span className="text-[0.8125rem] text-lime">{t.settingsSaved}</span> : null}
          {error ? <span className="text-[0.8125rem] text-coral">{t.settingsError}</span> : null}
        </div>
      </form>

      <LogoUploader t={t} logoUrl={logoUrl} />
    </div>
  );
}

function Toggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`btn flex-1 px-4 py-2.5 text-[0.8125rem] font-semibold transition-colors ${
        active ? "bg-lime text-ink" : "glass-dark text-on-surface/60 hover:text-on-surface"
      }`}
    >
      {label}
    </button>
  );
}

function LogoUploader({ t, logoUrl }: { t: AdminDict; logoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(logoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(false);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const response = await fetch("/api/admin/settings/logo", { method: "POST", body: formData });
      if (response.ok) {
        const data = (await response.json()) as { logoUrl: string };
        setPreview(data.logoUrl);
        router.refresh();
      } else {
        setError(true);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/admin/settings/logo", { method: "DELETE" });
      if (response.ok) {
        setPreview(null);
        router.refresh();
      } else {
        setError(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-dark flex flex-col gap-4 p-6">
      <div>
        <p className="text-[0.9375rem] font-semibold text-on-surface">{t.settingsLogoLabel}</p>
        <p className="mt-1 text-[0.8125rem] text-on-surface/50">{t.settingsLogoBody}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-2">
          {preview ? (
            // El logo viene de Supabase Storage -una URL externa que cambia por
            // local-: no vale la pena pagar la configuración de dominios
            // remotos de next/image por una miniatura de 64px.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="eyebrow text-center text-[0.5625rem] text-on-surface/25">{t.settingsLogoEmpty}</span>
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <label className="btn glass-dark cursor-pointer px-4 py-2.5 text-[0.8125rem] font-semibold text-on-surface">
            {busy ? t.settingsLogoUploading : t.settingsLogoUpload}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => void handleFile(event)}
              disabled={busy}
              className="hidden"
            />
          </label>
          {preview ? (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={busy}
              className="text-[0.75rem] font-semibold text-coral underline disabled:opacity-40"
            >
              {t.settingsLogoRemove}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <span className="text-[0.8125rem] text-coral">{t.settingsError}</span> : null}
    </div>
  );
}
