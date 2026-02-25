'use client';
import React, { ReactNode, useMemo } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { firebaseConfig } from './config';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export const FirebaseClientProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const firebaseInstances = useMemo(
    () => initializeFirebase(firebaseConfig),
    []
  );

  return (
    <FirebaseProvider value={firebaseInstances}>
      {children}
      <FirebaseErrorListener />
    </FirebaseProvider>
  );
};
