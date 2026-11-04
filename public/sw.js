/* MF X-ray service worker: offline app shell + cached public data. Never caches /api or user files. */
const VERSION = "mfx-v1";
const SHELL = ["/", "/app", "/privacy", "/app/learn", "/manifest.webmanifest", "/icons/icon-192.png", "/pdf.worker.min.mjs", "/sample/sample-cas.pdf"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Public NAV data: network first, fall back to cache (works offline with last-seen NAVs).
  if (url.hostname === "api.mfapi.in" || (url.origin === location.origin && url.pathname.startsWith("/api/nav/"))) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || Response.error())),
    );
    return;
  }
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: network first, cached shell offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(url.pathname.startsWith("/app") ? "/app" : "/"))),
    );
    return;
  }

  // Static assets & bundled data: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/data/") || url.pathname.startsWith("/icons/") || url.pathname.endsWith(".mjs")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
