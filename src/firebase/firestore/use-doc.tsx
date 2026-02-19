'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  doc,
  onSnapshot,
  DocumentReference,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { useFirestore } from '../provider';
import { useUser } from '../auth/use-user';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

interface UseDoc<T> {
  data: T | null;
  loading: boolean;
  error: FirestoreError | null;
}

export function useDoc<T>(docPath: string | null): UseDoc<T> {
  const firestore = useFirestore();
  const { user, loading: userLoading } = useUser();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const memoizedDocRef = useMemo(() => {
    if (!firestore || !docPath) return null;
    return doc(firestore, docPath) as DocumentReference<DocumentData>;
  }, [firestore, docPath]);

  useEffect(() => {
    // If no document to fetch, stop loading and clear data.
    if (!memoizedDocRef) {
      setData(null);
      setLoading(false);
      return;
    }
    
    // If we have a doc ref but are waiting for auth, we are loading.
    if (userLoading) {
      setData(null);
      setLoading(true);
      return;
    }
    
    // If auth is resolved but there's no user, we can't make a protected query.
    if (!user) {
        setData(null);
        setLoading(false);
        return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setData({ id: docSnap.id, ...docSnap.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });
        errorEmitter.emit('permission-error', contextualError);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef, user, userLoading]);

  return { data, loading, error };
}
