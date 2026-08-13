/**
 * Limitador en memoria, por ventana fija.
 *
 * Es deliberadamente tonto: en v0 hay un local y una región de Vercel, así
 * que un contador en memoria basta para frenar un script que intente crear
 * mil altas. No pretende ser exacto entre instancias — si el piloto crece,
 * esto se sustituye por Upstash y ya está.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    // Purga perezosa: evita que el mapa crezca sin fin en un proceso largo.
    if (buckets.size > MAX_KEYS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  return { ok: true, retryAfterSeconds: 0 };
}

/** IP del cliente detrás del proxy de Vercel. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "desconocida";
}
