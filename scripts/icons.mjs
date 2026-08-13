/**
 * Genera los iconos de la PWA a partir de la marca.
 *
 *   node scripts/icons.mjs
 *
 * Se ejecuta a mano cuando cambia el logotipo, no en cada build: los PNG
 * están versionados para que el despliegue no dependa de sharp.
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const INK = "#0e1211";
const LIME = "#d2fb4f";

/**
 * La marca es un punto. `safe` lo encoge para dejar la zona segura del 80%
 * que exige el recorte circular de Android; sin ella los iconos maskable
 * salen decapitados.
 */
function markSvg({ size, safe }) {
  const r = (size * (safe ? 0.26 : 0.34)) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${INK}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${LIME}"/>
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, safe: false },
  { file: "icon-512.png", size: 512, safe: false },
  { file: "icon-maskable-512.png", size: 512, safe: true },
  { file: "apple-touch-icon.png", size: 180, safe: false },
];

await mkdir("public/icons", { recursive: true });

for (const target of TARGETS) {
  const png = await sharp(Buffer.from(markSvg(target))).png().toBuffer();
  await writeFile(`public/icons/${target.file}`, png);
  console.log(`✓ public/icons/${target.file}`);
}

await writeFile("public/icons/mark.svg", markSvg({ size: 512, safe: false }));
console.log("✓ public/icons/mark.svg");
