'use client';

import React, { useMemo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from './init';

const ClientOverlays = dynamic(() => import('@/components/ClientOverlays'), { ssr: false });
const PWARegister = dynamic(() => import('@/components/PWARegister').then(mod => mod.PWARegister), { ssr: false });


interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const services = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseProvider
      firebaseApp={services?.firebaseApp}
      auth={services?.auth}
      firestore={services?.firestore}
      storage={services?.storage}
    >
      {children}
      <ClientOverlays />
      <PWARegister />
    </FirebaseProvider>
  );
}
