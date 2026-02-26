'use client';

import { addDoc, collection, Firestore, serverTimestamp, DocumentReference, DocumentData, doc, updateDoc, deleteDoc, arrayUnion, increment, getDocs, query, setDoc, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { calculateInterestForOneInstalment, calculateAmortization } from './utils';

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
  disbursementDate: { seconds: number, nanoseconds: number } | Date;
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
  status: 'active' | 'due' | 'paid' | 'rollover' | 'overdue' | 'application' | 'rejected';
  disbursementRecorded?: boolean;
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
    expenseCategory?: 'facilitation_commission' | 'office_purchase' | 'other';
    receiptCategory?: 'loan_repayment' | 'upfront_fees' | 'investment' | 'other';
    payoutCategory?: 'loan_disbursement' | 'investor_withdrawal' | 'other';
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
    comments: loanData.comments || "",
    disbursementRecorded: false // Initialize as false to allow recordDisbursement to trigger
  };

  try {
    const docRef = await addDoc(loanCollection, newLoan);
    
    if (loanData.status === 'active') {
        // Pass the generated ID to recordDisbursement
        await recordDisbursement(db, { ...newLoan, id: docRef.id });
    }

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

async function recordDisbursement(db: Firestore, loan: any) {
    // Re-check if already recorded to prevent race conditions
    const loanRef = doc(db, 'loans', loan.id);
    const loanSnap = await getDoc(loanRef);
    if (loanSnap.exists() && loanSnap.data().disbursementRecorded) return;

    const reg = Number(loan.registrationFee) || 0;
    const proc = Number(loan.processingFee) || 0;
    const track = Number(loan.carTrackInstallationFee) || 0;
    const charge = Number(loan.chargingCost) || 0;
    const totalFees = reg + proc + track + charge;
    
    // Calculate the actual cash out (Take Home)
    const takeHome = Number(loan.principalAmount) - totalFees;
    
    const disbursementDate = loan.disbursementDate instanceof Date 
        ? loan.disbursementDate 
        : (loan.disbursementDate?.seconds ? new Date(loan.disbursementDate.seconds * 1000) : new Date());

    // Record the Take Home as the actual payout amount in Finance
    await addFinanceEntry(db, {
        type: 'payout',
        payoutCategory: 'loan_disbursement',
        date: disbursementDate,
        amount: takeHome,
        description: `Disbursement for Loan #${loan.loanNumber}. Principal: Ksh ${Number(loan.principalAmount).toLocaleString()}, Retained Fees: Ksh ${totalFees.toLocaleString()}`,
        loanId: loan.id
    });

    // Mark as recorded
    await updateDoc(loanRef, { disbursementRecorded: true });
}

export async function approveLoanApplication(db: Firestore, loan: Loan, updateData: any) {
    const loanRef = doc(db, 'loans', loan.id);
    
    const { instalmentAmount, totalRepayableAmount } = calculateAmortization(
        updateData.principalAmount || loan.principalAmount,
        updateData.interestRate ?? loan.interestRate ?? 0,
        updateData.numberOfInstalments || loan.numberOfInstalments,
        updateData.paymentFrequency || loan.paymentFrequency
    );

    const finalUpdate = {
        ...updateData,
        status: 'active',
        instalmentAmount,
        totalRepayableAmount,
        updatedAt: serverTimestamp()
    };

    await updateDoc(loanRef, finalUpdate);
    await recordDisbursement(db, { ...loan, ...finalUpdate });
}

export async function updateLoan(db: Firestore, loanId: string, data: { [key: string]: any }) {
    const loanRef = doc(db, 'loans', loanId);

    if (data.status === 'active') {
        const loanSnap = await getDoc(loanRef);
        if (loanSnap.exists()) {
            const loanData = loanSnap.data();
            if (!loanData.disbursementRecorded) {
                await recordDisbursement(db, { ...loanData, id: loanId, ...data });
                data.disbursementRecorded = true;
            }
        }
    }

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
        receiptCategory: 'loan_repayment' as const,
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
        disbursementRecorded: true 
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
                penalties: 'ADD_PENALTY_DATA',
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


// Investor Functions
export async function addInvestor(db: Firestore, investorData: { uid: string; name: string; email: string; totalInvestment: number; currentBalance: number; interestRate?: number; }) {
    const investorRef = doc(db, 'investors', investorData.uid);
    const data = {
        ...investorData,
        interestRate: investorData.interestRate || 0,
        withdrawals: [],
        deposits: [],
        interestEntries: [],
        createdAt: serverTimestamp()
    };
    try {
        await setDoc(investorRef, data);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: investorRef.path,
            operation: 'create',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function updateInvestor(db: Firestore, investorId: string, data: { [key: string]: any }) {
    const investorRef = doc(db, 'investors', investorId);
     const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
    try {
        await updateDoc(investorRef, { ...updateData, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: investorRef.path,
            operation: 'update',
            requestResourceData: updateData,
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

export async function applyInterestToPortfolio(db: Firestore, investorId: string, interestAmount: number, description: string) {
    const investorRef = doc(db, 'investors', investorId);
    const entryId = doc(collection(db, 'temp')).id;
    const interestEntry = {
        entryId,
        amount: interestAmount,
        date: new Date(),
        description,
    };

    try {
        await updateDoc(investorRef, {
            currentBalance: increment(interestAmount),
            interestEntries: arrayUnion(interestEntry),
            updatedAt: serverTimestamp(),
        });
    } catch(e) {
        const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'update', requestResourceData: { currentBalance: `increment by ${interestAmount}` }});
        errorEmitter.emit('permission-error', permissionError);
        throw e;
    }
}

export async function requestWithdrawal(db: Firestore, investorId: string, amount: number) {
    const investorRef = doc(db, 'investors', investorId);
    const withdrawalId = doc(collection(db, 'temp')).id;
    const withdrawalRequest = {
        withdrawalId,
        amount,
        date: new Date(),
        status: 'pending'
    };

    try {
        await updateDoc(investorRef, {
            withdrawals: arrayUnion(withdrawalRequest),
            updatedAt: serverTimestamp(),
        });
    } catch(e) {
        const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'update', requestResourceData: { withdrawals: 'ADD_WITHDRAWAL_REQUEST' }});
        errorEmitter.emit('permission-error', permissionError);
        throw e;
    }
}

export async function processWithdrawal(db: Firestore, investorId: string, withdrawalId: string) {
    const investorRef = doc(db, 'investors', investorId);
    const investorDoc = await getDoc(investorRef);
    if (!investorDoc.exists()) throw new Error("Investor not found");

    const investorData = investorDoc.data();
    const withdrawal = investorData.withdrawals?.find((w: any) => w.withdrawalId === withdrawalId);

    if (!withdrawal || withdrawal.status !== 'pending') {
        throw new Error("Withdrawal request not found or already processed.");
    }

    const updatedWithdrawals = investorData.withdrawals.map((w: any) => 
        w.withdrawalId === withdrawalId ? { ...w, status: 'processed' } : w
    );
    
    await addFinanceEntry(db, {
        type: 'payout',
        payoutCategory: 'investor_withdrawal',
        date: new Date(),
        amount: withdrawal.amount,
        description: `Investor withdrawal for ${investorData.name}`,
    });

    try {
         await updateDoc(investorRef, {
            withdrawals: updatedWithdrawals,
            currentBalance: increment(-withdrawal.amount),
            updatedAt: serverTimestamp()
        });
    } catch (e) {
         const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'update', requestResourceData: { currentBalance: `decrement by ${withdrawal.amount}` }});
        errorEmitter.emit('permission-error', permissionError);
        throw e;
    }
}

export async function rejectWithdrawal(db: Firestore, investorId: string, withdrawalId: string) {
    const investorRef = doc(db, 'investors', investorId);

    const investorDoc = await getDoc(investorRef);
    if (!investorDoc.exists()) throw new Error("Investor not found");

    const withdrawals = investorDoc.data().withdrawals || [];
    const updatedWithdrawals = withdrawals.map((w: any) => 
        w.withdrawalId === withdrawalId ? { ...w, status: 'rejected' } : w
    );

    try {
        await updateDoc(investorRef, {
            withdrawals: updatedWithdrawals,
            updatedAt: serverTimestamp()
        });
    } catch(e) {
        const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'update', requestResourceData: { withdrawals: 'REJECT_WITHDRAWAL' }});
        errorEmitter.emit('permission-error', permissionError);
        throw e;
    }
}

