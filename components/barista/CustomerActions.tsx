"use client";

import { Button } from "@/components/ui/Button";
import type { Dict } from "@/lib/i18n";
import { PinPad } from "./PinPad";
import { useScanFlow } from "./useScanFlow";
import { Verdict } from "./Verdict";

type BaristaDict = Dict["barista"];

/**
 * Sellado a mano desde la ficha del cliente. Misma máquina de estados que la
 * cámara —incluida la confirmación con PIN— cambiando solo el endpoint, que
 * marca el escaneo como `manual` para poder vigilar cuánto se usa.
 */
export function CustomerActions({
  t,
  customerId,
  pinRequired,
}: {
  t: BaristaDict;
  customerId: string;
  pinRequired: boolean;
}) {
  const { phase, submit, confirm, reset } = useScanFlow({
    endpoint: "/api/scan/manual",
    pinRequired,
  });

  return (
    <>
      <Button
        tone="jade"
        size="xl"
        disabled={phase.step === "sending"}
        onClick={() => void submit({ customerId })}
      >
        {t.stampAction}
      </Button>

      {phase.step === "result" ? (
        <Verdict
          result={phase.result}
          t={t}
          onClose={reset}
          onConfirm={() => void confirm()}
        />
      ) : null}

      {phase.step === "pin" ? (
        <PinPad
          t={t}
          wrong={phase.wrong}
          busy={phase.busy}
          onSubmit={(pin) => void confirm(pin)}
          onCancel={reset}
        />
      ) : null}
    </>
  );
}
