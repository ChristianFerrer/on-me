"use client";

import { useCallback, useRef, useState } from "react";
import type { IdentifyApplyResult, IdentifyResult } from "@/lib/identify-service";
import { AUTOCLOSE_MS } from "./Verdict";

export type IdentifyProfile = Extract<IdentifyResult, { kind: "profile" }>;

export type IdentifyPhase =
  | { step: "scanning" }
  | { step: "identifying" }
  | { step: "profile"; profile: IdentifyProfile }
  // Se lleva el perfil consigo -no solo el id- para que el panel siga
  // pintando nombre/sellos/canje mientras espera respuesta, en vez de
  // desaparecer y dejar un hueco en blanco.
  | { step: "applying"; profile: IdentifyProfile }
  | { step: "pin"; wrong: boolean; busy: boolean }
  | { step: "result"; result: IdentifyApplyResult };

/**
 * Máquina de estados propia del flujo identificador -aparte de
 * useScanFlow.ts a propósito-: escanear solo resuelve quién es, el perfil
 * deja elegir sellos y canje, y solo entonces se aplica -con PIN si toca
 * canjear algo-. Comparte piezas de servidor con el flujo clásico
 * (lib/scan.ts, lib/scan-service.ts), pero no este hook: así un cambio
 * pensado para este flujo no puede arrastrar al otro.
 */
export function useIdentifyFlow(pinRequired: boolean) {
  const [phase, setPhase] = useState<IdentifyPhase>({ step: "scanning" });
  const applyPayloadRef = useRef<{
    customerId: string;
    addStamps: number;
    redeemCount: number;
  } | null>(null);
  const busyRef = useRef(false);

  const buzz = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const reset = useCallback(() => {
    applyPayloadRef.current = null;
    busyRef.current = false;
    setPhase({ step: "scanning" });
  }, []);

  /** Enseña el resultado final y lo cierra solo, igual que useScanFlow.ts. */
  const showResult = useCallback(
    (result: IdentifyApplyResult) => {
      setPhase({ step: "result", result });
      window.setTimeout(reset, AUTOCLOSE_MS);
    },
    [reset],
  );

  const identify = useCallback(
    async (token: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setPhase({ step: "identifying" });

      try {
        const response = await fetch("/api/scan/identify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          buzz([40, 60, 40]);
          showResult({ kind: "invalid", reason: "unknown_token" });
          return;
        }

        const data = (await response.json()) as IdentifyResult;
        if (data.kind === "invalid") {
          buzz([40, 60, 40]);
          showResult(data);
          return;
        }

        buzz(30);
        setPhase({ step: "profile", profile: data });
      } catch {
        buzz([40, 60, 40]);
        showResult({ kind: "invalid", reason: "network" });
      } finally {
        busyRef.current = false;
      }
    },
    [buzz, showResult],
  );

  const postApply = useCallback(
    async (pin?: string) => {
      const payload = applyPayloadRef.current;
      if (!payload) return reset();

      try {
        const response = await fetch("/api/scan/identify/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, pin }),
        });

        if (response.status === 403) {
          const data: unknown = await response.json().catch(() => null);
          const error = (data as { error?: string } | null)?.error;
          const wrong = error === "pin_wrong";
          if (wrong) buzz([40, 60, 40]);
          setPhase({ step: "pin", wrong, busy: false });
          return;
        }

        if (!response.ok) {
          buzz([40, 60, 40]);
          showResult({ kind: "invalid", reason: "unknown_token" });
          return;
        }

        buzz(30);
        showResult((await response.json()) as IdentifyApplyResult);
      } catch {
        buzz([40, 60, 40]);
        showResult({ kind: "invalid", reason: "network" });
      }
    },
    [buzz, reset, showResult],
  );

  const apply = useCallback(
    (profile: IdentifyProfile, addStamps: number, redeemCount: number) => {
      applyPayloadRef.current = { customerId: profile.customerId, addStamps, redeemCount };

      // Si de verdad va a canjear algo y este dispositivo tiene PIN, mejor
      // pedirlo ya -sin gastar un viaje al servidor solo para que conteste
      // que hace falta-, igual que confirm() en useScanFlow.ts.
      if (redeemCount > 0 && pinRequired) {
        setPhase({ step: "pin", wrong: false, busy: false });
        return;
      }

      setPhase({ step: "applying", profile });
      void postApply();
    },
    [pinRequired, postApply],
  );

  const confirmPin = useCallback(
    (pin: string) => {
      setPhase((current) => (current.step === "pin" ? { ...current, busy: true } : current));
      void postApply(pin);
    },
    [postApply],
  );

  return { phase, identify, apply, confirmPin, reset };
}
