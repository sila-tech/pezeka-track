
/**
 * Pezeka Credit Service Worker
 * Satisfies PWA requirements and ensures reliable asset loading.
 */

const CACHE_NAME = 'pezeka-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple pass-through for online-first experience
  // Required to satisfy the PWA manifest requirements in modern browsers
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
    