export async function requestDeposit(db: Firestore, investorId: string, amount: number) {
    const investorRef = doc(db, 'investors', investorId);
    const depositId = doc(collection(db, 'temp')).id;
    const depositRequest = {
        depositId,
        amount,
        date: new Date(),
        status: 'pending'
    };

    try {
        await updateDoc(investorRef, {
            deposits: arrayUnion(depositRequest),
            updatedAt: serverTimestamp(),
        });
        return depositRequest;
    } catch(e) {
        const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'update', requestResourceData: { deposits: 'ADD_DEPOSIT_REQUEST' }});
        errorEmitter.emit('permission-error', permissionError);
        throw e;
    }
}

export async function approveDeposit(db: Firestore, investorId: string, depositId: string) {
    const investorRef = doc(db, 'investors', investorId);
    
    const investorDoc = await getDoc(investorRef);
    if (!investorDoc.exists()) throw new Error("Investor not found");

    const investorData = investorDoc.data();
    const deposit = investorData.deposits?.find((d: any) => d.depositId === depositId);

    if (!deposit || deposit.status !== 'pending') {
        throw new Error("Deposit request not found or already processed.");
    }

    const updatedDeposits = investorData.deposits.map((d: any) => 
        d.depositId === depositId ? { ...d, status: 'approved' } : d
    );
    
    await addFinanceEntry(db, {
        type: 'receipt',
        receiptCategory: 'investment',
        date: new Date(),
        amount: deposit.amount,
        description: `Investor deposit from ${investorData.name}`,
    });

    try {
         await updateDoc(investorRef, {
            deposits: updatedDeposits,
            currentBalance: increment(deposit.amount),
            totalInvestment: increment(deposit.amount),
            updatedAt: serverTimestamp()
        });
    } catch (e) {
         const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'update', requestResourceData: { currentBalance: `increment by ${deposit.amount}` }});
        errorEmitter.emit('permission-error', permissionError);
        throw e;
    }
}

export async function rejectDeposit(db: Firestore, investorId: string, depositId: string) {
    const investorRef = doc(db, 'investors', investorId);

    const investorDoc = await getDoc(investorRef);
    if (!investorDoc.exists()) throw new Error("Investor not found");

    const deposits = investorDoc.data().deposits || [];
    const updatedDeposits = deposits.map((d: any) => 
        d.depositId === depositId ? { ...d, status: 'rejected' } : d
    );

    try {
        await updateDoc(investorRef, {
            deposits: updatedDeposits,
            updatedAt: serverTimestamp()
        });
    } catch(e) {
        const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'update', requestResourceData: { deposits: 'REJECT_DEPOSIT' }});
        errorEmitter.emit('permission-error', permissionError);
        throw e;
    }
}
