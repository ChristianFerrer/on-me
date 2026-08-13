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

const PAPER = "#fbf3e4";
const INK = "#17110d";
const SAFFRON = "#ffb627";
const TOMATO = "#ff4b25";

/**
 * `safe` deja margen para el recorte circular de Android (zona segura del
 * 80%). Sin él, los iconos maskable salen decapitados.
 */
function markSvg({ size, background, safe }) {
  const scale = safe ? 0.62 : 0.78;
  const r = (size * scale) / 2;
  const cx = size / 2;
  const offset = size * 0.035;
  const stroke = Math.max(size * 0.032, 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  <circle cx="${cx + offset}" cy="${cx + offset}" r="${r}" fill="${TOMATO}"/>
  <circle cx="${cx - offset}" cy="${cx - offset}" r="${r}" fill="${SAFFRON}" stroke="${INK}" stroke-width="${stroke}"/>
  <circle cx="${cx - offset}" cy="${cx - offset}" r="${r * 0.5}" fill="none" stroke="${INK}" stroke-width="${stroke}"/>
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, background: PAPER, safe: false },
  { file: "icon-512.png", size: 512, background: PAPER, safe: false },
  { file: "icon-maskable-512.png", size: 512, background: PAPER, safe: true },
  { file: "apple-touch-icon.png", size: 180, background: PAPER, safe: false },
];

await mkdir("public/icons", { recursive: true });

for (const target of TARGETS) {
  const svg = markSvg(target);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(`public/icons/${target.file}`, png);
  console.log(`✓ public/icons/${target.file}`);
}

await writeFile("public/icons/mark.svg", markSvg({ size: 512, background: PAPER, safe: false }));
console.log("✓ public/icons/mark.svg");
