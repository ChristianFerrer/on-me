"use client";

import { notFound } from "next/navigation";
import { GateCard } from "@/components/admin/GateCard";
import { PinPad } from "@/components/barista/PinPad";
import { Verdict } from "@/components/barista/Verdict";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Sheet } from "@/components/ui/Screen";
import { StampCard } from "@/components/ui/StampCard";
import { evaluateGate } from "@/lib/attribution";
import { es } from "@/lib/i18n/dictionaries";
import type { ScanResponse } from "@/lib/scan";

/**
 * Hoja de estilo viva, solo para revisar el sistema visual sin base de datos.
 * No se enlaza desde ningún sitio y no forma parte del producto.
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
  {
    title: "café gratis",
    result: { kind: "redeem_reward", name: "Marta", pending: true },
  },
  {
    title: "cliente nuevo",
    result: {
      kind: "redeem_invitation",
      name: "Youssef",
      padrino: "Marta",
      pending: true,
    },
  },
  {
    title: "duplicado",
    result: { kind: "duplicate", minutesAgo: 2 },
  },
  {
    title: "no válido",
    result: { kind: "invalid", reason: "other_shop" },
  },
];

/** `transform` hace que los hijos `fixed` se anclen a esta caja y no al viewport. */
function Phone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <div
        className="riso-lg relative h-[500px] w-[240px] overflow-hidden rounded-[2rem] border-2 border-ink"
        style={{ transform: "translateZ(0)" }}
      >
        {children}
      </div>
      <figcaption className="overline text-ink-faint">{label}</figcaption>
    </figure>
  );
}

export default function PreviewPage() {
  // Herramienta de desarrollo: en producción esta ruta no existe.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo size="lg" tagline={t.brand.tagline} />
        <h1 className="display-tight text-[3.5rem]">riso mediterráneo</h1>
      </header>

      <section className="flex flex-col gap-4">
        <p className="overline text-ink-faint">tintas</p>
        <ul className="flex flex-wrap gap-3">
          {[
            ["azafrán", "bg-saffron"],
            ["tomate", "bg-tomato"],
            ["jade", "bg-jade"],
            ["cobalto", "bg-cobalt"],
            ["fucsia", "bg-fuchsia"],
            ["humo", "bg-smoke"],
            ["tinta", "bg-ink"],
            ["papel", "bg-paper-deep"],
          ].map(([name, ink]) => (
            <li key={name} className="flex flex-col gap-1.5">
              <span
                className={`riso-sm block size-20 rounded-2xl border-2 border-ink ${ink}`}
              />
              <span className="overline text-ink-faint">{name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <p className="overline text-ink-faint">resultado en barra</p>
        <div className="flex flex-wrap gap-6">
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

      <section className="flex flex-col gap-4">
        <p className="overline text-ink-faint">tarjeta</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Sheet className="bg-paper-deep p-6" tint="var(--color-cobalt)">
            <p className="overline text-ink-faint">The Madness</p>
            <h2 className="display-tight numeral mt-2 text-[3.4rem]">
              7<span className="text-ink-faint">/10</span>
            </h2>
            <p className="mt-1 text-[1.05rem] font-semibold text-ink-soft">
              te quedan 3
            </p>
            <StampCard stamps={7} goal={10} className="mt-5" />
          </Sheet>

          <Sheet className="bg-saffron p-6" tint="var(--color-tomato)">
            <span
              aria-hidden
              className="halftone halftone-lg absolute -right-10 -top-10 size-40 rounded-full text-ink"
            />
            <p className="overline text-ink/60">The Madness</p>
            <h2 className="display-tight mt-2 text-[2.8rem]">tu café es gratis</h2>
            <p className="mt-3 text-[1rem] font-medium leading-snug">
              {t.card.rewardBody}
            </p>
          </Sheet>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <p className="overline text-ink-faint">puertas del piloto</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <GateCard gate={evaluateGate("p1", 24, 41, 0.4, 20)} label={t.admin.gate1} t={t.admin} />
          <GateCard gate={evaluateGate("p2", 4, 24, 0.25, 20)} label={t.admin.gate2} t={t.admin} />
          <GateCard gate={evaluateGate("p3", 2, 7, 0.3, 10)} label={t.admin.gate3} t={t.admin} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <p className="overline text-ink-faint">controles</p>
        <div className="grid max-w-sm gap-3">
          <Button tone="tomato" size="xl">
            {t.join.submit}
          </Button>
          <Button tone="jade">{t.barista.stampAction}</Button>
          <Button tone="cobalt">{t.guest.claim}</Button>
          <Button tone="ghost" size="md">
            {t.invite.copyLink}
          </Button>
          <input className="field" placeholder={t.join.namePlaceholder} />
        </div>
      </section>
    </main>
  );
}
