'use client';

import { useMemo } from 'react';
import { format, addDays, addWeeks, addMonths, isBefore, startOfToday, differenceInDays } from 'date-fns';
import { FileDown, ShieldAlert, CheckCircle2, Clock, Landmark, ListFilter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { exportToCsv } from '@/lib/excel';

interface Loan {
  id: string;
  loanNumber: string;
  customerName: string;
  customerPhone: string;
  disbursementDate: any;
  firstPaymentDate?: any;
  principalAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  instalmentAmount: number;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  numberOfInstalments: number;
  status: string;
  comments?: string;
}

interface PortfolioReportsTabProps {
  loans: Loan[] | null;
}

export function PortfolioReportsTab({ loans }: PortfolioReportsTabProps) {
  
  const getNextDueDate = (loan: Loan) => {
    try {
        // BaseDate is the First Payment Date promised by user.
        let baseDate: Date;
        if (loan.firstPaymentDate?.seconds) {
            baseDate = new Date(loan.firstPaymentDate.seconds * 1000);
        } else if (loan.firstPaymentDate instanceof Date) {
            baseDate = loan.firstPaymentDate;
        } else {
            // Fallback for legacy: First payment is 1 cycle after disbursement
            const dDate = loan.disbursementDate?.seconds 
                ? new Date(loan.disbursementDate.seconds * 1000) 
                : (loan.disbursementDate instanceof Date ? loan.disbursementDate : new Date());
            
            if (loan.paymentFrequency === 'daily') baseDate = addDays(dDate, 1);
            else if (loan.paymentFrequency === 'weekly') baseDate = addWeeks(dDate, 1);
            else baseDate = addMonths(dDate, 1);
        }

        if (isNaN(baseDate.getTime())) return new Date();

        const paidInstalments = Math.floor((loan.totalPaid || 0) / (loan.instalmentAmount || 1));
        const nextIdx = paidInstalments; // nextIdx is the count of cycles from baseDate
        
        if (loan.paymentFrequency === 'daily') return addDays(baseDate, nextIdx);
        if (loan.paymentFrequency === 'weekly') return addWeeks(baseDate, nextIdx);
        return addMonths(baseDate, nextIdx);
    } catch (e) {
        return new Date();
    }
  };

  const generateReportData = (filteredLoans: Loan[]) => {
    return filteredLoans.map(loan => {
      const nextDue = getNextDueDate(loan);
      const balance = (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0);
      
      let dDate: Date;
      if (loan.disbursementDate?.seconds) dDate = new Date(loan.disbursementDate.seconds * 1000);
      else if (loan.disbursementDate instanceof Date) dDate = loan.disbursementDate;
      else dDate = loan.disbursementDate ? new Date(loan.disbursementDate) : new Date();

      return {
        'Loan Number': loan.loanNumber,
        'Customer Name': loan.customerName,
        'Phone': loan.customerPhone,
        'Status': (loan.status || '').toUpperCase(),
        'Principal': loan.principalAmount || 0,
        'Total Repayable': loan.totalRepayableAmount || 0,
        'Total Paid': loan.totalPaid || 0,
        'Outstanding Balance': balance,
        'Frequency': loan.paymentFrequency,
        'Disbursement Date': isNaN(dDate.getTime()) ? 'N/A' : format(dDate, 'yyyy-MM-dd'),
        'Next Due Date': loan.status === 'paid' || loan.status === 'rollover' ? 'N/A' : format(nextDue, 'yyyy-MM-dd'),
        'Comments / Rollover Info': loan.comments || ''
      };
    });
  };

  const handleDownload = (type: 'all' | 'active' | 'overdue' | 'due' | 'paid') => {
    if (!loans) return;

    let filtered: Loan[] = [];
    let filename = 'pezeka_report';
    const today = startOfToday();

    switch (type) {
      case 'all':
        filtered = loans.filter(l => l.status !== 'application' && l.status !== 'rejected');
        filename = 'all_disbursed_loans';
        break;
      case 'active':
        filtered = loans.filter(l => ['active', 'due', 'overdue'].includes(l.status));
        filename = 'active_portfolio';
        break;
      case 'overdue':
        filtered = loans.filter(l => l.status === 'overdue' || (l.status !== 'paid' && l.status !== 'rollover' && isBefore(getNextDueDate(l), today)));
        filename = 'overdue_loans';
        break;
      case 'due':
        filtered = loans.filter(l => {
            if (l.status === 'paid' || l.status === 'application' || l.status === 'rollover') return false;
            const daysUntil = differenceInDays(getNextDueDate(l), today);
            return daysUntil >= 0 && daysUntil <= 7;
        });
        filename = 'loans_due_this_week';
        break;
      case 'paid':
        filtered = loans.filter(l => l.status === 'paid');
        filename = 'settled_loans_history';
        break;
    }

    const data = generateReportData(filtered);
    exportToCsv(data, `${filename}_${format(new Date(), 'ddMMyy')}`);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card className="hover:shadow-md transition-shadow border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-primary">
            <Landmark className="h-5 w-5" />
            <CardTitle className="text-lg">All Disbursed Loans</CardTitle>
          </div>
          <CardDescription>Comprehensive history of every loan ever funded.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => handleDownload('all')} className="w-full" variant="outline">
            <FileDown className="mr-2 h-4 w-4" /> Download Full Record
          </Button>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-blue-600">
            <ListFilter className="h-5 w-5" />
            <CardTitle className="text-lg">Active Portfolio</CardTitle>
          </div>
          <CardDescription>Total outstanding debt currently in the market.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => handleDownload('active')} className="w-full" variant="outline">
            <FileDown className="mr-2 h-4 w-4" /> Download Active Debt
          </Button>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow border-l-4 border-l-destructive">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <CardTitle className="text-lg">Overdue Loans</CardTitle>
          </div>
          <CardDescription>Accounts that have missed their payment dates.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => handleDownload('overdue')} className="w-full" variant="destructive">
            <FileDown className="mr-2 h-4 w-4" /> Download Delinquency
          </Button>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-orange-600">
            <Clock className="h-5 w-5" />
            <CardTitle className="text-lg">Loans Due Soon</CardTitle>
          </div>
          <CardDescription>Accounts with installments due in the next 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => handleDownload('due')} className="w-full" variant="outline">
            <FileDown className="mr-2 h-4 w-4" /> Download Due List
          </Button>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-600">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <CardTitle className="text-lg">Fully Paid Loans</CardTitle>
          </div>
          <CardDescription>Success stories and fully recovered facilities.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => handleDownload('paid')} className="w-full" variant="outline">
            <FileDown className="mr-2 h-4 w-4" /> Download Paid History
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}