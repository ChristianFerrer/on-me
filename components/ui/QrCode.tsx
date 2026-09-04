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
        // El SVG siempre a `size-full` -reclama todo el hueco que le dé el
        // wrapper- con `object-contain` -pero se dibuja dentro de ese hueco
        // respetando su 1:1 real, nunca estirado-. Antes era
        // `w-full h-auto`: si el wrapper terminaba más ancho que alto -como
        // puede pasar en /c, donde ahora el wrapper solo tiene que caber en
        // una caja que no es cuadrada-, el QR salía más alto que el hueco
        // disponible y el `overflow-hidden` de fuera se comía la parte de
        // abajo. `object-contain` no depende de la forma del wrapper: cada
        // caller decide esa forma con su propio className -`aspect-square`
        // si quiere que el ancho mande, o `size-full` si el wrapper ya la
        // resuelve el hueco que lo contiene-.
        "select-none-hard [&>svg]:size-full [&>svg]:object-contain [&>svg]:[shape-rendering:crispEdges]",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
