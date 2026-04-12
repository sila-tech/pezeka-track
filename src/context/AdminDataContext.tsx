'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useCollection } from '@/firebase';
import { useAppUser } from '@/firebase';

// Re-use the same loan shape used across admin pages
export interface AdminLoan {
  id: string;
  loanNumber: string;
  customerName: string;
  customerPhone: string;
  customerId: string;
  accountNumber?: string;
  displayName?: string;
  status: string;
  disbursementDate?: any;
  firstPaymentDate?: any;
  preferredPaymentDay?: string;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  numberOfInstalments: number;
  instalmentAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  principalAmount: number;
  idNumber?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  followUpNotes?: any[];
  payments?: { amount: number; date: any; staffId?: string }[];
  createdAt?: any;
  nextDueDate?: Date;
}

interface AdminDataContextValue {
  loans: AdminLoan[] | null;
  loansLoading: boolean;
}

const AdminDataContext = createContext<AdminDataContextValue>({
  loans: null,
  loansLoading: true,
});

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAppUser();

  const isSuperAdmin =
    user?.email?.toLowerCase()?.trim() === 'simon@pezeka.com' ||
    user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2' ||
    user?.uid === 'Z8gkNLZEVUWbsooR8R7OuHxApB62';
  const isFinance = user?.role?.toLowerCase()?.trim() === 'finance';
  const isStaff = user?.role?.toLowerCase()?.trim() === 'staff';
  const isAuthorized = user && (isSuperAdmin || isFinance || isStaff);

  // ✅ Single subscription for the entire admin section
  const { data: loans, loading: loansLoading } = useCollection<AdminLoan>(
    isAuthorized ? 'loans' : null
  );

  return (
    <AdminDataContext.Provider value={{ loans, loansLoading }}>
      {children}
    </AdminDataContext.Provider>
  );
}

/** Use this hook in any admin component instead of useCollection('loans') */
export function useAdminLoans() {
  return useContext(AdminDataContext);
}
