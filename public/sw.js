const CACHE_NAME = "cinemastral-v5";
const STATIC_ASSETS = [
  "/logo.png",
  "/favicon.png",
  "/icon-16.png",
  "/icon-32.png",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

const OFFLINE_PAGE = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    // Network-first so CSS/JS from a new deploy always reaches users, even if
    // a previous build reused the same chunk filename. `cache: "reload"` also
    // bypasses the browser HTTP cache (named CSS chunks are served immutable),
    // so a stable filename can't keep serving pre-fix CSS. SW cache is a
    // fallback for offline/error cases.
    event.respondWith(
      fetch(request, { cache: "reload" })
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode === "navigate") {
    // Network-first for navigations. We intentionally do NOT cache / responses so
    // dynamic pages (e.g. homepage) never serve stale content from the SW cache
    // after a deploy. Offline falls back to the previously cached shell.
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_PAGE)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      });
    })
  );
});
