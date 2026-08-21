"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type BaristaDict = Dict["barista"];

/**
 * PIN de cuatro dígitos para las dos acciones que regalan producto.
 *
 * No protege el sellado —eso tiene que seguir siendo un gesto sin fricción—,
 * solo el café gratis y el canje de invitación, que es donde el fraude
 * tendría sentido. Teclado propio y grande: en barra se pulsa con el pulgar
 * y sin mirar.
 */
export function PinPad({
  t,
  wrong,
  busy,
  onSubmit,
  onCancel,
}: {
  t: BaristaDict;
  wrong: boolean;
  busy: boolean;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");

  function push(digit: string) {
    if (busy) return;
    const next = `${pin}${digit}`.slice(0, 4);
    setPin(next);
    if (next.length === 4) onSubmit(next);
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto aurora-night text-chalk">
      <div className="flex flex-1 flex-col items-center justify-center gap-7 px-8 py-6">
        <p className="eyebrow text-chalk/45">{t.confirmPin}</p>

        <div className="flex gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "size-3.5 rounded-full transition-colors",
                i < pin.length ? "bg-lime" : "bg-white/15",
              )}
            />
          ))}
        </div>

        <p
          className={cn(
            "text-[0.9375rem] font-medium",
            wrong ? "text-coral" : "text-chalk/40",
          )}
        >
          {wrong ? t.pinWrong : t.pinHint}
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-[26rem] shrink-0 grid-cols-3 gap-2.5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <Key key={digit} onClick={() => push(digit)}>
            {digit}
          </Key>
        ))}
        <Key onClick={onCancel} muted label={t.cancel}>
          ✕
        </Key>
        <Key onClick={() => push("0")}>0</Key>
        <Key onClick={() => setPin((p) => p.slice(0, -1))} muted label={t.backspace}>
          ⌫
        </Key>
      </div>
    </div>
  );
}

function Key({
  children,
  onClick,
  muted,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "btn numeral rounded-[var(--radius-field)] py-5 text-[1.5rem] font-semibold",
        muted ? "text-chalk/45" : "bg-ink-2 text-chalk",
      )}
    >
      {children}
    </button>
  );
}
