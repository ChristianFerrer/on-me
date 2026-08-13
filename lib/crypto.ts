import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Alfabeto de los códigos de invitación: sin I, O, 0 ni 1.
 * Un código se dicta en voz alta por encima de un molinillo.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** Token opaco de 32 hex. Identidad de cliente y llave de alta de dispositivo. */
export function newToken(): string {
  return randomBytes(16).toString("hex");
}

/** Token de sesión de dispositivo: más largo, vive en cookie httpOnly. */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function newInviteCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/** Normaliza un código escrito a mano: mayúsculas y sin espacios. */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidInviteCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((char) => CODE_ALPHABET.includes(char));
}

/**
 * Hash con sal de aplicación. Se usa para el teléfono, para el PIN del local
 * y para los tokens de sesión de dispositivo.
 *
 * Nota honesta: sha256 con sal fija no es un KDF. Para el teléfono es
 * suficiente —el espacio de búsqueda de un móvil español es pequeño, así que
 * ningún hash rápido lo protegería, y por eso APP_SALT nunca sale del
 * servidor—. Para el PIN de cuatro dígitos vale lo mismo: la defensa real es
 * que el PIN solo se puede probar contra un dispositivo ya autenticado.
 */
export function hashWithSalt(value: string): string {
  return createHash("sha256").update(`${value}${env.appSalt}`).digest("hex");
}

/** Comparación en tiempo constante de dos hashes hex. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------- teléfono

export type NormalizedPhone = {
  /** E.164 completo. Solo vive en memoria, jamás se persiste ni se registra. */
  e164: string;
  hash: string;
  last4: string;
};

/**
 * Normaliza un teléfono a E.164.
 *
 * Barcelona es cosmopolita: la mitad del público objetivo del local son
 * expatriados y estudiantes con número extranjero, así que se acepta
 * cualquier prefijo internacional. El prefijo del local solo se aplica
 * cuando el número llega sin indicativo.
 */
export function normalizePhone(
  raw: string,
  defaultCountryCode: string,
): NormalizedPhone | null {
  let cleaned = raw.trim().replace(/[\s.\-()/]/g, "");
  if (!cleaned) return null;

  // 0034... y 00 34... son la forma en que mucha gente escribe el prefijo.
  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;
  if (!cleaned.startsWith("+")) {
    // Un 0 inicial es el prefijo troncal nacional de muchos países; sobra.
    cleaned = `${defaultCountryCode}${cleaned.replace(/^0+/, "")}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) return null;

  return {
    e164: cleaned,
    hash: hashWithSalt(cleaned),
    last4: cleaned.slice(-4),
  };
}
