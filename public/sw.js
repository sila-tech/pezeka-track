
const CACHE_NAME = 'pezeka-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  'https://picsum.photos/seed/pezeka-192/192/192',
  'https://picsum.photos/seed/pezeka-512/512/512'
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
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
