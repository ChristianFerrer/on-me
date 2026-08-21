/**
 * `--color-ink` de app/globals.css, como literal hexadecimal para las pocas
 * APIs que no pueden leer variables CSS: `theme-color`/`background_color`
 * del manifest, el `fill` de qrcode y cualquier `<img>`/canvas fuera del DOM
 * con estilos. Cambiar el tono de grafito solo debería tocar dos sitios:
 * el token de globals.css y esta constante.
 */
export const INK_HEX = "#0e1211";
