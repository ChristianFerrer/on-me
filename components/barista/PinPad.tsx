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
    <div className="verdict verdict-smoke grain grain-light flex-col justify-end">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-7">
        <p className="overline text-paper/80">{t.confirmPin}</p>

        <div className="flex gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "size-5 rounded-full border-2 border-paper",
                i < pin.length && "bg-paper",
              )}
            />
          ))}
        </div>

        <p className={cn("text-[1.05rem] font-semibold", wrong ? "text-tomato" : "opacity-70")}>
          {wrong ? t.pinWrong : t.pinHint}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <Key key={digit} onClick={() => push(digit)}>
            {digit}
          </Key>
        ))}
        <Key onClick={onCancel} muted>
          ✕
        </Key>
        <Key onClick={() => push("0")}>0</Key>
        <Key onClick={() => setPin((p) => p.slice(0, -1))} muted>
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "numeral btn-press rounded-2xl border-2 border-ink py-5 text-[1.6rem] font-semibold",
        muted ? "bg-transparent text-paper" : "bg-paper text-ink riso-sm",
      )}
    >
      {children}
    </button>
  );
}
