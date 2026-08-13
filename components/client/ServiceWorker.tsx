"use client";

import { useEffect } from "react";

/**
 * Registra el service worker. Solo en producción: en desarrollo una caché
 * agresiva confunde más de lo que ayuda.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    // Tras la carga, para no competir por ancho de banda con la propia página.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
