"use client";

import { useEffect } from "react";

/**
 * Marca la invitación como abierta desde el navegador, no en el render.
 *
 * WhatsApp descarga el enlace para montar la vista previa del mensaje: si
 * esto se hiciera en el GET de la página, cada envío contaría como apertura
 * e inflaría la métrica que separa las puertas P1 y P2.
 */
export function MarkOpened({ code }: { code: string }) {
  useEffect(() => {
    void fetch("/api/invite/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
      keepalive: true,
    }).catch(() => undefined);
  }, [code]);

  return null;
}
