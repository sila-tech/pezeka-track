'use client';

import { addDoc, collection, Firestore, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type CustomerData = {
  name: string;
  phone: string;
  idNumber?: string;
}

export function addCustomer(db: Firestore, customerData: CustomerData) {
  const customerCollection = collection(db, 'customers');
  
  const newCustomer = {
    ...customerData,
    createdAt: serverTimestamp(),
  };

  addDoc(customerCollection, newCustomer)
    .catch((serverError) => {
      const permissionError = new FirestorePermissionError({
        path: customerCollection.path,
        operation: 'create',
        requestResourceData: newCustomer,
      });
      errorEmitter.emit('permission-error', permissionError);
    });
}

type FinanceEntryData = {
    type: 'expense' | 'payout' | 'receipt';
    date: Date;
    amount: number;
    description?: string;
}

export function addFinanceEntry(db: Firestore, entryData: FinanceEntryData) {
  const financeCollection = collection(db, 'financeEntries');

  const newEntry = {
    ...entryData,
  };

  addDoc(financeCollection, newEntry)
    .catch((serverError) => {
      const permissionError = new FirestorePermissionError({
        path: financeCollection.path,
        operation: 'create',
        requestResourceData: newEntry,
      });
      errorEmitter.emit('permission-error', permissionError);
    });
}
