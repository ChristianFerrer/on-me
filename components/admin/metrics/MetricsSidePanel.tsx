"use client";

import { useEffect } from "react";
import { XIcon } from "@/components/ui/Icons";

/**
 * Panel lateral genérico para "ver la lista completa" -padrinos- y "ver los
 * N" -qué hacer hoy-: mismo patrón estructural que ConstelacionSheet
 * (overlay fijo + deslizamiento + botón de cierre), pero sin atarse a un
 * nodo del grafo, así que sirve para cualquier lista larga de esta página.
 */
export function MetricsSidePanel({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-50 flex justify-end"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black transition-opacity duration-200 ease-[var(--ease-out-soft)]"
        style={{ opacity: open ? 0.55 : 0 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="metrics-card relative flex h-full w-full max-w-[26rem] flex-col rounded-none border-y-0 border-r-0 p-5 transition-transform duration-200 ease-[var(--ease-out-soft)]"
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[0.9375rem] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn glass-dark size-8 shrink-0 text-chalk/60 hover:text-chalk"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        <div className="scrollbar-glass mt-4 min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
