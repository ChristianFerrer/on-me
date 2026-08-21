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
  rewardPending,
  invitationPending,
}: {
  t: BaristaDict;
  customerId: string;
  pinRequired: boolean;
  /** La acción real que hará el próximo tap ya no es siempre "sellar a mano"
      -ver BAR-15-: si hay premio o invitación pendientes, el propio servidor
      canjea eso en vez de sellar, así que el botón debe anticiparlo. */
  rewardPending?: boolean;
  invitationPending?: boolean;
}) {
  const { phase, submit, confirm, reset } = useScanFlow({
    endpoint: "/api/scan/manual",
    pinRequired,
  });

  const label = rewardPending
    ? t.stampActionReward
    : invitationPending
      ? t.stampActionInvite
      : t.stampAction;

  return (
    <>
      <Button
        tone="lime"
        size="lg"
        disabled={phase.step === "sending"}
        onClick={() => void submit({ customerId })}
      >
        {label}
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
