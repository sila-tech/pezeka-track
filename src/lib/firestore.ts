'use client';

import { addDoc, collection, Firestore, serverTimestamp, DocumentReference, DocumentData, doc, updateDoc, deleteDoc, arrayUnion, increment, getDocs, query, setDoc, getDoc, where, limit } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { calculateInterestForOneInstalment, calculateAmortization } from './utils';
import { sendAutomatedEmail } from '@/app/actions/email-actions';

type CustomerData = {
  name: string;
  phone: string;
  email?: string;
  idNumber?: string;
  accountNumber?: string;
  referredBy?: string;
  referralCode?: string;
}

export interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  accountNumber?: string; // Member Number
  alternativeNumber?: string;
  idNumber?: string;
  loanType?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
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
  payments?: { paymentId: string; date: { seconds: number; nanoseconds: number } | Date; amount: number; recordedBy?: string; }[];
  penalties?: { penaltyId: string; date: { seconds: number; nanoseconds: number } | Date; amount: number; description: string; recordedBy?: string; }[];
  followUpNotes?: { noteId: string; date: { seconds: number; nanoseconds: number } | Date; staffName: string; staffId: string; content: string; }[];
  comments?: string;
  status: 'active' | 'due' | 'overdue' | 'paid' | 'rollover' | 'application' | 'rejected';
  disbursementRecorded?: boolean;
}

export async function addMailLog(db: Firestore, logData: { recipient: string, subject: string, body: string, type: string, sender: string }) {
    const logsCollection = collection(db, 'mail_logs');
    const newLog = {
        ...logData,
        sentAt: serverTimestamp()
    };
    
    addDoc(logsCollection, newLog).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: logsCollection.path,
            operation: 'create',
            requestResourceData: newLog,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

async function generateAccountNumber(db: Firestore): Promise<string> {
  const customerCollection = collection(db, 'customers');
  let accNo = `PZ-${Math.floor(10000 + Math.random() * 90000)}`;
  try {
    const q = query(customerCollection);
    const snap = await getDocs(q);
    accNo = `PZ-${String(snap.size + 1).padStart(5, '0')}`;
  } catch (e) {
    console.error("Error generating account number", e);
  }
  return accNo;
}

export function generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `PZK-${code}`;
}

