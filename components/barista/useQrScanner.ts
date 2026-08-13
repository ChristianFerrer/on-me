"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lector de QR con dos motores.
 *
 * 1. `BarcodeDetector` nativo cuando existe (Chrome y Android): decodifica en
 *    el compositor, sin pasar por JavaScript, y es varias veces más rápido.
 * 2. `@zxing/browser` de reserva, que es lo que usará todo iPhone.
 *
 * El presupuesto del piloto son 3 segundos de cámara a resultado. Elegir el
 * motor nativo cuando está disponible es la diferencia entre cumplirlo con
 * holgura o ir justos, así que se prueba primero.
 */

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

export type ScannerStatus = "booting" | "ready" | "no_camera";

export function useQrScanner(options: {
  enabled: boolean;
  onDecode: (value: string) => void;
}) {
  const { enabled, onDecode } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("booting");

  // El callback cambia en cada render; la referencia evita reiniciar la cámara.
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let rafId = 0;
    let zxingControls: { stop: () => void } | null = null;

    async function start() {
      const video = videoRef.current;
      if (!video) return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        if (!stopped) setStatus("no_camera");
        return;
      }

      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* Safari puede rechazar el play automático; el vídeo sigue vivo. */
      }

      if (!stopped) setStatus("ready");

      const Detector = (
        globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
      ).BarcodeDetector;

      if (Detector) {
        const detector = new Detector({ formats: ["qr_code"] });

        const tick = async () => {
          if (stopped) return;
          if (enabledRef.current && video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              const value = codes[0]?.rawValue;
              if (value && !stopped) onDecodeRef.current(value);
            } catch {
              /* Un fotograma ilegible no es un error: sigue el bucle. */
            }
          }
          rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return;
      }

      // Reserva: zxing. Se carga en diferido para no meterlo en el bundle de
      // arranque de quien no lo necesita.
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
        await Promise.all([import("@zxing/browser"), import("@zxing/library")]);

      if (stopped) return;

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      hints.set(DecodeHintType.TRY_HARDER, false);

      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80 });

      zxingControls = await reader.decodeFromVideoElement(video, (result) => {
        if (!result || stopped || !enabledRef.current) return;
        onDecodeRef.current(result.getText());
      });
    }

    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      zxingControls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { videoRef, status };
}
