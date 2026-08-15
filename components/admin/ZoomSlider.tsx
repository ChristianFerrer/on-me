"use client";

import { useCallback, useRef } from "react";
import { MinusIcon, PlusIcon } from "@/components/ui/Icons";

const TRACK_HEIGHT_PX = 128;
const TRACK_PADDING_PX = 8;
const STEP_FACTOR = 1.25;

/**
 * Control de zoom manual: barra vertical arrastrable con el dedo, más
 * botones +/- para pasos finos. El pellizco de dos dedos y la rueda siguen
 * funcionando igual -esto es un control alternativo, no un reemplazo-,
 * pero uno que no depende de que el gesto multitáctil se reconozca bien en
 * cualquier dispositivo.
 */
export function ZoomSlider({
  scale,
  min,
  max,
  onChange,
  zoomInLabel,
  zoomOutLabel,
  levelLabel,
}: {
  scale: number;
  min: number;
  max: number;
  onChange: (scale: number) => void;
  zoomInLabel: string;
  zoomOutLabel: string;
  levelLabel: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const fraction = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      onChange(min + fraction * (max - min));
    },
    [min, max, onChange],
  );

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromClientY(event.clientY);
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    setFromClientY(event.clientY);
  }

  const fraction = Math.min(1, Math.max(0, (scale - min) / (max - min)));
  const travel = TRACK_HEIGHT_PX - TRACK_PADDING_PX * 2;

  return (
    <div className="pointer-events-auto fixed right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.min(max, scale * STEP_FACTOR))}
        aria-label={zoomInLabel}
        className="btn glass-dark size-9 text-chalk"
      >
        <PlusIcon className="size-4" />
      </button>

      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        role="slider"
        aria-label={levelLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(scale.toFixed(2))}
        className="glass-dark relative w-7 touch-none rounded-full"
        style={{ height: TRACK_HEIGHT_PX }}
      >
        <div
          className="pointer-events-none absolute left-1/2 w-1 -translate-x-1/2 rounded-full bg-white/10"
          style={{ top: TRACK_PADDING_PX, bottom: TRACK_PADDING_PX }}
        />
        <div
          className="pointer-events-none absolute left-1/2 w-1 -translate-x-1/2 rounded-full bg-lime"
          style={{ bottom: TRACK_PADDING_PX, height: fraction * travel }}
        />
        <div
          className="pointer-events-none absolute left-1/2 size-5 -translate-x-1/2 translate-y-1/2 rounded-full bg-chalk shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
          style={{ bottom: TRACK_PADDING_PX + fraction * travel }}
        />
      </div>

      <button
        type="button"
        onClick={() => onChange(Math.max(min, scale / STEP_FACTOR))}
        aria-label={zoomOutLabel}
        className="btn glass-dark size-9 text-chalk"
      >
        <MinusIcon className="size-4" />
      </button>
    </div>
  );
}
