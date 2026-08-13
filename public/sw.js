/**
 * Service worker de OnMe.
 *
 * Un solo objetivo: que la tarjeta enseñe su QR sin cobertura. En un sótano
 * de Gràcia no hay señal y el cliente sigue teniendo que poder sellar.
 *
 * Lo que NUNCA se guarda en caché:
 *   /api/*   respuestas con estado, que caducan al instante
 *   /s*      el escáner, que necesita red por definición
 *   /admin*  datos del local
 */

const CACHE = "onme-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

function isCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  return !(
    url.pathname.startsWith("/api/") ||
    url.pathname === "/s" ||
    url.pathname.startsWith("/s/") ||
    url.pathname.startsWith("/admin")
  );
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isCacheable(url)) return;

  // La tarjeta: red primero para traer los sellos nuevos, caché si no hay red.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Estáticos con huella en el nombre: la caché siempre es correcta.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    event.respondWith(cacheFirst(request));
  }
});
