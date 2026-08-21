import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ServiceWorker } from "@/components/client/ServiceWorker";
import { resolveLocale } from "@/lib/i18n/server";
import "./globals.css";

/**
 * Una sola familia para todo el producto. La jerarquía sale del tamaño y del
 * peso, no de mezclar tipografías: es lo que mantiene el conjunto callado.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
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
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  // Todas las URLs de OnMe son privadas: tarjetas, invitaciones y panel.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0e1211",
  width: "device-width",
  initialScale: 1,
  // Sin `maximumScale`/`userScalable: false`: desactivaba el pinch-zoom en
  // toda la PWA -incumple WCAG 1.4.4- para evitar un doble-tap accidental,
  // pero `touch-action: manipulation` en `html` (globals.css) ya resuelve
  // eso sin bloquear la ampliación a quien la necesite.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await resolveLocale();

  return (
    <html lang={locale} className={jakarta.variable}>
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
