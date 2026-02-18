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
import { useUser } from '../auth/use-user';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

interface UseCollection<T> {
  data: T[] | null;
  loading: boolean;
  error: FirestoreError | null;
}

export function useCollection<T>(pathOrQuery: string | Query<DocumentData> | null): UseCollection<T> {
  const firestore = useFirestore();
  const { user, loading: userLoading } = useUser();
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
    // Don't do anything until the query is ready and we know the auth state.
    if (!memoizedQuery || userLoading) {
      setLoading(true);
      setData(null);
      return;
    }

    // If auth is resolved but there's no user, we can't make a protected query.
    if (!user) {
      setLoading(false);
      setData(null);
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
  }, [memoizedQuery, user, userLoading]);

  return { data, loading, error };
}