export async function addCustomer(db: Firestore, customerData: CustomerData): Promise<DocumentReference<DocumentData>> {
  const customerCollection = collection(db, 'customers');
  const accountNumber = await generateAccountNumber(db);
  const referralCode = generateReferralCode();

  const newCustomer = {
    ...customerData,
    accountNumber,
    referralCode,
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(customerCollection, newCustomer);
    if (customerData.email) {
        sendAutomatedEmail({
            type: 'welcome',
            recipientEmail: customerData.email,
            data: { customerName: customerData.name }
        }).then(res => {
            if (res.success && res.sentContent) {
                addMailLog(db, { ...res.sentContent, sender: 'AI Automation' });
            }
        });
    }
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

export async function upsertCustomer(db: Firestore, customerId: string, customerData: CustomerData) {
  const customerRef = doc(db, 'customers', customerId);
  try {
    const existingSnap = await getDoc(customerRef);
    let finalData: any = { ...customerData, updatedAt: serverTimestamp() };

    if (!existingSnap.exists()) {
        finalData.accountNumber = await generateAccountNumber(db);
        finalData.referralCode = generateReferralCode();
        if (customerData.email) {
            sendAutomatedEmail({
                type: 'welcome',
                recipientEmail: customerData.email,
                data: { customerName: customerData.name }
            }).then(res => {
                if (res.success && res.sentContent) {
                    addMailLog(db, { ...res.sentContent, sender: 'AI Automation' });
                }
            });
        }
    } else {
        const existingData = existingSnap.data();
        if (!existingData.referralCode) {
            finalData.referralCode = generateReferralCode();
        }
        if (!existingData.accountNumber) {
            finalData.accountNumber = await generateAccountNumber(db);
        }
    }

    await setDoc(customerRef, finalData, { merge: true });
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: customerRef.path,
      operation: 'update',
      requestResourceData: customerData,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
}

export async function uploadKYCDocument(db: Firestore, storage: FirebaseStorage, data: { 
    customerId: string, 
    customerName: string, 
    type: string, 
    fileName: string, 
    fileUrl: string,
    uploadedBy: string 
}) {
    const kycCollection = collection(db, 'kyc_documents');
    
    try {
        // 1. Upload the base64 image to Firebase Storage
        const fileExtension = 'jpg';
        const storagePath = `kyc/${data.customerId}/${Date.now()}_${data.fileName.replace(/\s+/g, '_')}.${fileExtension}`;
        const storageRef = ref(storage, storagePath);
        
        // uploadString handles data URIs automatically (data:image/jpeg;base64,...)
        await uploadString(storageRef, data.fileUrl, 'data_url');
        const downloadUrl = await getDownloadURL(storageRef);

        // 2. Save metadata to Firestore referencing the Storage URL
        const newDoc = {
            ...data,
            fileUrl: downloadUrl, // Use the public cloud URL
            storagePath: storagePath,
            uploadedAt: serverTimestamp()
        };

        return await addDoc(kycCollection, newDoc);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: kycCollection.path,
            operation: 'create',
            requestResourceData: { ...data, fileUrl: '[STORAGE_URL]' },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteKYCDocument(db: Firestore, docId: string) {
    const kycRef = doc(db, 'kyc_documents', docId);
    try {
        await deleteDoc(kycRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: kycRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

type FinanceEntryData = {
    type: 'expense' | 'payout' | 'receipt';
    date: Date;
    amount: number;
    transactionFee?: number;
    description?: string;
    loanId?: string;
    recordedBy?: string;
    expenseCategory?: 'facilitation_commission' | 'office_purchase' | 'other';
    receiptCategory?: 'loan_repayment' | 'upfront_fees' | 'investment' | 'other';
    payoutCategory?: 'loan_disbursement' | 'investor_withdrawal' | 'other';
}

export async function addFinanceEntry(db: Firestore, entryData: FinanceEntryData): Promise<DocumentReference<DocumentData>> {
  const financeCollection = collection(db, 'financeEntries');
  const sanitizedData = Object.fromEntries(
    Object.entries(entryData).filter(([_, v]) => v !== undefined && v !== null)
  );
  const newEntry = { ...sanitizedData, transactionFee: entryData.transactionFee || 0, createdAt: serverTimestamp() };
  try {
    return await addDoc(financeCollection, newEntry);
  } catch (serverError) {
      const permissionError = new FirestorePermissionError({ path: financeCollection.path, operation: 'create', requestResourceData: newEntry });
      errorEmitter.emit('permission-error', permissionError);
      throw serverError;
  }
}

export async function updateFinanceEntry(db: Firestore, entryId: string, data: { [key: string]: any }) {
    const entryRef = doc(db, 'financeEntries', entryId);
    const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== null));
    try {
        await updateDoc(entryRef, { ...updateData, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: entryRef.path, operation: 'update', requestResourceData: updateData });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteFinanceEntry(db: Firestore, entryId: string) {
    const entryRef = doc(db, 'financeEntries', entryId);
    try {
        await deleteDoc(entryRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: entryRef.path, operation: 'delete' });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function addLoan(db: Firestore, loanData: any): Promise<{docRef: DocumentReference<DocumentData>, newLoanNumber: string}> {
  const loanCollection = collection(db, 'loans');
  let newLoanNumber = `LN-${Date.now().toString().slice(-6)}`;
  try {
    const q = query(loanCollection);
    const snap = await getDocs(q);
    newLoanNumber = `LN-${String(snap.size + 1).padStart(3, '0')}`;
  } catch (e) {}

  const newLoan = {
    ...loanData,
    loanNumber: newLoanNumber,
    createdAt: serverTimestamp(),
    payments: [],
    penalties: [],
    totalPenalties: 0,
    followUpNotes: [],
    disbursementRecorded: false 
  };

  try {
    const docRef = await addDoc(loanCollection, newLoan);
    if (loanData.status === 'active') await recordDisbursement(db, { ...newLoan, id: docRef.id });
    return { docRef, newLoanNumber };
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({ path: loanCollection.path, operation: 'create', requestResourceData: newLoan });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
}

export async function submitCustomerApplication(db: Firestore, customerId: string, loanData: any) {
    const loanCollection = collection(db, 'loans');
    const applicationData = {
        ...loanData,
        customerId,
        status: 'application',
        loanNumber: `APP-${Date.now().toString().slice(-6)}`,
        createdAt: serverTimestamp(),
        payments: [],
        penalties: [],
        totalPenalties: 0,
        followUpNotes: [],
        totalPaid: 0,
        disbursementRecorded: false
    };
    try {
        return await addDoc(loanCollection, applicationData);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: loanCollection.path, operation: 'create', requestResourceData: applicationData });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

async function recordDisbursement(db: Firestore, loan: any) {
    const loanRef = doc(db, 'loans', loan.id);
    const loanSnap = await getDoc(loanRef);
    if (loanSnap.exists() && loanSnap.data().disbursementRecorded) return;

    const totalFees = (Number(loan.registrationFee) || 0) + (Number(loan.processingFee) || 0) + (Number(loan.carTrackInstallationFee) || 0) + (Number(loan.chargingCost) || 0);
    const takeHome = Number(loan.principalAmount) - totalFees;
    const disbursementDate = loan.disbursementDate?.seconds ? new Date(loan.disbursementDate.seconds * 1000) : (loan.disbursementDate instanceof Date ? loan.disbursementDate : new Date());

    await addFinanceEntry(db, {
        type: 'payout',
        payoutCategory: 'loan_disbursement',
        date: disbursementDate,
        amount: takeHome,
        description: `Disbursement for Loan #${loan.loanNumber}`,
        loanId: loan.id,
        recordedBy: 'System (Approval)'
    });

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
    const finalUpdate = { ...updateData, status: 'active', instalmentAmount, totalRepayableAmount: totalRepayableAmount + (loan.totalPenalties || 0), updatedAt: serverTimestamp() };
    await updateDoc(loanRef, finalUpdate);
    const loanSnap = await getDoc(loanRef);
    if (loanSnap.exists()) await recordDisbursement(db, { ...loanSnap.data(), id: loan.id });
}

export async function updateLoan(db: Firestore, loanId: string, data: { [key: string]: any }) {
    const loanRef = doc(db, 'loans', loanId);
    if (data.status === 'active') {
        const loanSnap = await getDoc(loanRef);
        if (loanSnap.exists() && !loanSnap.data().disbursementRecorded) {
            await recordDisbursement(db, { ...loanSnap.data(), id: loanId, ...data });
            data.disbursementRecorded = true;
        }
    }
    const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== null));
    try {
        await updateDoc(loanRef, { ...updateData, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: loanRef.path, operation: 'update', requestResourceData: updateData });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function recordLoanPayment(db: Firestore, loanId: string, payment: { amount: number, date: Date, recordedBy?: string }) {
    const loanRef = doc(db, 'loans', loanId);
    try {
        await updateDoc(loanRef, {
            totalPaid: increment(payment.amount),
            payments: arrayUnion({ paymentId: doc(collection(db, 'temp')).id, ...payment }),
            updatedAt: serverTimestamp()
        });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: loanRef.path, operation: 'update', requestResourceData: { type: 'LOAN_PAYMENT', amount: payment.amount }});
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function updateCustomer(db: Firestore, customerId: string, data: any) {
    const customerRef = doc(db, 'customers', customerId);
    try {
        await updateDoc(customerRef, { ...data, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: customerRef.path, operation: 'update', requestResourceData: data });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteCustomer(db: Firestore, customerId: string) {
    const customerRef = doc(db, 'customers', customerId);
    try {
        await deleteDoc(customerRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: customerRef.path, operation: 'delete' });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function rolloverLoan(db: Firestore, originalLoan: Loan, rolloverDate: Date) {
    const interestAmount = calculateInterestForOneInstalment(originalLoan.principalAmount, originalLoan.interestRate ?? 0, originalLoan.numberOfInstalments, originalLoan.paymentFrequency);
    if (interestAmount <= 0) throw new Error("Cannot rollover a loan with zero interest.");
    
    try {
        const receiptDocRef = await addDoc(collection(db, 'financeEntries'), {
            type: 'receipt',
            receiptCategory: 'loan_repayment',
            date: rolloverDate,
            amount: interestAmount,
            description: `Rollover interest for Loan #${originalLoan.loanNumber}`,
            loanId: originalLoan.id,
            recordedBy: 'System (Rollover)',
            createdAt: serverTimestamp()
        });

        await updateLoan(db, originalLoan.id, {
            status: 'rollover',
            payments: arrayUnion({ paymentId: receiptDocRef.id, amount: interestAmount, date: rolloverDate, recordedBy: 'System (Rollover)' }),
            totalPaid: increment(interestAmount)
        });

        const snap = await getDocs(query(collection(db, 'loans')));
        const newLoanNumber = `LN-${String(snap.size + 1).padStart(3, '0')}`;

        await addDoc(collection(db, 'loans'), {
            ...originalLoan,
            id: undefined,
            loanNumber: newLoanNumber,
            disbursementDate: rolloverDate,
            status: 'active',
            totalPaid: 0,
            payments: [],
            penalties: [],
            totalPenalties: 0,
            followUpNotes: [],
            comments: `Rollover from Loan #${originalLoan.loanNumber}`,
            createdAt: serverTimestamp(),
            disbursementRecorded: true 
        });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: 'loan_rollover', operation: 'create' });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteLoan(db: Firestore, loanId: string) {
    const loanRef = doc(db, 'loans', loanId);
    try {
        await deleteDoc(loanRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: loanRef.path, operation: 'delete' });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function addPenaltyToLoan(db: Firestore, loanId: string, penalty: { amount: number; date: Date; description: string; recordedBy?: string }) {
    const loanRef = doc(db, 'loans', loanId);
    try {
        await updateDoc(loanRef, {
            penalties: arrayUnion({ penaltyId: doc(collection(db, 'temp')).id, ...penalty }),
            totalPenalties: increment(penalty.amount),
            totalRepayableAmount: increment(penalty.amount)
        });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: loanRef.path, operation: 'update', requestResourceData: { penalties: 'ADD_PENALTY' }});
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function addFollowUpNoteToLoan(db: Firestore, loanId: string, note: { content: string; staffName: string; staffId: string }) {
    const loanRef = doc(db, 'loans', loanId);
    try {
        await updateDoc(loanRef, {
            followUpNotes: arrayUnion({ noteId: doc(collection(db, 'temp')).id, date: new Date(), ...note }),
            updatedAt: serverTimestamp()
        });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: loanRef.path, operation: 'update', requestResourceData: { followUpNotes: 'ADD_FOLLOW_UP_NOTE' }});
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function createUserProfile(db: Firestore, userId: string, data: any) {
    const userRef = doc(db, 'users', userId);
    const profileData = { uid: userId, email: data.email, role: data.role, status: data.status || 'approved', name: data.name || data.email.split('@')[0], createdAt: serverTimestamp() };
    try {
        await setDoc(userRef, profileData, { merge: true });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: userRef.path, operation: 'create', requestResourceData: profileData });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function updateUserProfile(db: Firestore, userId: string, data: { [key: string]: any }) {
    const userRef = doc(db, 'users', userId);
    const updateData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
    try {
        await updateDoc(userRef, { ...updateData, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: updateData });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteUserProfile(db: Firestore, userId: string) {
    const userRef = doc(db, 'users', userId);
    try {
        await deleteDoc(userRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: entryRef.path, operation: 'delete' });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function addInvestor(db: Firestore, investorData: any) {
    const investorRef = doc(db, 'investors', investorData.uid);
    const data = { ...investorData, totalWithdrawn: 0, withdrawals: [], deposits: [], interestEntries: [], createdAt: serverTimestamp() };
    try {
        await setDoc(investorRef, data);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'create', requestResourceData: data });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function updateInvestor(db: Firestore, investorId: string, data: any) {
    const investorRef = doc(db, 'investors', investorId);
    const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== null));
    try {
        await updateDoc(investorRef, { ...updateData, updatedAt: serverTimestamp() });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'update', requestResourceData: updateData });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function deleteInvestor(db: Firestore, investorId: string) {
    const investorRef = doc(db, 'investors', investorId);
    try {
        await deleteDoc(investorRef);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'delete' });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function applyInterestToPortfolio(db: Firestore, investorId: string, interestAmount: number, description: string) {
    const investorRef = doc(db, 'investors', investorId);
    try {
        await updateDoc(investorRef, {
            currentBalance: increment(interestAmount),
            interestEntries: arrayUnion({ entryId: doc(collection(db, 'temp')).id, amount: interestAmount, date: new Date(), description }),
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
    try {
        await updateDoc(investorRef, {
            withdrawals: arrayUnion({ withdrawalId: doc(collection(db, 'temp')).id, amount, date: new Date(), status: 'pending' }),
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
    const snap = await getDoc(investorRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const w = data.withdrawals?.find((x: any) => x.withdrawalId === withdrawalId);
    if (!w || w.status !== 'pending') return;

    const updated = data.withdrawals.map((x: any) => x.withdrawalId === withdrawalId ? { ...x, status: 'processed' } : x);
    await updateDoc(investorRef, { withdrawals: updated, currentBalance: increment(-w.amount), totalWithdrawn: increment(w.amount), updatedAt: serverTimestamp() });
}

export async function requestDeposit(db: Firestore, investorId: string, amount: number) {
    const investorRef = doc(db, 'investors', investorId);
    try {
        await updateDoc(investorRef, { deposits: arrayUnion({ depositId: doc(collection(db, 'temp')).id, amount, date: new Date(), status: 'pending' }), updatedAt: serverTimestamp() });
    } catch(e) {
        const permissionError = new FirestorePermissionError({ path: investorRef.path, operation: 'update', requestResourceData: { deposits: 'ADD_DEPOSIT_REQUEST' }});
        errorEmitter.emit('permission-error', permissionError);
        throw e;
    }
}

export async function approveDeposit(db: Firestore, investorId: string, depositId: string) {
    const investorRef = doc(db, 'investors', investorId);
    const snap = await getDoc(investorRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const d = data.deposits?.find((x: any) => x.depositId === depositId);
    if (!d || d.status !== 'pending') return;

    const updated = data.deposits.map((x: any) => x.depositId === depositId ? { ...x, status: 'approved' } : x);
    await updateDoc(investorRef, { deposits: updated, currentBalance: increment(d.amount), totalInvestment: increment(d.amount), updatedAt: serverTimestamp() });
}

export async function rejectDeposit(db: Firestore, investorId: string, depositId: string) {
    const investorRef = doc(db, 'investors', investorId);
    const snap = await getDoc(investorRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const updated = data.deposits.map((x: any) => x.depositId === depositId ? { ...x, status: 'rejected' } : x);
    await updateDoc(investorRef, { deposits: updated, updatedAt: serverTimestamp() });
}
