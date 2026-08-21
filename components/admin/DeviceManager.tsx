"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import type { DeviceListItem } from "@/lib/devices";
import { fill, formatDateTime, type Dict, type Locale } from "@/lib/i18n";

type AdminDict = Dict["admin"];

/**
 * Alta y gestión de dispositivos de barra, desde el propio panel.
 *
 * Antes había que insertar la fila a mano en Supabase: sin eso no hay
 * enlace que dar al iPad de la barra. El token es texto plano en la base
 * —es la llave de alta, no una contraseña— así que se puede volver a ver
 * en cualquier momento, no solo al crear el dispositivo.
 */
export function DeviceManager({
  t,
  devices,
  baseUrl,
  locale,
}: {
  t: AdminDict;
  devices: DeviceListItem[];
  baseUrl: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createDevice(event: React.FormEvent) {
    event.preventDefault();
    if (creating || !name.trim()) return;

    setCreating(true);
    try {
      const response = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (response.ok) {
        setName("");
        router.refresh();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={createDevice} className="flex gap-2.5">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t.deviceNamePlaceholder}
          aria-label={t.newDevice}
          className="field flex-1"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="btn shrink-0 gap-1.5 bg-lime px-5 text-[0.9375rem] text-ink disabled:opacity-40"
        >
          <PlusIcon className="size-4" />
          {creating ? t.creating : t.createDevice}
        </button>
      </form>

      {devices.length === 0 ? (
        <p className="text-[0.9375rem] text-chalk/45">{t.noDevices}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {devices.map((device) => (
            <DeviceRow
              key={device.id}
              t={t}
              device={device}
              baseUrl={baseUrl}
              locale={locale}
              onChanged={() => router.refresh()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DeviceRow({
  t,
  device,
  baseUrl,
  locale,
  onChanged,
}: {
  t: AdminDict;
  device: DeviceListItem;
  baseUrl: string;
  locale: Locale;
  onChanged: () => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const link = `${baseUrl}/s/${device.token}`;

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function revoke() {
    if (busy || !window.confirm(t.confirmRevoke)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/devices/${device.id}/revoke`, {
        method: "POST",
      });
      if (response.ok) onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="glass-dark rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[1.0625rem] font-semibold">{device.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-chalk/45">
            <span
              className={cn(
                "size-1.5 rounded-full",
                device.hasActiveSession ? "bg-lime" : "bg-chalk/25",
              )}
            />
            {device.hasActiveSession ? t.online : t.offline}
            {device.lastSeenAt
              ? ` · ${fill(t.lastSeen, { t: formatDateTime(device.lastSeenAt, locale) })}`
              : ""}
          </p>
        </div>
        <span
          className={cn(
            "eyebrow shrink-0 rounded-full px-2.5 py-1",
            device.hasPin ? "bg-white/8 text-chalk/50" : "bg-amber/15 text-amber",
          )}
        >
          {device.hasPin ? t.pinSet : t.noPin}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => setLinkOpen((value) => !value)}
          className="btn bg-ink-2 px-4 py-3 text-[0.8125rem] text-chalk"
        >
          {linkOpen ? t.hideLink : t.viewLink}
        </button>
        <button
          type="button"
          onClick={() => setPinOpen((value) => !value)}
          className="btn bg-ink-2 px-4 py-3 text-[0.8125rem] text-chalk"
        >
          {device.hasPin ? t.changePin : t.setPin}
        </button>
        {device.hasActiveSession ? (
          <button
            type="button"
            onClick={() => void revoke()}
            disabled={busy}
            className="btn bg-coral/15 px-4 py-3 text-[0.8125rem] text-coral disabled:opacity-40"
          >
            {t.revoke}
          </button>
        ) : null}
      </div>

      {linkOpen ? (
        <div className="mt-4 flex flex-col items-center gap-4 rounded-xl bg-ink-2 p-4 text-center sm:flex-row sm:text-left">
          <DeviceQr value={link} />
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] text-chalk/45">{t.deviceLinkHint}</p>
            <p className="mt-1.5 break-all text-[0.8125rem] font-medium text-chalk/80">
              {link}
            </p>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="btn mt-3 gap-1.5 bg-lime px-4 py-2 text-[0.8125rem] text-ink"
            >
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              {copied ? t.copied : t.copyLink}
            </button>
          </div>
        </div>
      ) : null}

      {pinOpen ? (
        <PinForm
          t={t}
          deviceId={device.id}
          hasPin={device.hasPin}
          onDone={() => {
            setPinOpen(false);
            onChanged();
          }}
        />
      ) : null}
    </li>
  );
}

function PinForm({
  t,
  deviceId,
  hasPin,
  onDone,
}: {
  t: AdminDict;
  deviceId: string;
  hasPin: boolean;
  onDone: () => void;
}) {
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || pin.length !== 4) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/devices/${deviceId}/pin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (response.ok) onDone();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/devices/${deviceId}/pin`, {
        method: "DELETE",
      });
      if (response.ok) onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="mt-4 flex flex-wrap items-center gap-2.5 rounded-xl bg-ink-2 p-4"
    >
      <div className="relative">
        <input
          ref={pinInputRef}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          onFocus={() => {
            // En móvil el teclado en pantalla puede tapar el campo si el
            // dispositivo está al final de una lista larga: sin este empujón
            // el navegador no siempre lo sube por encima del teclado solo.
            window.setTimeout(
              () => pinInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
              300,
            );
          }}
          type={show ? "text" : "password"}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t.pinPlaceholder}
          aria-label={t.pin}
          className="numeral field w-40 py-2.5 pr-11 text-center text-[1.125rem] tracking-[0.3em]"
        />
        <button
          type="button"
          onClick={() => setShow((value) => !value)}
          aria-label={show ? t.hidePassword : t.showPassword}
          className="absolute inset-y-0 right-1 flex items-center px-2 text-chalk/45 hover:text-chalk"
        >
          {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
      <p className="text-[0.75rem] text-chalk/40">{t.pinHint}</p>

      <div className="ml-auto flex gap-2">
        {hasPin ? (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="btn gap-1.5 bg-coral/15 px-3 py-2 text-[0.8125rem] text-coral disabled:opacity-40"
          >
            <TrashIcon className="size-4" />
            {t.removePin}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy || pin.length !== 4}
          className="btn bg-lime px-4 py-2 text-[0.8125rem] text-ink disabled:opacity-40"
        >
          {hasPin ? t.changePin : t.setPin}
        </button>
      </div>
    </form>
  );
}

/** QR generado en el navegador: es la única forma de llevar el enlace a la cámara del propio dispositivo. */
function DeviceQr({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("qrcode").then((QRCode) =>
      QRCode.toDataURL(value, {
        margin: 0,
        color: { dark: "#0e1211", light: "#ffffff" },
      }).then((url) => {
        if (!cancelled) setSrc(url);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!src) {
    return <div className="size-24 shrink-0 rounded-lg bg-white/10" />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={96} height={96} className="size-24 shrink-0 rounded-lg" />;
}
