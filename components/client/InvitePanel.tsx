"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Glass, Slab } from "@/components/ui/Screen";
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
  initialInvites,
  canCreateInvite,
}: {
  t: InviteDict;
  shopName: string;
  initialInvites: Invite[];
  canCreateInvite: boolean;
}) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/invite/create", { method: "POST" });
      if (response.ok) {
        const invite = (await response.json()) as Invite;
        setInvites((current) => [invite, ...current]);
      }
    } finally {
      setBusy(false);
    }
  }

  if (invites.length === 0 && !canCreateInvite) {
    return (
      <Glass className="p-6">
        <p className="text-[1.0625rem] font-semibold leading-snug">
          {t.quotaTitle}
        </p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink/55">
          {t.quotaBody}
        </p>
      </Glass>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {invites.map((invite) => (
        <InviteCard key={invite.code} t={t} shopName={shopName} invite={invite} />
      ))}

      {canCreateInvite ? (
        <Button tone="ink" size="lg" disabled={busy} onClick={() => void create()}>
          {busy ? t.generating : t.generate}
          <span className="size-2 rounded-full bg-lime" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Una invitación activa, con sus propios estados de copiado/enviado -no
 * compartidos con las demás, si el padrino tiene varias a la vez-.
 */
function InviteCard({
  t,
  shopName,
  invite,
}: {
  t: InviteDict;
  shopName: string;
  invite: Invite;
}) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  function markSent() {
    setSent(true);
    void fetch("/api/invite/sent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: invite.code }),
      keepalive: true,
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Sin permiso de portapapeles queda el enlace visible para copiarlo. */
    }
  }

  const message = fill(t.waMessage, { shop: shopName, url: invite.url });
  const waHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="flex flex-col gap-3">
      <Slab className="px-6 py-8 text-center">
        <p className="eyebrow text-chalk/65">{t.yourCode}</p>
        <p className="code mt-3 text-[2.25rem] text-lime">{invite.code}</p>
      </Slab>

      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        onClick={markSent}
        className="btn w-full bg-ink px-6 py-4.5 text-[1.0625rem] text-chalk"
      >
        {sent ? t.sent : t.sendWhatsapp}
        <span className="size-2 rounded-full bg-lime" aria-hidden />
      </a>

      <Button tone="ghost" size="md" onClick={() => void copy()}>
        {copied ? t.copied : t.copyLink}
      </Button>

      <p className="break-all px-2 text-center text-[0.75rem] text-ink/40">
        {invite.url}
      </p>
    </div>
  );
}
