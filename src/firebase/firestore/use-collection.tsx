'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  onSnapshot,
  Query,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
} from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

interface UseCollection<T> {
  data: T[] | null;
  loading: boolean;
  error: FirestoreError | null;
}

export function useCollection<T>(pathOrQuery: string | Query<DocumentData> | null): UseCollection<T> {
  const firestore = useFirestore();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const memoizedQuery = useMemo(() => {
    if (!firestore || !pathOrQuery) return null;
    if (typeof pathOrQuery === 'string') {
        return query(collection(firestore, pathOrQuery));
    }
    return pathOrQuery;
  }, [firestore, pathOrQuery]);

  useEffect(() => {
    if (!memoizedQuery) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      memoizedQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const docs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as T)
        );
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err: FirestoreError) => {
        let collectionPath = "queried collection";
        if (typeof pathOrQuery === 'string') {
            collectionPath = pathOrQuery;
        } 
        // Cannot reliably get path from a query object.

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: collectionPath,
        });
        errorEmitter.emit('permission-error', contextualError);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedQuery, pathOrQuery]);

  return { data, loading, error };
}
