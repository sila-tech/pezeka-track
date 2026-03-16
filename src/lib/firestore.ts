
'use client';

import { addDoc, collection, Firestore, serverTimestamp, DocumentReference, DocumentData, doc, updateDoc, deleteDoc, arrayUnion, increment, getDocs, query, setDoc, getDoc, where } from 'firebase/firestore';
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
}

export interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
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

/**
 * Logs a sent email to the mail_logs collection.
 */
export async function addMailLog(db: Firestore, logData: { recipient: string, subject: string, body: string, type: string, sender: string }) {
    const logsCollection = collection(db, 'mail_logs');
    try {
        await addDoc(logsCollection, {
            ...logData,
            sentAt: serverTimestamp()
        });
    } catch (e) {
        console.error("Failed to log email to Firestore", e);
    }
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

export async function addCustomer(db: Firestore, customerData: CustomerData): Promise<DocumentReference<DocumentData>> {
  const customerCollection = collection(db, 'customers');
  
  const accountNumber = await generateAccountNumber(db);

  const newCustomer = {
    ...customerData,
    accountNumber,
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
    let finalData = { ...customerData, updatedAt: serverTimestamp() };

    if (!existingSnap.exists()) {
        const accountNumber = await generateAccountNumber(db);
        finalData = { ...finalData, ...({ accountNumber } as any) };
        
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

  // Filter out any undefined or null values to prevent Firestore crashes
  const sanitizedData = Object.fromEntries(
    Object.entries(entryData).filter(([_, v]) => v !== undefined && v !== null)
  );

  const newEntry = {
    ...sanitizedData,
    transactionFee: entryData.transactionFee || 0,
    createdAt: serverTimestamp(),
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
    const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== null));
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
  
  let newLoanNumber = `APP-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const q = query(loanCollection);
    const querySnapshot = await getDocs(q);
    const loanCount = querySnapshot.size;
    newLoanNumber = `LN-${String(loanCount + 1).padStart(3, '0')}`;
  } catch (e) {
    newLoanNumber = `APP-${Date.now().toString().slice(-6)}`;
  }

  // Ensure we capture customer email for notifications
  let customerEmail = loanData.customerEmail || "";
  if (!customerEmail && loanData.customerId) {
      try {
          const cSnap = await getDoc(doc(db, 'customers', loanData.customerId));
          if (cSnap.exists()) customerEmail = cSnap.data().email || "";
      } catch (e) {
          console.error("Failed to pre-fetch customer email", e);
      }
  }

  const newLoan = {
    ...loanData,
    customerEmail,
    loanNumber: newLoanNumber,
    createdAt: serverTimestamp(),
    payments: [],
    penalties: [],
    totalPenalties: 0,
    followUpNotes: [],
    comments: loanData.comments || "",
    disbursementRecorded: false 
  };

  try {
    const docRef = await addDoc(loanCollection, newLoan);
    
    if (loanData.status === 'active') {
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

/**
 * Specifically for Customer side applications.
 * Ensures the application is immediately visible to admins for review.
 */
export async function submitCustomerApplication(db: Firestore, customerId: string, loanData: any) {
    const loanCollection = collection(db, 'loans');
    
    let customerEmail = "";
    try {
        const cSnap = await getDoc(doc(db, 'customers', customerId));
        if (cSnap.exists()) customerEmail = cSnap.data().email || "";
    } catch (e) {}

    const applicationData = {
        ...loanData,
        customerId,
        customerEmail,
        status: 'application',
        loanNumber: `APP-${Date.now().toString().slice(-6)}`,
        createdAt: serverTimestamp(),
        disbursementDate: serverTimestamp(),
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
        const permissionError = new FirestorePermissionError({
            path: loanCollection.path,
            operation: 'create',
            requestResourceData: applicationData,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

async function recordDisbursement(db: Firestore, loan: any) {
    const loanRef = doc(db, 'loans', loan.id);
    const loanSnap = await getDoc(loanRef);
    if (loanSnap.exists() && loanSnap.data().disbursementRecorded) return;

    const reg = Number(loan.registrationFee) || 0;
    const proc = Number(loan.processingFee) || 0;
    const track = Number(loan.carTrackInstallationFee) || 0;
    const charge = Number(loan.chargingCost) || 0;
    const totalFees = reg + proc + track + charge;
    
    const takeHome = Number(loan.principalAmount) - totalFees;
    
    const disbursementDate = loan.disbursementDate instanceof Date 
        ? loan.disbursementDate 
        : (loan.disbursementDate?.seconds ? new Date(loan.disbursementDate.seconds * 1000) : new Date());

    await addFinanceEntry(db, {
        type: 'payout',
        payoutCategory: 'loan_disbursement',
        date: disbursementDate,
        amount: takeHome,
        transactionFee: 0,
        description: `Disbursement for Loan #${loan.loanNumber}. Principal: Ksh ${Number(loan.principalAmount).toLocaleString()}, Retained Fees: Ksh ${totalFees.toLocaleString()}`,
        loanId: loan.id,
        recordedBy: 'System (Approval)'
    });

    await updateDoc(loanRef, { disbursementRecorded: true });

    // Send the approval notification
    const email = loan.customerEmail || loan.email;
    if (email) {
        sendAutomatedEmail({
            type: 'loan_approved',
            recipientEmail: email,
            data: {
                customerName: loan.customerName,
                loanNumber: loan.loanNumber,
                amount: takeHome,
                balance: loan.totalRepayableAmount,
                dueDate: 'Refer to Portal'
            }
        }).then(res => {
            if (res.success && res.sentContent) {
                addMailLog(db, { ...res.sentContent, sender: 'AI Automation' });
            }
        });
    }
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
        totalRepayableAmount: totalRepayableAmount + (loan.totalPenalties || 0),
        updatedAt: serverTimestamp()
    };

    await updateDoc(loanRef, finalUpdate);
    
    // Ensure we have the full context including ID for recordDisbursement
    const loanSnap = await getDoc(loanRef);
    const fullLoanData = { ...loanSnap.data(), id: loan.id };
    await recordDisbursement(db, fullLoanData);
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

    const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== null));

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

