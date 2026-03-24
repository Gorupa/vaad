const CACHE_NAME = 'vaad-cache-v2.0.1'; // Update this number whenever you change HTML/CSS/JS
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png'
  // Add other local assets like images or fonts here if you have them
];

// 1. INSTALL EVENT
self.addEventListener('install', (event) => {
  console.log(`[Service Worker] Installing version: ${CACHE_NAME}`);
  
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE EVENT (Cache Cleanup)
self.addEventListener('activate', (event) => {
  console.log(`[Service Worker] Activated version: ${CACHE_NAME}`);
  
  // Tell the active service worker to take control of the page immediately.
  event.waitUntil(clients.claim());
  
  // Delete old caches if the CACHE_NAME has changed
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. FETCH EVENT (Network First, fallback to Cache strategy)
self.addEventListener('fetch', (event) => {
  // We don't want to cache API calls or Firebase auth calls
  if (event.request.url.includes('/api/') || event.request.url.includes('firestore') || event.request.url.includes('identitytoolkit')) {
    return; // Let the browser handle it normally
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If we get a good response from the network, clone it and cache it for later
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If the network fails (user is offline), try to serve from cache
        console.log('[Service Worker] Network request failed, attempting to serve from cache...');
        return caches.match(event.request);
      })
  );
});
