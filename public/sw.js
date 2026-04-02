
/**
 * Simple Service Worker for Pezeka Credit PWA.
 * Ensures the app loads and prevents ERR_FAILED errors.
 */

const CACHE_NAME = 'pezeka-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple network-first fetch strategy
  event.respondWith(
    fetch(event.request).catch(() => {
      // Offline fallback can be added here
      return caches.match(event.request);
    })
  );
});
    