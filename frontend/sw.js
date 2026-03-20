const CACHE_NAME = 'vaad-cache-v5';
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
