'use client';

import { addDoc, collection, Firestore, serverTimestamp, DocumentReference, DocumentData, doc, updateDoc, deleteDoc, arrayUnion, increment, getDocs, query, setDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { calculateInterestForOneInstalment } from './utils';

type CustomerData = {
  name: string;
  phone: string;
  idNumber?: string;
}

interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  idNumber?: string;
  loanType?: string;
  disbursementDate: { seconds: number, nanoseconds: number };
  principalAmount: number;
  interestRate?: number;
  registrationFee: number;
  processingFee: number;
  carTrackInstallationFee: number;
  chargingCost: number;
  numberOfInstalments: number;
  instalmentAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  totalPenalties?: number;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  payments?: { paymentId: string; date: { seconds: number; nanoseconds: number } | Date; amount: number; }[];
  penalties?: { penaltyId: string; date: { seconds: number; nanoseconds: number } | Date; amount: number; description: string; }[];
  comments?: string;
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application';
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
    loanId?: string;
    transactionCost?: number;
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

export async function updateFinanceEntry(db: Firestore, entryId: string, data: { [key: string]: any }) {
    const entryRef = doc(db, 'financeEntries', entryId);
    const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
    try {
        await updateDoc(entryRef, { ...updateData, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: entryRef.path,
            operation: 'update',
            requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteFinanceEntry(db: Firestore, entryId: string) {
    const entryRef = doc(db, 'financeEntries', entryId);
    try {
        await deleteDoc(entryRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: entryRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}


type LoanData = {
  customerId: string;
  customerName: string;
  customerPhone: string;
  idNumber?: string;
  loanType?: string;
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
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application';
  comments?: string;
}

export async function addLoan(db: Firestore, loanData: any): Promise<{docRef: DocumentReference<DocumentData>, newLoanNumber: string}> {
  const loanCollection = collection(db, 'loans');
  
  const q = query(loanCollection);
  const querySnapshot = await getDocs(q);
  const loanCount = querySnapshot.size;
  const newLoanNumber = `LN-${String(loanCount + 1).padStart(3, '0')}`;

  const newLoan = {
    ...loanData,
    loanNumber: newLoanNumber,
    createdAt: serverTimestamp(),
    payments: [],
    comments: loanData.comments || ""
  };

  try {
    const docRef = await addDoc(loanCollection, newLoan);
    return { docRef, newLoanNumber };
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
    const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== null && v !== ''));

    try {
        await updateDoc(loanRef, { ...updateData, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: loanRef.path,
            operation: 'update',
            requestResourceData: updateData,
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


export async function rolloverLoan(db: Firestore, originalLoan: Loan, rolloverDate: Date) {
    const interestAmount = calculateInterestForOneInstalment(
        originalLoan.principalAmount,
        originalLoan.interestRate ?? 0,
        originalLoan.numberOfInstalments,
        originalLoan.paymentFrequency
    );

    if (interestAmount <= 0) {
        throw new Error("Cannot rollover a loan with zero interest.");
    }

    const receiptDescription = `Rollover interest payment for Loan #${originalLoan.loanNumber}`;
    const receiptData = { 
        type: 'receipt' as const,
        date: rolloverDate,
        amount: interestAmount,
        description: receiptDescription,
        loanId: originalLoan.id
    };
    const receiptDocRef = await addFinanceEntry(db, receiptData);

    const interestPayment = {
        paymentId: receiptDocRef.id,
        amount: interestAmount,
        date: rolloverDate,
    };

    await updateLoan(db, originalLoan.id, {
        status: 'rollover',
        comments: `${originalLoan.comments || ''}\nRolled over on ${rolloverDate.toLocaleDateString()}.`.trim(),
        payments: arrayUnion(interestPayment),
        totalPaid: increment(interestAmount)
    });

    const loansCollection = collection(db, 'loans');
    const q = query(loansCollection);
    const querySnapshot = await getDocs(q);
    const loanCount = querySnapshot.size;
    const newLoanNumber = `LN-${String(loanCount + 1).padStart(3, '0')}`;

    const newLoanData = {
        loanNumber: newLoanNumber,
        customerId: originalLoan.customerId,
        customerName: originalLoan.customerName,
        customerPhone: originalLoan.customerPhone,
        disbursementDate: rolloverDate,
        principalAmount: originalLoan.principalAmount,
        interestRate: originalLoan.interestRate ?? 0,
        registrationFee: originalLoan.registrationFee,
        processingFee: originalLoan.processingFee,
        carTrackInstallationFee: originalLoan.carTrackInstallationFee,
        chargingCost: originalLoan.chargingCost,
        numberOfInstalments: originalLoan.numberOfInstalments,
        instalmentAmount: originalLoan.instalmentAmount,
        totalRepayableAmount: originalLoan.totalRepayableAmount,
        paymentFrequency: originalLoan.paymentFrequency,
        status: 'active',
        totalPaid: 0,
        payments: [],
        comments: `Rollover from Loan #${originalLoan.loanNumber}`,
        createdAt: serverTimestamp(),
    };

    try {
        await addDoc(loansCollection, newLoanData);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: loansCollection.path,
            operation: 'create',
            requestResourceData: newLoanData,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteLoan(db: Firestore, loanId: string) {
    const loanRef = doc(db, 'loans', loanId);
    try {
        await deleteDoc(loanRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: loanRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function addPenaltyToLoan(db: Firestore, loanId: string, penalty: { amount: number; date: Date; description: string }) {
    const loanRef = doc(db, 'loans', loanId);
    
    // Firestore can generate IDs client-side without a round trip
    const penaltyId = doc(collection(db, 'temp')).id;

    const penaltyWithId = {
        ...penalty,
        penaltyId: penaltyId,
    };

    try {
        await updateDoc(loanRef, {
            penalties: arrayUnion(penaltyWithId),
            totalPenalties: increment(penalty.amount),
            totalRepayableAmount: increment(penalty.amount)
        });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: loanRef.path,
            operation: 'update',
            requestResourceData: {
                penalties: 'ADD_PENALTY_DATA', // Placeholder to avoid sending large objects
                totalPenalties: `increment by ${penalty.amount}`,
                totalRepayableAmount: `increment by ${penalty.amount}`
            },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}


export async function createUserProfile(db: Firestore, userId: string, data: { email: string, role: string, name?: string }) {
    const userRef = doc(db, 'users', userId);
    const profileData = {
        uid: userId,
        email: data.email,
        role: data.role,
        name: data.name || data.email.split('@')[0],
    };
    try {
        await setDoc(userRef, profileData, { merge: true });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'create',
            requestResourceData: profileData,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function updateUserProfile(db: Firestore, userId: string, data: { [key: string]: any }) {
    const userRef = doc(db, 'users', userId);
    const updateData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== ''));

    try {
        await updateDoc(userRef, { ...updateData, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteUserProfile(db: Firestore, userId: string) {
    const userRef = doc(db, 'users', userId);
    try {
        await deleteDoc(userRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

// Investor Management Functions
export async function createInvestorProfile(db: Firestore, investorId: string, data: { name: string; email: string; initialInvestment: number; }) {
    const investorRef = doc(db, 'investors', investorId);
    const profileData = {
        uid: investorId,
        ...data,
        currentBalance: data.initialInvestment,
        interestEntries: [],
        createdAt: serverTimestamp(),
    };

    try {
        await setDoc(investorRef, profileData);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: investorRef.path,
            operation: 'create',
            requestResourceData: profileData,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function updateInvestor(db: Firestore, investorId: string, data: { [key: string]: any }) {
    const investorRef = doc(db, 'investors', investorId);
    try {
        await updateDoc(investorRef, { ...data, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: investorRef.path,
            operation: 'update',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteInvestor(db: Firestore, investorId: string) {
    const investorRef = doc(db, 'investors', investorId);
    try {
        await deleteDoc(investorRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: investorRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function addInterestToInvestorPortfolio(db: Firestore, investorId: string, interestData: { amount: number; date: Date; description?: string }) {
    const investorRef = doc(db, 'investors', investorId);
    const entryId = doc(collection(db, 'temp')).id;
    
    const newInterestEntry = {
        ...interestData,
        entryId,
    };

    try {
        await updateDoc(investorRef, {
            interestEntries: arrayUnion(newInterestEntry),
            currentBalance: increment(interestData.amount),
            updatedAt: serverTimestamp(),
        });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: investorRef.path,
            operation: 'update',
            requestResourceData: { interestEntries: 'ADD_INTEREST', currentBalance: `increment by ${interestData.amount}`},
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}