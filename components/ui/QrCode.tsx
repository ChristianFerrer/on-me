import QRCode from "qrcode";
import { cn } from "@/lib/cn";
import { INK_HEX } from "@/lib/colors";

/**
 * QR renderizado en servidor como SVG en línea.
 *
 * Va incrustado en el HTML a propósito: la tarjeta tiene que enseñar su
 * código sin conexión, y un SVG dentro del documento se guarda en caché con
 * la propia página. Sin peticiones, sin canvas, sin JavaScript.
 */
export async function QrCode({
  value,
  className,
  label,
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: INK_HEX, light: "#0000" },
  });

  return (
    <div
      role="img"
      aria-label={label ?? "QR"}
      className={cn(
        "select-none-hard [&>svg]:h-auto [&>svg]:w-full [&>svg]:[shape-rendering:crispEdges]",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
