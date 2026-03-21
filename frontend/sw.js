const CACHE_NAME = 'vaad-cache-v7';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/icon-192.png',
    '/icon-512.png'
];

self.addEventListener('install', (event) => {
    // Forces the new service worker to activate immediately
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// --- NEW ACTIVATE EVENT: Deletes old caches so the app stays tiny ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Deleting old Vaad cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            // Forces the new Service Worker to take control immediately
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // CRITICAL: Do NOT cache API calls, Firebase Auth, or Google links
    if (url.includes('/api/') || url.includes('googleapis.com') || url.includes('firebase')) {
        return; 
    }

    // Otherwise, serve the static files from the cache for instant loading
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
