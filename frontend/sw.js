const CACHE_NAME = 'vaad-cache-v22';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/terms.html',
  '/privacy.html',
  '/refund.html',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Bulletproof caching: If one file fails (e.g. typo in GitHub), it won't crash the whole app!
      return Promise.allSettled(
        urlsToCache.map(url => cache.add(url).catch(err => console.error('Cache failed for:', url)))
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Nuke all old caches
          }
        })
      );
    })
  );
});

// HYBRID STRATEGY: Network-First for HTML (Always fresh), Stale-While-Revalidate for JS/CSS (Always fast)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const isHtml = event.request.headers.get('accept').includes('text/html');

  if (isHtml) {
    // HTML Pages -> NETWORK FIRST (Fixes the ERR_FAILED issue permanently)
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Assets (JS, CSS, Images) -> STALE WHILE REVALIDATE (Super Fast)
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => {});
        return cachedResponse || fetchPromise;
      })
    );
  }
});
