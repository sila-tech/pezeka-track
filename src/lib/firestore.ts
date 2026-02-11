'use client';

import { addDoc, collection, Firestore, serverTimestamp, DocumentReference, DocumentData, doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type CustomerData = {
  name: string;
  phone: string;
  idNumber?: string;
}

export async function addCustomer(db: Firestore, customerData: CustomerData): Promise<DocumentReference<DocumentData>> {
  const customerCollection = collection(db, 'customers');
  
  const newCustomer = {
    ...customerData,
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(customerCollection, newCustomer);
    return docRef;
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: customerCollection.path,
      operation: 'create',
      requestResourceData: newCustomer,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
}

type FinanceEntryData = {
    type: 'expense' | 'payout' | 'receipt';
    date: Date;
    amount: number;
    description?: string;
}

export async function addFinanceEntry(db: Firestore, entryData: FinanceEntryData): Promise<DocumentReference<DocumentData>> {
  const financeCollection = collection(db, 'financeEntries');

  const newEntry = {
    ...entryData,
  };

  try {
    const docRef = await addDoc(financeCollection, newEntry);
    return docRef;
  } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: financeCollection.path,
        operation: 'create',
        requestResourceData: newEntry,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw serverError;
  }
}

type LoanData = {
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  disbursementDate: Date;
  principalAmount: number;
  interestRate: number;
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

export async function addLoan(db: Firestore, loanData: LoanData): Promise<DocumentReference<DocumentData>> {
  const loanCollection = collection(db, 'loans');

  const newLoan = {
    ...loanData,
    createdAt: serverTimestamp(),
    payments: [],
    comments: ""
  };

  try {
    const docRef = await addDoc(loanCollection, newLoan);
    return docRef;
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: loanCollection.path,
      operation: 'create',
      requestResourceData: newLoan,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
}

export async function updateLoan(db: Firestore, loanId: string, data: { [key: string]: any }) {
    const loanRef = doc(db, 'loans', loanId);
    try {
        await updateDoc(loanRef, { ...data, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: loanRef.path,
            operation: 'update',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}


type CustomerUpdateData = {
  name: string;
  phone: string;
  idNumber?: string;
}

export async function updateCustomer(db: Firestore, customerId: string, data: CustomerUpdateData) {
    const customerRef = doc(db, 'customers', customerId);
    try {
        await updateDoc(customerRef, { ...data, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: customerRef.path,
            operation: 'update',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteCustomer(db: Firestore, customerId: string) {
    const customerRef = doc(db, 'customers', customerId);
    try {
        await deleteDoc(customerRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: customerRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}
