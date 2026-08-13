"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Screen";
import { fill, type Dict } from "@/lib/i18n";

type InviteDict = Dict["invite"];

type Invite = { code: string; url: string };

/**
 * Generación y envío de la invitación.
 *
 * El envío es un enlace `wa.me`, que es gratis. La WhatsApp Business API
 * cuesta dinero y no aporta nada aquí: el mensaje lo manda el padrino desde
 * su propio número, que además es justo lo que le da credibilidad.
 */
export function InvitePanel({
  t,
  shopName,
  initialInvite,
  quotaFull,
  activeCount,
}: {
  t: InviteDict;
  shopName: string;
  initialInvite: Invite | null;
  quotaFull: boolean;
  activeCount: number;
}) {
  const [invite, setInvite] = useState<Invite | null>(initialInvite);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/invite/create", { method: "POST" });
      if (response.ok) setInvite((await response.json()) as Invite);
    } finally {
      setBusy(false);
    }
  }

  function markSent() {
    if (!invite) return;
    setSent(true);
    void fetch("/api/invite/sent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: invite.code }),
      keepalive: true,
    });
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Sin permiso de portapapeles queda el enlace visible para copiarlo a mano. */
    }
  }

  if (!invite) {
    if (quotaFull) {
      return (
        <Sheet className="bg-paper-deep p-5" tint="var(--color-smoke)">
          <p className="text-[1.05rem] font-semibold leading-snug">
            {fill(t.quotaTitle, { n: activeCount })}
          </p>
          <p className="mt-1.5 text-[0.9rem] text-ink-soft">{t.quotaBody}</p>
        </Sheet>
      );
    }

    return (
      <Button tone="tomato" size="xl" disabled={busy} onClick={() => void create()}>
        {busy ? t.generating : t.generate}
      </Button>
    );
  }

  const message = fill(t.waMessage, { shop: shopName, url: invite.url });
  const waHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="flex flex-col gap-4">
      <Sheet className="bg-paper p-6 text-center" tint="var(--color-fuchsia)">
        <p className="overline text-ink-faint">{t.yourCode}</p>
        <p className="numeral mt-2 text-[2.6rem] font-semibold tracking-[0.2em]">
          {invite.code}
        </p>
      </Sheet>

      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        onClick={markSent}
        className="riso btn-press inline-flex w-full items-center justify-center rounded-2xl border-2 border-ink bg-jade px-7 py-5 text-[1.15rem] font-semibold text-ink"
      >
        {sent ? t.sent : t.sendWhatsapp}
      </a>

      <Button tone="ghost" size="md" onClick={() => void copy()}>
        {copied ? t.copied : t.copyLink}
      </Button>

      <p className="break-all text-center text-[0.78rem] text-ink-faint">
        {invite.url}
      </p>
    </div>
  );
}
