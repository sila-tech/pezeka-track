'use client';

import { useEffect } from 'react';

/**
 * Handles Service Worker registration for PWA functionality.
 * This component runs only on the client and does not block hydration.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('PWA: ServiceWorker registered successfully with scope: ', registration.scope);
          },
          (err) => {
            console.error('PWA: ServiceWorker registration failed: ', err);
          }
        );
      };

      // Register after the page has fully loaded to avoid impacting initial performance
      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        return () => window.removeEventListener('load', registerSW);
      }
    }
  }, []);

  return null;
}
