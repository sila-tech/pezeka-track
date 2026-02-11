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

type LoanData = {
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  disbursementDate: Date;
  principalAmount: number;
  registrationFee: number;
  processingFee: number;
  carTrackInstallationFee: number;
  chargingCost: number;
  numberOfInstalments: number;
  instalmentAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  status: 'due' | 'paid' | 'active';
}

export function addLoan(db: Firestore, loanData: LoanData) {
  const loanCollection = collection(db, 'loans');

  const newLoan = {
    ...loanData,
    createdAt: serverTimestamp(),
  };

  addDoc(loanCollection, newLoan)
    .catch((serverError) => {
      const permissionError = new FirestorePermissionError({
        path: loanCollection.path,
        operation: 'create',
        requestResourceData: newLoan,
      });
      errorEmitter.emit('permission-error', permissionError);
    });
}
