
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
  // Only handle GET requests
  if (event.request.method !== 'GET') {
      return;
  }
  
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
          return cachedResponse;
      }
      // If no cache, return a generic offline response or throw
      return new Response('Offline and not cached', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});
    