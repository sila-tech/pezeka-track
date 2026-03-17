'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns";
import { PlusCircle, Loader2, Pencil, Trash2, FileBarChart, Search, X } from "lucide-react";

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { addFinanceEntry, updateLoan, rolloverLoan, updateFinanceEntry, deleteFinanceEntry, deleteLoan, addLoan, addCustomer } from '@/lib/firestore';
import { EditableFinanceReportTab, DatePickerWithRange } from './components/editable-finance-report-tab';
import { InvestorsPortfolioTab } from './components/investors-portfolio-tab';
import { StaffPortfoliosTab } from './components/staff-portfolios-tab';
import { PortfolioReportsTab } from './components/portfolio-reports-tab';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateAmortization } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DateRange } from 'react-day-picker';

const addFinanceEntrySchema = z.object({
  type: z.enum(['receipt', 'payout', 'expense']),
  date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  transactionFee: z.coerce.number().optional(),
  description: z.string().min(1, "Purpose/Description is required"),
  loanId: z.string().optional(),
  expenseCategory: z.enum(['facilitation_commission', 'office_purchase', 'other']).optional(),
  receiptCategory: z.enum(['loan_repayment', 'upfront_fees', 'investment', 'other']).optional(),
  payoutCategory: z.enum(['loan_disbursement', 'investor_withdrawal', 'other']).optional(),
});

const loanSchema = z.object({
  customerId: z.string().optional(),
  disbursementDate: z.string().min(1, 'Disbursement date is required.'),
  principalAmount: z.coerce.number().min(1, 'Principal amount is required.'),
  interestRate: z.coerce.number().min(0, 'Interest rate is required.'),
  numberOfInstalments: z.coerce.number().int().min(1, 'Instalments required.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  status: z.enum(['active', 'application']),
  assignedStaffId: z.string().min(1, 'Staff required.'),
  customerType: z.enum(['existing', 'new']),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
  idNumber: z.string().min(1, "ID required."),
});

interface Loan {
  id: string;
  loanNumber: string;
  customerName: string;
  customerPhone: string;
  disbursementDate: any;
  principalAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  status: string;
  paymentFrequency: string;
  numberOfInstalments: number;
  instalmentAmount: number;
}

export default function FinancePage() {
  const [open, setOpen] = useState(false);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lbSearch, setLbSearch] = useState('');
  const [lbStatus, setLbStatus] = useState('all');
  const [lbDate, setLbDate] = useState<DateRange | undefined>();

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isAuthorized = user?.role === 'finance' || user?.email === 'simon@pezeka.com';

  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<any>(isAuthorized ? 'financeEntries' : null);
  const { data: staffList } = useCollection<any>(isAuthorized ? 'users' : null);
  const { data: customers } = useCollection<any>(isAuthorized ? 'customers' : null);

  const financialData = useMemo(() => {
    const receipts: any[] = [];
    const payouts: any[] = [];
    if (!loans || !financeEntries) return { allReceipts: [], allPayouts: [] };
    
    financeEntries.forEach(e => {
        if (e.type === 'receipt') receipts.push(e);
        else payouts.push(e);
    });

    return { allReceipts: receipts, allPayouts: payouts };
  }, [loans, financeEntries]);

  const filteredLoanBook = useMemo(() => {
      if (!loans) return [];
      return loans.filter(loan => {
          if (loan.status === 'application' || loan.status === 'rejected') return false;
          const searchMatch = !lbSearch || loan.customerName.toLowerCase().includes(lbSearch.toLowerCase());
          const statusMatch = lbStatus === 'all' || loan.status === lbStatus;
          return searchMatch && statusMatch;
      });
  }, [loans, lbSearch, lbStatus]);

  if (userLoading || loansLoading || financeEntriesLoading) return <div className="flex h-full w-full items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAuthorized) return <div className="p-12 text-center font-bold">Access Denied</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Finance Ledger</h1>
      
      <Tabs defaultValue="loanbook" className="w-full">
          <TabsList className="mb-4">
              <TabsTrigger value="loanbook">Internal Loan Book</TabsTrigger>
              <TabsTrigger value="reports">Portfolio Reports</TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
              <TabsTrigger value="payouts">Payouts & Expenses</TabsTrigger>
              <TabsTrigger value="investors">Investors</TabsTrigger>
              <TabsTrigger value="staff">Staff Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="loanbook">
              <Card>
                  <CardHeader>
                      <div className="flex items-center justify-between">
                          <CardTitle>Internal Loan Book</CardTitle>
                          <div className="flex gap-2">
                              <Input placeholder="Search client..." value={lbSearch} onChange={(e) => setLbSearch(e.target.value)} className="w-[200px]" />
                              <Select value={lbStatus} onValueChange={setLbStatus}>
                                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="all">All Status</SelectItem>
                                      <SelectItem value="active">Active</SelectItem>
                                      <SelectItem value="paid">Paid</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="p-0">
                      <ScrollArea className="h-[65vh] w-full">
                          <Table className="min-w-[1200px]">
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Client Name</TableHead>
                                      <TableHead>Loan No.</TableHead>
                                      <TableHead className="text-right">Principal</TableHead>
                                      <TableHead className="text-right">Total Repayable</TableHead>
                                      <TableHead className="text-right text-green-600">Paid</TableHead>
                                      <TableHead className="text-right text-destructive">Balance</TableHead>
                                      <TableHead className="text-center">Status</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {filteredLoanBook.map(loan => (
                                      <TableRow key={loan.id}>
                                          <TableCell className="font-bold">{loan.customerName}</TableCell>
                                          <TableCell className="font-mono text-xs">{loan.loanNumber}</TableCell>
                                          <TableCell className="text-right">{loan.principalAmount.toLocaleString()}</TableCell>
                                          <TableCell className="text-right">{loan.totalRepayableAmount.toLocaleString()}</TableCell>
                                          <TableCell className="text-right text-green-600">{loan.totalPaid.toLocaleString()}</TableCell>
                                          <TableCell className="text-right font-black text-destructive">{(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}</TableCell>
                                          <TableCell className="text-center"><Badge variant="outline">{loan.status}</Badge></TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                          <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="reports"><PortfolioReportsTab loans={loans} /></TabsContent>
          <TabsContent value="receipts"><EditableFinanceReportTab title="Receipts" description="Incoming cash flow." entries={financialData.allReceipts} loading={financeEntriesLoading} /></TabsContent>
          <TabsContent value="payouts"><EditableFinanceReportTab title="Payouts" description="Outgoing cash flow." entries={financialData.allPayouts} loading={financeEntriesLoading} /></TabsContent>
          <TabsContent value="investors"><InvestorsPortfolioTab /></TabsContent>
          <TabsContent value="staff"><StaffPortfoliosTab loans={loans} staffList={staffList}/></TabsContent>
      </Tabs>
    </div>
  );
}
