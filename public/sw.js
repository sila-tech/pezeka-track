/**
 * Pezeka Credit Service Worker
 * Satisfies PWA installation requirements and handles basic connectivity reliability.
 */

const CACHE_NAME = 'pezeka-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through for standard requests to prevent breakage while fixing "ERR_FAILED"
  event.respondWith(
    fetch(event.request).catch(() => {
      // Return a 404 for missing resources when offline
      return new Response('Offline - Service Worker active', {
        status: 404,
        statusText: 'Not Found'
      });
    })
  );
});