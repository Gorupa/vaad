const CACHE_NAME = 'vaad-cache-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js'
];

// Install Event - Caches the UI
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// Fetch Event - Serves UI from cache, but fetches live API data from the network
self.addEventListener('fetch', (event) => {
    // If the request is for your backend API, DO NOT CACHE IT
    if (event.request.url.includes('/api/')) {
        return; 
    }

    // Otherwise, serve the static files from the cache for instant loading
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
