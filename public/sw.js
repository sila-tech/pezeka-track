// Minimal PWA Service Worker for Pezeka Credit
const CACHE_NAME = 'pezeka-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/pezeka_logo_transparent.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
