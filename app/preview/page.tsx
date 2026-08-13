"use client";

import { notFound } from "next/navigation";
import { GateCard } from "@/components/admin/GateCard";
import { PinPad } from "@/components/barista/PinPad";
import { Verdict } from "@/components/barista/Verdict";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { StampCard } from "@/components/ui/StampCard";
import { evaluateGate } from "@/lib/attribution";
import { es } from "@/lib/i18n/dictionaries";
import type { ScanResponse } from "@/lib/scan";

/**
 * Hoja de estilo viva, solo para revisar el sistema visual sin base de datos.
 * No se enlaza desde ningún sitio y devuelve 404 en producción.
 */

const t = es;

const VERDICTS: { title: string; result: ScanResponse }[] = [
  {
    title: "sello",
    result: { kind: "stamp", name: "Marta", stamps: 5, goal: 10, cardCompleted: false },
  },
  {
    title: "tarjeta completa",
    result: { kind: "stamp", name: "Marta", stamps: 10, goal: 10, cardCompleted: true },
  },
  { title: "café gratis", result: { kind: "redeem_reward", name: "Marta", pending: true } },
  {
    title: "cliente nuevo",
    result: { kind: "redeem_invitation", name: "Youssef", padrino: "Marta", pending: true },
  },
  { title: "duplicado", result: { kind: "duplicate", minutesAgo: 2 } },
  { title: "no válido", result: { kind: "invalid", reason: "other_shop" } },
];

/** `transform` hace que los hijos `fixed` se anclen a esta caja, no al viewport. */
function Phone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="flex flex-col gap-2.5">
      <div
        className="relative h-[470px] w-[228px] overflow-hidden rounded-[2.25rem] ring-1 ring-black/10"
        style={{ transform: "translateZ(0)" }}
      >
        {children}
      </div>
      <figcaption className="eyebrow text-ink/40">{label}</figcaption>
    </figure>
  );
}

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-16 px-8 py-16">
      <header className="flex flex-col gap-6">
        <Logo size="lg" />
        <h1 className="display-tight text-[3.25rem]">sistema minimalista</h1>
        <div className="aurora h-40 w-full rounded-[var(--radius-card)]" />
      </header>

      <section className="flex flex-col gap-5">
        <p className="eyebrow text-ink/40">acentos</p>
        <ul className="flex flex-wrap gap-3">
          {[
            ["lima", "bg-lime"],
            ["ámbar", "bg-amber"],
            ["azul", "bg-azure"],
            ["coral", "bg-coral"],
            ["grafito", "bg-ink"],
            ["tiza", "bg-chalk ring-1 ring-black/10"],
          ].map(([name, ink]) => (
            <li key={name} className="flex flex-col gap-2">
              <span className={`block size-20 rounded-2xl ${ink}`} />
              <span className="eyebrow text-ink/40">{name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-5">
        <p className="eyebrow text-ink/40">resultado en barra</p>
        <div className="flex flex-wrap gap-7">
          {VERDICTS.map((entry) => (
            <Phone key={entry.title} label={entry.title}>
              <Verdict
                result={entry.result}
                t={t.barista}
                onClose={() => undefined}
                onConfirm={() => undefined}
              />
            </Phone>
          ))}
          <Phone label="pin de canje">
            <PinPad
              t={t.barista}
              wrong={false}
              busy={false}
              onSubmit={() => undefined}
              onCancel={() => undefined}
            />
          </Phone>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <p className="eyebrow text-ink/40">tarjeta</p>
        <div className="aurora grid gap-5 rounded-[var(--radius-card)] p-6 sm:grid-cols-2">
          <div className="slab p-7">
            <p className="eyebrow text-chalk/40">The Madness</p>
            <p className="display-tight numeral mt-5 text-[3.25rem]">
              7<span className="text-chalk/30">/10</span>
            </p>
            <p className="mt-1 text-[0.9375rem] font-medium text-chalk/55">
              te quedan 3
            </p>
            <StampCard stamps={7} goal={10} tone="dark" className="mt-7" />
          </div>

          <div className="slab p-7">
            <p className="eyebrow text-chalk/40">The Madness</p>
            <h2 className="display-tight mt-5 text-[2.5rem] text-lime">
              tu café es gratis
            </h2>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-chalk/60">
              {t.card.rewardBody}
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <p className="eyebrow text-ink/40">puertas del piloto</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <GateCard gate={evaluateGate("p1", 24, 43, 0.4, 20)} label={t.admin.gate1} t={t.admin} />
          <GateCard gate={evaluateGate("p2", 4, 24, 0.25, 20)} label={t.admin.gate2} t={t.admin} />
          <GateCard gate={evaluateGate("p3", 2, 4, 0.3, 10)} label={t.admin.gate3} t={t.admin} />
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <p className="eyebrow text-ink/40">controles</p>
        <div className="aurora grid max-w-sm gap-3 rounded-[var(--radius-card)] p-6">
          <Button tone="ink">
            {t.join.submit}
            <span className="size-2 rounded-full bg-lime" aria-hidden />
          </Button>
          <Button tone="lime">{t.barista.stampAction}</Button>
          <Button tone="ghost" size="md">
            {t.invite.copyLink}
          </Button>
          <input className="field" placeholder={t.join.namePlaceholder} />
        </div>
      </section>
    </main>
  );
}
