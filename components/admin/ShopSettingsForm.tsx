"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];

const MIN_STAMPS = 1;
const MAX_STAMPS = 20;

/**
 * Ajustes del local que hoy son solo uno -el tope de sellos del flujo
 * identificador-, pero viven en su propia página para no tener que crear
 * una cuando haga falta el segundo.
 */
export function ShopSettingsForm({
  t,
  maxStampsPerScan,
}: {
  t: AdminDict;
  maxStampsPerScan: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(maxStampsPerScan);
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
        body: JSON.stringify({ maxStampsPerScan: value }),
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
    <form onSubmit={save} className="glass-dark flex max-w-md flex-col gap-4 p-6">
      <div>
        <label htmlFor="max-stamps" className="text-[0.9375rem] font-semibold text-chalk">
          {t.settingsMaxStampsLabel}
        </label>
        <p className="mt-1 text-[0.8125rem] text-chalk/50">{t.settingsMaxStampsBody}</p>
        <input
          id="max-stamps"
          type="number"
          inputMode="numeric"
          min={MIN_STAMPS}
          max={MAX_STAMPS}
          value={value}
          onChange={(event) => {
            setValue(Number(event.target.value));
            setSaved(false);
          }}
          className="numeral field mt-3 max-w-[8rem] text-[1.125rem] font-semibold"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || value < MIN_STAMPS || value > MAX_STAMPS}
          className="btn bg-lime px-6 py-3 text-[0.9375rem] font-bold text-ink disabled:opacity-40"
        >
          {saving ? t.settingsSaving : t.settingsSave}
        </button>
        {saved ? <span className="text-[0.8125rem] text-lime">{t.settingsSaved}</span> : null}
        {error ? <span className="text-[0.8125rem] text-coral">{t.settingsError}</span> : null}
      </div>
    </form>
  );
}
