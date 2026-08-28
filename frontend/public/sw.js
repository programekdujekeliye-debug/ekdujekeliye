/**
 * Service Worker for EDKL Gate Scanner PWA
 * Provides robust offline application shell caching
 */

const CACHE_NAME = 'edkl-scanner-shell-v1';
const ASSETS_TO_CACHE = [
  '/admin/scanner',
  '/logo.png',
  '/scanner-manifest.json',
  '/icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip API network requests from generic service worker cache (handled explicitly by IndexedDB)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.startsWith('/admin/scanner') || url.pathname.endsWith('.png') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback for scanner page
        if (event.request.mode === 'navigate') {
          return caches.match('/admin/scanner');
        }
      });
    })
  );
});
