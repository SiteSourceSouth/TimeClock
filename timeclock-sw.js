/* SSS Time Clock — service worker
 * Caches the app shell so the icon launches instantly and the login screen
 * works even on a weak signal. Punches themselves always go to the network;
 * if offline, the page queues them (see timeclock.html) — we never cache POSTs.
 *
 * Bump CACHE_VERSION whenever you change the HTML/manifest/icons so phones
 * pull the new version instead of a stale cached copy.
 */
const CACHE_VERSION = 'sss-timeclock-v3';
const SHELL = [
  './',
  './index.html',
  './timeclock.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Never touch the Apps Script API or any non-GET request.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  // App shell: cache-first, fall back to network, update cache in background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
