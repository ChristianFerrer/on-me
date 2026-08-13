/** Concatena clases ignorando falsy. Sin dependencias: no hace falta más. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
