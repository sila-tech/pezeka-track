'use client';
import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // In a real app, you might log this to a service like Sentry
      // For development, we just throw it to get the Next.js overlay
      if (process.env.NODE_ENV === 'development') {
        throw error;
      } else {
        console.error(error); // Log to console in production
      }
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}
