/**
 * PezekaTrack Service Worker
 * Handles offline caching and prevents unhandled fetch promise rejections.
 */

const CACHE_NAME = 'pezekatrack-v1';
const OFFLINE_URL = '/';

const ASSETS_TO_CACHE = [
  OFFLINE_URL,
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  // Network-first strategy with a graceful catch to prevent console errors
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(async () => {
        // This catch block fixes the "Uncaught (in promise) TypeError: Failed to fetch"
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Fallback for navigation requests when completely offline
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }

        // Return a failing but handled response for other assets to avoid the uncaught exception
        return new Response('Network error', { status: 408, statusText: 'Network error' });
      })
  );
});