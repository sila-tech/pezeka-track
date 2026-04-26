'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useCollection } from '@/firebase';
import { useAppUser } from '@/firebase';
import { canAccessStaffModules } from '@/lib/admin-auth';

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

export interface AdminInvestor {
  uid: string;
  name: string;
  email: string;
  phone: string;
  totalInvestment: number;
  currentBalance: number;
  status: string;
  deposits: any[];
  withdrawals: any[];
}

export interface AdminInvestmentApp {
  uid: string;
  name: string;
  amount: number;
  status: string;
}

interface AdminDataContextValue {
  loans: AdminLoan[] | null;
  loansLoading: boolean;
  investors: AdminInvestor[] | null;
  investorsLoading: boolean;
  investmentApps: AdminInvestmentApp[] | null;
  investmentAppsLoading: boolean;
}

const AdminDataContext = createContext<AdminDataContextValue>({
  loans: null,
  loansLoading: true,
  investors: null,
  investorsLoading: true,
  investmentApps: null,
  investmentAppsLoading: true,
});

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAppUser();

  const isAuthorized = canAccessStaffModules(user);

  // ✅ Single subscription for the entire admin section
  const { data: loans, loading: loansLoading } = useCollection<AdminLoan>(
    isAuthorized ? 'loans' : null
  );

  const { data: investors, loading: investorsLoading } = useCollection<AdminInvestor>(
    isAuthorized ? 'investors' : null
  );

  const { data: investmentApps, loading: investmentAppsLoading } = useCollection<AdminInvestmentApp>(
    isAuthorized ? 'investmentApplications' : null
  );

  return (
    <AdminDataContext.Provider value={{ 
        loans, loansLoading, 
        investors, investorsLoading, 
        investmentApps, investmentAppsLoading 
    }}>
      {children}
    </AdminDataContext.Provider>
  );
}

/** Use this hook in any admin component instead of useCollection('loans') */
export function useAdminLoans() {
  return useContext(AdminDataContext);
}
