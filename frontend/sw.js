const CACHE_NAME = 'vaad-v3.3'; // Bumped from v2.6 to force cache refresh on all users

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/js/main.js',        // FIX: was /app.js which no longer exists
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// 1. INSTALL: Cache assets and force activation
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing: ${CACHE_NAME}`);
    self.skipWaiting();
    
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
    event.waitUntil(self.clients.claim());
    
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

    // Bypass cache for API, Firebase, Razorpay, and Google scripts
    if (
        url.includes('/api/') ||
        url.includes('firestore') ||
        url.includes('identitytoolkit') ||
        url.includes('googleapis.com') ||
        url.includes('gstatic.com') ||
        url.includes('razorpay.com') ||
        url.includes('accounts.google.com')
    ) {
        return;
    }

    // Network-first: always try fresh, fall back to cache if offline
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                console.log(`[SW] Offline fallback for: ${url}`);
                return caches.match(event.request);
            })
    );
});
