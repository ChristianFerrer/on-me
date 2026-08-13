import type { Metadata, Viewport } from "next";
import { Archivo, Fraunces, IBM_Plex_Mono } from "next/font/google";
import { resolveLocale } from "@/lib/i18n/server";
import "./globals.css";

/** Display: serif variable con ejes SOFT y WONK. La voz de la marca. */
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

/** Interfaz: grotesca de trabajo, impecable en español e inglés. */
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

/** Cifras y códigos: mono tabular, porque un código se dicta en voz alta. */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OnMe · invito yo",
  description:
    "Diez cafés, uno gratis, y una invitación para quien tú quieras. / Ten coffees, one free, plus an invite for whoever you like.",
  applicationName: "OnMe",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "OnMe",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf3e4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await resolveLocale();

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${archivo.variable} ${plexMono.variable}`}
    >
      <body className="grain relative min-h-dvh antialiased">{children}</body>
    </html>
  );
}
