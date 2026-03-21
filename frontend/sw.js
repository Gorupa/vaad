const CACHE_NAME = 'vaad-cache-v15'; // Bumped for Stale-While-Revalidate strategy
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
  self.skipWaiting(); // Forces the new service worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim()); // Takes control of all open pages immediately
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Deletes all old caches
          }
        })
      );
    })
  );
});

// STALE-WHILE-REVALIDATE STRATEGY (Maximum Speed + Auto Updates)
self.addEventListener('fetch', event => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      
      // 1. Fetch fresh data from the network in the background
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Ensure the response is valid before caching it
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(error => {
        console.log('Network fetch failed, relying on cache:', error);
      });

      // 2. Return the cached response INSTANTLY if we have it.
      // If we don't have it in cache yet, wait for the network fetch.
      return cachedResponse || fetchPromise;
    })
  );
});
