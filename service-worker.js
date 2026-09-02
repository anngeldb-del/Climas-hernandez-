/**
 * service-worker.js
 * -----------------------------------------------------------------------
 * PWA cache layer for Autoclimas Hernández.
 *
 * Strategy:
 *   - APP_SHELL is precached on install (the minimum needed to boot the
 *     app while offline: shell HTML, manifest, icons, core CSS/JS).
 *   - Every other same-origin GET request (feature modules added later,
 *     images, fonts) is served stale-while-revalidate at runtime and
 *     added to the runtime cache automatically — so new modules never
 *     require editing this file.
 *   - Firestore/Auth/Storage calls (different origin: *.googleapis.com,
 *     firestore.googleapis.com) are always left to the network; Firestore
 *     keeps its own offline queue (see core/firebase.init.js), duplicating
 *     that here would just cause stale-data bugs.
 *   - Bump CACHE_VERSION on every deploy that changes cached files so old
 *     clients pick up fresh assets instead of serving stale ones forever.
 */

const CACHE_VERSION = 'v3';
const SHELL_CACHE = `autoclimas-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `autoclimas-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './styles/tokens.css',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/themes.css',
  './src/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/logo/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Allows the page to trigger an immediate takeover after showing an
// "update available" toast (see core/pwa.service.js).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let Firebase/network-only calls pass through

  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(async () => {
      if (cached) return cached;
      // Nothing cached and the network is down — for a page navigation this
      // is the difference between a browser error screen and something the
      // user can act on, so fall back to the offline shell.
      if (request.mode === 'navigate') return (await caches.open(SHELL_CACHE)).match('./offline.html');
      return Response.error();
    });

  return cached || networkFetch;
}
