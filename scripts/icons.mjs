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

/**
 * `app/favicon.ico` es el único sitio en que Next.js reconoce ese nombre de
 * archivo: si se queda con el favicon por defecto del framework, la pestaña
 * del navegador sigue enseñando el logo viejo aunque el resto de iconos ya
 * esté al día. Un .ico moderno puede llevar PNG dentro de cada entrada —lo
 * soportan todos los navegadores desde hace más de una década—, así que no
 * hace falta ninguna dependencia solo para escribir el contenedor.
 */
async function buildIco(sizes) {
  const images = await Promise.all(
    sizes.map((size) => sharp(Buffer.from(markSvg({ size, safe: false }))).png().toBuffer()),
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const [index, png] of images.entries()) {
    const entry = Buffer.alloc(16);
    const size = sizes[index];
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 == 256px
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // sin paleta
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planes de color
    entry.writeUInt16LE(32, 6); // bits por píxel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images]);
}

await writeFile("app/favicon.ico", await buildIco([16, 32, 48]));
console.log("✓ app/favicon.ico");
