import type { MetadataRoute } from "next";

/**
 * La PWA se instala para el cliente, no para el barista: por eso `start_url`
 * es la tarjeta. El escáner vive en un dispositivo del local con la pantalla
 * siempre abierta y no gana nada instalándose.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OnMe · invito yo",
    short_name: "OnMe",
    description:
      "Tu tarjeta de café y una invitación para quien tú quieras. / Your coffee card, plus an invite for whoever you like.",
    start_url: "/c",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf3e4",
    theme_color: "#fbf3e4",
    lang: "es",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
