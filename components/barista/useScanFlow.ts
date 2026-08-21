"use client";

import { useCallback, useRef, useState } from "react";
import type { ScanResponse } from "@/lib/scan";
import { AUTOCLOSE_MS } from "./Verdict";

export type ScanPhase =
  | { step: "idle" }
  | { step: "sending" }
  | { step: "result"; result: ScanResponse }
  | { step: "pin"; wrong: boolean; busy: boolean };

/**
 * Máquina de estados de un escaneo, compartida por la cámara y por el
 * sellado manual desde la ficha del cliente. Ambas hacen exactamente lo
 * mismo —enviar, enseñar resultado, confirmar con PIN si toca— y solo
 * cambian el endpoint y la carga útil.
 */
export function useScanFlow(options: {
  endpoint: string;
  pinRequired: boolean;
  /** Se llama al volver al estado de reposo, para reactivar la cámara. */
  onReset?: () => void;
}) {
  const { endpoint, pinRequired, onReset } = options;

  const [phase, setPhase] = useState<ScanPhase>({ step: "idle" });
  const payloadRef = useRef<Record<string, unknown> | null>(null);
  const busyRef = useRef(false);

  const reset = useCallback(() => {
    payloadRef.current = null;
    busyRef.current = false;
    setPhase({ step: "idle" });
    onReset?.();
  }, [onReset]);

  const buzz = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const show = useCallback(
    (result: ScanResponse) => {
      const pending =
        (result.kind === "redeem_reward" || result.kind === "redeem_invitation") &&
        result.pending;

      buzz(
        result.kind === "invalid" || result.kind === "duplicate"
          ? [40, 60, 40]
          : 30,
      );
      setPhase({ step: "result", result });

      // Lo que regala producto se queda hasta que el barista actúa.
      if (!pending) window.setTimeout(reset, AUTOCLOSE_MS);
    },
    [buzz, reset],
  );

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.status === 403) {
          const data: unknown = await response.json().catch(() => null);
          const error = (data as { error?: string } | null)?.error;
          setPhase({ step: "pin", wrong: error === "pin_wrong", busy: false });
          return;
        }

        if (response.status === 401) {
          // La sesión del dispositivo se revocó a media jornada: sin esto se
          // ve idéntico a un QR roto y nadie entiende por qué deja de sellar.
          show({ kind: "invalid", reason: "device" });
          return;
        }

        if (!response.ok) {
          show({ kind: "invalid", reason: "unknown_token" });
          return;
        }

        show((await response.json()) as ScanResponse);
      } catch {
        // Se cayó la red a mitad de gesto. Es un caso real en un sótano.
        show({ kind: "invalid", reason: "network" });
      }
    },
    [endpoint, show],
  );

  const submit = useCallback(
    async (payload: Record<string, unknown>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      payloadRef.current = payload;
      setPhase({ step: "sending" });
      await post(payload);
    },
    [post],
  );

  const confirm = useCallback(
    async (pin?: string) => {
      const payload = payloadRef.current;
      if (!payload) return reset();

      if (pinRequired && !pin) {
        setPhase({ step: "pin", wrong: false, busy: false });
        return;
      }

      setPhase((current) =>
        current.step === "pin" ? { ...current, busy: true } : { step: "sending" },
      );

      await post({ ...payload, confirm: true, pin });
    },
    [pinRequired, post, reset],
  );

  return { phase, submit, confirm, reset };
}
