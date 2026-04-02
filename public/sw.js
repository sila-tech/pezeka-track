// Pezeka PWA Service Worker
const CACHE_NAME = 'pezeka-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Basic bypass strategy to allow online functionality while satisfying PWA requirement
  event.respondWith(fetch(event.request).catch(() => {
    return new Response('Offline functionality limited. Please check your connection.');
  }));
});
