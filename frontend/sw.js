const CACHE_NAME = 'vaad-v2.0.4'; // Bump this number (e.g., v2.0.2) to force an immediate update for all users

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icon-192.png'
];

// 1. INSTALL: Cache assets and force activation
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing: ${CACHE_NAME}`);
    self.skipWaiting(); // Forces the waiting SW to become active immediately
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching offline assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. ACTIVATE: Clean up old caches
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activated: ${CACHE_NAME}`);
    event.waitUntil(self.clients.claim()); // Takes control of all open pages immediately
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`[SW] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 3. FETCH: Network-First Strategy
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // BYPASS CACHE ENTIRELY for your API, Firebase, Razorpay, and external scripts
    if (
        url.includes('/api/') || 
        url.includes('firestore') || 
        url.includes('identitytoolkit') || 
        url.includes('googleapis.com') ||
        url.includes('razorpay.com')
    ) {
        return; // Let the browser handle these normally
    }

    // Network-First for HTML, CSS, and JS (Ensures users always see your latest code)
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If network is successful, update the cache with the fresh file
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If offline or network fails, serve the cached file
                console.log(`[SW] Network failed for ${url}, falling back to cache.`);
                return caches.match(event.request);
            })
    );
});