/**
 * Specifically handles recording a payment, updating totals, and triggering notifications.
 */
export async function recordLoanPayment(db: Firestore, loanId: string, payment: { amount: number, date: Date, recordedBy?: string }) {
    const loanRef = doc(db, 'loans', loanId);
    const paymentId = doc(collection(db, 'temp')).id;
    const paymentEntry = { paymentId, ...payment };

    try {
        // 1. Update the document
        await updateDoc(loanRef, {
            totalPaid: increment(payment.amount),
            payments: arrayUnion(paymentEntry),
            updatedAt: serverTimestamp()
        });

        // 2. Fetch fresh data for the email (to get the exact current balance)
        const loanSnap = await getDoc(loanRef);
        if (loanSnap.exists()) {
            const loan = { ...loanSnap.data(), id: loanId } as Loan;
            const email = loan.customerEmail || "";
            if (email) {
                const balance = (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0);
                sendAutomatedEmail({
                    type: 'payment_received',
                    recipientEmail: email,
                    data: {
                        customerName: loan.customerName,
                        loanNumber: loan.loanNumber,
                        amount: payment.amount,
                        balance: balance
                    }
                }).then(res => {
                    if (res.success && res.sentContent) {
                        addMailLog(db, { ...res.sentContent, sender: 'AI Automation' });
                    }
                });
            }
        }
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: loanRef.path,
            operation: 'update',
            requestResourceData: { type: 'LOAN_PAYMENT', amount: payment.amount },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}


type CustomerUpdateData = {
  name: string;
  phone: string;
  email?: string;
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
        transactionFee: 0,
        description: receiptDescription,
        loanId: originalLoan.id,
        recordedBy: 'System (Rollover)'
    };
    const receiptDocRef = await addFinanceEntry(db, receiptData);

    const interestPayment = {
        paymentId: receiptDocRef.id,
        amount: interestAmount,
        date: rolloverDate,
        recordedBy: 'System (Rollover)'
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
        customerEmail: originalLoan.customerEmail || "",
        alternativeNumber: originalLoan.alternativeNumber || "",
        idNumber: originalLoan.idNumber || "",
        assignedStaffId: originalLoan.assignedStaffId || "",
        assignedStaffName: originalLoan.assignedStaffName || "",
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
        penalties: [],
        totalPenalties: 0,
        followUpNotes: [],
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

export async function addPenaltyToLoan(db: Firestore, loanId: string, penalty: { amount: number; date: Date; description: string; recordedBy?: string }) {
    const loanRef = doc(db, 'loans', loanId);
    const penaltyId = doc(collection(db, 'temp')).id;

    const penaltyWithId = { ...penalty, penaltyId };

    try {
        const loanSnap = await getDoc(loanRef);
        const loanData = loanSnap.data() as Loan;

        await updateDoc(loanRef, {
            penalties: arrayUnion(penaltyWithId),
            totalPenalties: increment(penalty.amount),
            totalRepayableAmount: increment(penalty.amount)
        });

        const email = loanData.customerEmail || "";
        if (email) {
            sendAutomatedEmail({
                type: 'penalty_applied',
                recipientEmail: email,
                data: {
                    customerName: loanData.customerName,
                    loanNumber: loanData.loanNumber,
                    amount: penalty.amount,
                    description: penalty.description,
                    balance: (loanData.totalRepayableAmount + penalty.amount - (loanData.totalPaid || 0))
                }
            }).then(res => {
                if (res.success && res.sentContent) {
                    addMailLog(db, { ...res.sentContent, sender: 'AI Automation' });
                }
            });
        }
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: loanRef.path,
            operation: 'update',
            requestResourceData: { penalties: 'ADD_PENALTY' },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function addFollowUpNoteToLoan(db: Firestore, loanId: string, note: { content: string; staffName: string; staffId: string }) {
    const loanRef = doc(db, 'loans', loanId);
    const noteId = doc(collection(db, 'temp')).id;
    const newNote = {
        ...note,
        noteId,
        date: new Date(),
    };

    try {
        await updateDoc(loanRef, {
            followUpNotes: arrayUnion(newNote),
            updatedAt: serverTimestamp()
        });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: loanRef.path,
            operation: 'update',
            requestResourceData: { followUpNotes: 'ADD_FOLLOW_UP_NOTE' },
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
    const updateData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));

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
        totalWithdrawn: 0,
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
     const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== null));
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

export async function updateInvestorInterestEntry(db: Firestore, investorId: string, entryId: string, newAmount: number, newDescription: string) {
    const ref = doc(db, 'investors', investorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const entries = data.interestEntries || [];
    const entry = entries.find((e: any) => e.entryId === entryId);
    if (!entry) return;
    const diff = newAmount - entry.amount;
    const updatedEntries = entries.map((e: any) => e.entryId === entryId ? { ...e, amount: newAmount, description: newDescription } : e);
    await updateDoc(ref, {
        interestEntries: updatedEntries,
        currentBalance: increment(diff),
        updatedAt: serverTimestamp()
    });
}

export async function deleteInvestorInterestEntry(db: Firestore, investorId: string, entryId: string) {
    const ref = doc(db, 'investors', investorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const entries = data.interestEntries || [];
    const entry = entries.find((e: any) => e.entryId === entryId);
    if (!entry) return;
    const updatedEntries = entries.filter((e: any) => e.entryId !== entryId);
    await updateDoc(ref, {
        interestEntries: updatedEntries,
        currentBalance: increment(-entry.amount),
        updatedAt: serverTimestamp()
    });
}

export async function updateInvestorDepositEntry(db: Firestore, investorId: string, depositId: string, newAmount: number) {
    const ref = doc(db, 'investors', investorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const deposits = data.deposits || [];
    const deposit = deposits.find((d: any) => d.depositId === depositId);
    if (!deposit) return;

    const diff = newAmount - deposit.amount;
    const updatedDeposits = deposits.map((d: any) => d.depositId === depositId ? { ...d, amount: newAmount } : d);
    
    const updateData: any = {
        deposits: updatedDeposits,
        updatedAt: serverTimestamp()
    };

    if (deposit.status === 'approved') {
        updateData.currentBalance = increment(diff);
        updateData.totalInvestment = increment(diff);
    }

    await updateDoc(ref, updateData);
}

export async function deleteInvestorDepositEntry(db: Firestore, investorId: string, depositId: string) {
    const ref = doc(db, 'investors', investorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const deposits = data.deposits || [];
    const deposit = deposits.find((d: any) => d.depositId === depositId);
    if (!deposit) return;

    const updatedDeposits = deposits.filter((d: any) => d.depositId !== depositId);
    const updateData: any = {
        deposits: updatedDeposits,
        updatedAt: serverTimestamp()
    };

    if (deposit.status === 'approved') {
        updateData.currentBalance = increment(-deposit.amount);
        updateData.totalInvestment = increment(-deposit.amount);
    }

    await updateDoc(ref, updateData);
}

export async function updateInvestorWithdrawalEntry(db: Firestore, investorId: string, withdrawalId: string, newAmount: number) {
    const ref = doc(db, 'investors', investorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const withdrawals = data.withdrawals || [];
    const withdrawal = withdrawals.find((w: any) => w.withdrawalId === withdrawalId);
    if (!withdrawal) return;

    const diff = newAmount - withdrawal.amount;
    const updatedWithdrawals = withdrawals.map((w: any) => w.withdrawalId === withdrawalId ? { ...w, amount: newAmount } : w);
    
    const updateData: any = {
        withdrawals: updatedWithdrawals,
        updatedAt: serverTimestamp()
    };

    if (withdrawal.status === 'processed') {
        updateData.currentBalance = increment(-diff);
        updateData.totalWithdrawn = increment(diff);
    }

    await updateDoc(ref, updateData);
}

export async function deleteInvestorWithdrawalEntry(db: Firestore, investorId: string, withdrawalId: string) {
    const ref = doc(db, 'investors', investorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const withdrawals = data.withdrawals || [];
    const withdrawal = withdrawals.find((w: any) => w.withdrawalId === withdrawalId);
    if (!withdrawal) return;

    const updatedWithdrawals = withdrawals.filter((w: any) => w.withdrawalId !== withdrawalId);
    const updateData: any = {
        withdrawals: updatedWithdrawals,
        updatedAt: serverTimestamp()
    };

    if (withdrawal.status === 'processed') {
        updateData.currentBalance = increment(withdrawal.amount);
        updateData.totalWithdrawn = increment(-withdrawal.amount);
    }

    await updateDoc(ref, updateData);
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
        transactionFee: 0,
        description: `Investor withdrawal for ${investorData.name}`,
        recordedBy: 'System (Withdrawal)'
    });

    try {
         await updateDoc(investorRef, {
            withdrawals: updatedWithdrawals,
            currentBalance: increment(-withdrawal.amount),
            totalWithdrawn: increment(withdrawal.amount),
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
        transactionFee: 0,
        description: `Investor deposit from ${investorData.name}`,
        recordedBy: 'System (Deposit)'
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
