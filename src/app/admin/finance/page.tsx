'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format, addDays, addWeeks, addMonths, differenceInDays } from "date-fns";
import { PlusCircle, Loader2, AlertCircle, History, Info, Pencil, Trash2, FileBarChart, Search, X } from "lucide-react";
import { arrayUnion, increment, doc, collection } from 'firebase/firestore';

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { addFinanceEntry, updateLoan, rolloverLoan, addPenaltyToLoan, updateFinanceEntry, deleteFinanceEntry } from '@/lib/firestore';
import { EditableFinanceReportTab, DatePickerWithRange } from './components/editable-finance-report-tab';
import { InvestorsPortfolioTab } from './components/investors-portfolio-tab';
import { StaffPortfoliosTab } from './components/staff-portfolios-tab';
import { PortfolioReportsTab } from './components/portfolio-reports-tab';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateInterestForOneInstalment, calculateAmortization } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
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

const editLedgerSchema = z.object({
    principalAmount: z.coerce.number().min(1, 'Principal is required'),
    registrationFee: z.coerce.number().min(0),
    processingFee: z.coerce.number().min(0),
    carTrackInstallationFee: z.coerce.number().min(0),
    chargingCost: z.coerce.number().min(0),
    interestRate: z.coerce.number().min(0),
    numberOfInstalments: z.coerce.number().int().min(1),
    paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
    assignedStaffId: z.string().min(1, 'Staff member is required'),
    disbursementDate: z.string().min(1, 'Date is required'),
    totalRepayableAmount: z.coerce.number().min(0, 'Amount to pay is required'),
});

interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  disbursementDate: any;
  principalAmount: number;
  interestRate?: number;
  totalRepayableAmount: number;
  totalPaid: number;
  totalPenalties?: number;
  instalmentAmount: number;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  numberOfInstalments: number;
  registrationFee: number;
  processingFee: number;
  carTrackInstallationFee: number;
  chargingCost: number;
  status: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  payments?: { paymentId: string; date: any; amount: number; recordedBy?: string; }[];
  penalties?: any[];
  comments?: string;
}

interface FinanceEntry {
  id: string;
  type: 'receipt' | 'payout' | 'expense';
  date: any;
  amount: number;
  transactionFee?: number;
  description: string;
  loanId?: string;
  recordedBy?: string;
  expenseCategory?: string;
  receiptCategory?: string;
  payoutCategory?: string;
}

export default function FinancePage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanHistoryToShow, setLoanHistoryToShow] = useState<Loan | null>(null);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<FinanceEntry | null>(null);
  
  // Loan Book Filters
  const [lbSearch, setLbSearch] = useState('');
  const [lbStatus, setLbStatus] = useState('all');
  const [lbStaff, setLbStaff] = useState('all');
  const [lbDate, setLbDate] = useState<DateRange | undefined>();
  
  // Loan Ledger Edit
  const [loanToEditLedger, setLoanToEditLedger] = useState<Loan | null>(null);

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isSuperAdmin = user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
  const isFinance = user?.role?.toLowerCase() === 'finance';
  const isAuthorized = isSuperAdmin || isFinance;

  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<FinanceEntry>(isAuthorized ? 'financeEntries' : null);
  const { data: staffList } = useCollection<any>(isAuthorized ? 'users' : null);

  const ledgerForm = useForm<z.infer<typeof editLedgerSchema>>({
      resolver: zodResolver(editLedgerSchema),
  });

  const financialData = useMemo(() => {
    const receipts: any[] = [];
    const payouts: any[] = [];
    if (!loans || !financeEntries) return { allReceipts: [], allPayouts: [] };
    
    loans.filter(l => l.status !== 'application' && l.status !== 'rejected').forEach(loan => {
        (loan.payments || []).forEach(p => receipts.push({ 
            id: p.paymentId, 
            date: p.date, 
            amount: p.amount, 
            description: `Repayment: Loan #${loan.loanNumber}`, 
            receiptCategory: 'loan_repayment',
            type: 'receipt',
            recordedBy: p.recordedBy || 'System (Payment)',
            isSystemGenerated: true
        }));
    });

    financeEntries.forEach(e => {
        if (e.type === 'receipt') receipts.push(e);
        else payouts.push(e);
    });

    const sortByDate = (a: any, b: any) => {
        const d1 = a.date?.seconds ? a.date.seconds : (a.date instanceof Date ? a.date.getTime() / 1000 : new Date(a.date).getTime() / 1000);
        const d2 = b.date?.seconds ? b.date.seconds : (b.date instanceof Date ? b.date.getTime() / 1000 : new Date(b.date).getTime() / 1000);
        return (d2 || 0) - (d1 || 0);
    };

    return { 
        allReceipts: receipts.sort(sortByDate), 
        allPayouts: payouts.sort(sortByDate) 
    };
  }, [loans, financeEntries]);

  const filteredLoanBook = useMemo(() => {
      if (!loans) return [];
      return loans.filter(loan => {
          if (loan.status === 'application' || loan.status === 'rejected') return false;
          
          const searchMatch = !lbSearch || 
              (loan.customerName || '').toLowerCase().includes(lbSearch.toLowerCase()) ||
              (loan.loanNumber || '').toLowerCase().includes(lbSearch.toLowerCase()) ||
              (loan.customerPhone || '').includes(lbSearch);
              
          const statusMatch = lbStatus === 'all' || loan.status === lbStatus;
          const staffMatch = lbStaff === 'all' || loan.assignedStaffId === lbStaff;
          
          let dateMatch = true;
          if (lbDate?.from) {
              const dDate = loan.disbursementDate?.seconds 
                ? new Date(loan.disbursementDate.seconds * 1000) 
                : (loan.disbursementDate instanceof Date ? loan.disbursementDate : new Date(loan.disbursementDate));
              
              if (isNaN(dDate.getTime())) {
                  dateMatch = false;
              } else {
                  const start = new Date(lbDate.from);
                  start.setHours(0,0,0,0);
                  const end = lbDate.to ? new Date(lbDate.to) : new Date(lbDate.from);
                  end.setHours(23,59,59,999);
                  dateMatch = dDate >= start && dDate <= end;
              }
          }
          
          return searchMatch && statusMatch && staffMatch && dateMatch;
      });
  }, [loans, lbSearch, lbStatus, lbStaff, lbDate]);

  const addForm = useForm<z.infer<typeof addFinanceEntrySchema>>({
    resolver: zodResolver(addFinanceEntrySchema),
    defaultValues: { 
        date: format(new Date(), 'yyyy-MM-dd'), 
        amount: 0, 
        type: 'receipt', 
        description: '', 
        transactionFee: 0 
    }
  });

  const typeWatch = addForm.watch('type');

  const handleEditEntry = (entry: FinanceEntry) => {
      if ((entry as any).isSystemGenerated) {
          toast({ variant: 'destructive', title: 'System Entry', description: 'Loan repayments must be edited from the Loans page.' });
          return;
      }
      setEditingEntry(entry);
      let dateStr = format(new Date(), 'yyyy-MM-dd');
      if (entry.date?.seconds) dateStr = format(new Date(entry.date.seconds * 1000), 'yyyy-MM-dd');
      else if (entry.date instanceof Date) dateStr = format(entry.date, 'yyyy-MM-dd');
      else if (entry.date) dateStr = format(new Date(entry.date), 'yyyy-MM-dd');

      addForm.reset({
          type: entry.type,
          amount: entry.amount,
          date: dateStr,
          description: entry.description || '',
          transactionFee: entry.transactionFee || 0,
          expenseCategory: entry.expenseCategory as any,
          receiptCategory: entry.receiptCategory as any,
          payoutCategory: entry.payoutCategory as any,
      });
      setOpen(true);
  };

  const handleEditLedger = (loan: Loan) => {
      setLoanToEditLedger(loan);
      const dDate = loan.disbursementDate?.seconds 
        ? new Date(loan.disbursementDate.seconds * 1000) 
        : (loan.disbursementDate instanceof Date ? loan.disbursementDate : new Date(loan.disbursementDate));
      
      ledgerForm.reset({
          principalAmount: loan.principalAmount || 0,
          registrationFee: loan.registrationFee || 0,
          processingFee: loan.processingFee || 0,
          carTrackInstallationFee: loan.carTrackInstallationFee || 0,
          chargingCost: loan.chargingCost || 0,
          interestRate: loan.interestRate || 0,
          numberOfInstalments: loan.numberOfInstalments || 1,
          paymentFrequency: loan.paymentFrequency || 'monthly',
          assignedStaffId: loan.assignedStaffId || '',
          disbursementDate: isNaN(dDate.getTime()) ? format(new Date(), 'yyyy-MM-dd') : format(dDate, 'yyyy-MM-dd'),
          totalRepayableAmount: loan.totalRepayableAmount || 0,
      });
  };

  async function onLedgerSubmit(values: z.infer<typeof editLedgerSchema>) {
      if (!loanToEditLedger) return;
      setIsSubmitting(true);
      try {
          const assignedStaff = staffList?.find(s => (s.uid || s.id) === values.assignedStaffId);
          
          // Manual input for Total Repayable is respected. Recalculate instalment based on manual total.
          const instalmentAmount = values.numberOfInstalments > 0 ? values.totalRepayableAmount / values.numberOfInstalments : 0;

          const updateData = {
              ...values,
              disbursementDate: new Date(values.disbursementDate),
              assignedStaffName: assignedStaff?.name || assignedStaff?.email || "Unknown",
              instalmentAmount,
              totalRepayableAmount: values.totalRepayableAmount,
          };
          
          await updateLoan(firestore, loanToEditLedger.id, updateData);
          toast({ title: 'Ledger Entry Updated' });
          setLoanToEditLedger(null);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
      } finally {
          setIsSubmitting(false);
      }
  }

  const handleDeleteEntry = (entry: FinanceEntry) => {
      if ((entry as any).isSystemGenerated) {
          toast({ variant: 'destructive', title: 'System Entry', description: 'Loan repayments must be deleted from the Loans page.' });
          return;
      }
      setEntryToDelete(entry);
  };

  const confirmDeleteEntry = async () => {
      if (!entryToDelete) return;
      try {
          await deleteFinanceEntry(firestore, entryToDelete.id);
          toast({ title: 'Entry Deleted' });
          setEntryToDelete(null);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
      }
  };

  async function onAddSubmit(values: z.infer<typeof addFinanceEntrySchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const data = { 
          ...values, 
          date: new Date(values.date),
          recordedBy: user.name || user.email || 'Admin'
      };
      if (editingEntry) await updateFinanceEntry(firestore, editingEntry.id, data);
      else await addFinanceEntry(firestore, data as any);
      setOpen(false); setEditingEntry(null); addForm.reset({ type: 'receipt', date: format(new Date(), 'yyyy-MM-dd'), amount: 0, description: '', transactionFee: 0 });
      toast({ title: editingEntry ? 'Entry Updated' : 'Entry Recorded' });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); } finally { setIsSubmitting(false); }
  }

  if (userLoading || loansLoading || financeEntriesLoading) return <div className="flex h-full w-full items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAuthorized) return <div className="p-12">Access Restricted</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <Dialog open={open} onOpenChange={(isOpen) => {
              setOpen(isOpen);
              if (!isOpen) { setEditingEntry(null); addForm.reset({ type: 'receipt', date: format(new Date(), 'yyyy-MM-dd'), amount: 0, description: '', transactionFee: 0 }); }
          }}>
              <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Entry</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                      <DialogTitle>{editingEntry ? 'Edit Finance Entry' : 'New Finance Entry'}</DialogTitle>
                      <DialogDescription>Record cash movements not tied directly to loan repayments.</DialogDescription>
                  </DialogHeader>
                  <Form {...addForm}>
                      <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 pt-4">
                          <div className="grid grid-cols-2 gap-4">
                              <FormField control={addForm.control} name="type" render={({field}) => (
                                  <FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="receipt">Receipt (In)</SelectItem><SelectItem value="payout">Payout (Out)</SelectItem><SelectItem value="expense">Expense (Out)</SelectItem></SelectContent></Select></FormItem>
                              )}/>
                              <FormField control={addForm.control} name="date" render={({field}) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''}/></FormControl></FormItem>)}/>
                          </div>

                          {typeWatch === 'expense' && (
                              <FormField control={addForm.control} name="expenseCategory" render={({field}) => (
                                  <FormItem><FormLabel>Expense Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select purpose"/></SelectTrigger></FormControl><SelectContent><SelectItem value="facilitation_commission">Facilitation Commission</SelectItem><SelectItem value="office_purchase">Office Purchase</SelectItem><SelectItem value="other">Other Expense</SelectItem></SelectContent></Select></FormItem>
                              )}/>
                          )}

                          {typeWatch === 'receipt' && (
                              <FormField control={addForm.control} name="receiptCategory" render={({field}) => (
                                  <FormItem><FormLabel>Receipt Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select source"/></SelectTrigger></FormControl><SelectContent><SelectItem value="loan_repayment">Loan Repayment</SelectItem><SelectItem value="upfront_fees">Upfront Fees</SelectItem><SelectItem value="investment">Investor Deposit</SelectItem><SelectItem value="other">Other Receipt</SelectItem></SelectContent></Select></FormItem>
                              )}/>
                          )}

                          {typeWatch === 'payout' && (
                              <FormField control={addForm.control} name="payoutCategory" render={({field}) => (
                                  <FormItem><FormLabel>Payout Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select destination"/></SelectTrigger></FormControl><SelectContent><SelectItem value="loan_disbursement">Loan Disbursement</SelectItem><SelectItem value="investor_withdrawal">Investor Withdrawal</SelectItem><SelectItem value="other">Other Payout</SelectItem></SelectContent></Select></FormItem>
                              )}/>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                              <FormField control={addForm.control} name="amount" render={({field}) => (<FormItem><FormLabel>Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)}/>
                              <FormField control={addForm.control} name="transactionFee" render={({field}) => (<FormItem><FormLabel>Trans. Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)}/>
                          </div>

                          <FormField control={addForm.control} name="description" render={({field}) => (
                              <FormItem><FormLabel>Purpose / Description</FormLabel><FormControl><Textarea placeholder="What is this for?" className="h-20" {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>
                          )}/>

                          <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              {editingEntry ? 'Update Entry' : 'Record Transaction'}
                          </Button>
                      </form>
                  </Form>
              </DialogContent>
          </Dialog>
      </div>
      
      <Tabs defaultValue="loanbook" className="w-full">
          <TabsList className="mb-4">
              <TabsTrigger value="loanbook">Loan Book</TabsTrigger>
              <TabsTrigger value="reports" className="gap-2">
                <FileBarChart className="h-4 w-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
              <TabsTrigger value="payouts">Payouts & Expenses</TabsTrigger>
              <TabsTrigger value="investors">Investors</TabsTrigger>
              <TabsTrigger value="staff">Staff Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="loanbook">
              <Card>
                  <CardHeader>
                      <div className="flex flex-col gap-4">
                          <div>
                              <CardTitle>Internal Ledger (Loan Book)</CardTitle>
                              <CardDescription>Comprehensive tracking of all credit facilities, fees, and income.</CardDescription>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                              <div className="relative">
                                  <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                  <Input 
                                      placeholder="Search name, loan #..." 
                                      value={lbSearch} 
                                      onChange={(e) => setLbSearch(e.target.value)} 
                                      className="pl-8 w-full sm:w-[200px]" 
                                  />
                              </div>
                              <Select value={lbStatus} onValueChange={setLbStatus}>
                                  <SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="all">All Status</SelectItem>
                                      <SelectItem value="active">Active</SelectItem>
                                      <SelectItem value="due">Due</SelectItem>
                                      <SelectItem value="overdue">Overdue</SelectItem>
                                      <SelectItem value="paid">Paid</SelectItem>
                                      <SelectItem value="rollover">Rollover</SelectItem>
                                  </SelectContent>
                              </Select>
                              <Select value={lbStaff} onValueChange={setLbStaff}>
                                  <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Staff" /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="all">All Staff</SelectItem>
                                      {staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                              <DatePickerWithRange date={lbDate} setDate={setLbDate} className="w-full sm:w-[260px]" />
                              {(lbSearch || lbStatus !== 'all' || lbStaff !== 'all' || lbDate) && (
                                  <Button variant="ghost" size="icon" onClick={() => { setLbSearch(''); setLbStatus('all'); setLbStaff('all'); setLbDate(undefined); }}>
                                      <X className="h-4 w-4" />
                                  </Button>
                              )}
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="p-0">
                      <ScrollArea className="h-[65vh] w-full">
                          <Table className="min-w-[2300px]">
                              <TableHeader>
                                  <TableRow>
                                      <TableHead className="w-[150px]">Client Name</TableHead>
                                      <TableHead className="w-[120px]">Phone Number</TableHead>
                                      <TableHead className="w-[100px]">Loan No.</TableHead>
                                      <TableHead className="w-[100px]">Date</TableHead>
                                      <TableHead className="text-right">Principal</TableHead>
                                      <TableHead className="text-right">Reg. Fee</TableHead>
                                      <TableHead className="text-right">Proc. Fee</TableHead>
                                      <TableHead className="text-right font-bold text-primary">Disbursed Amt</TableHead>
                                      <TableHead className="text-right">Car Track</TableHead>
                                      <TableHead className="text-right">Charging Cost</TableHead>
                                      <TableHead className="text-center">Instalments</TableHead>
                                      <TableHead className="text-right">Inst. Amount</TableHead>
                                      <TableHead className="text-right font-bold">Total Repayable (Amt to Pay)</TableHead>
                                      <TableHead className="text-right text-green-600">Paid Amount</TableHead>
                                      <TableHead className="text-right font-bold">Balance</TableHead>
                                      <TableHead className="text-right text-destructive">Penalties</TableHead>
                                      <TableHead className="text-right">Exp. Interest</TableHead>
                                      <TableHead className="text-right font-bold">Exp. Income</TableHead>
                                      <TableHead className="text-center">Actions</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {filteredLoanBook.map(loan => {
                                      const totalFees = (Number(loan.registrationFee) || 0) + (Number(loan.processingFee) || 0) + (Number(loan.carTrackInstallationFee) || 0) + (Number(loan.chargingCost) || 0);
                                      const takeHome = (loan.principalAmount || 0) - totalFees;
                                      const balance = (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0);
                                      const expectedInterest = (loan.totalRepayableAmount || 0) - (loan.totalPenalties || 0) - (loan.principalAmount || 0);
                                      const expectedIncome = expectedInterest + (Number(loan.registrationFee) || 0) + (Number(loan.processingFee) || 0);
                                      
                                      const dDate = loan.disbursementDate?.seconds 
                                        ? new Date(loan.disbursementDate.seconds * 1000) 
                                        : (loan.disbursementDate ? new Date(loan.disbursementDate as any) : new Date());

                                      return (
                                          <TableRow key={loan.id} className="group">
                                              <TableCell className="font-medium">{loan.customerName}</TableCell>
                                              <TableCell>{loan.customerPhone}</TableCell>
                                              <TableCell>{loan.loanNumber}</TableCell>
                                              <TableCell>{isNaN(dDate.getTime()) ? 'N/A' : format(dDate, 'dd/MM/yy')}</TableCell>
                                              <TableCell className="text-right">{(loan.principalAmount || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.registrationFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.processingFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-bold text-primary">{takeHome.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.carTrackInstallationFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.chargingCost || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-center">{(loan.numberOfInstalments || 0)} ({loan.paymentFrequency})</TableCell>
                                              <TableCell className="text-right">{(loan.instalmentAmount || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-bold">{(loan.totalRepayableAmount || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-green-600 font-semibold">{(loan.totalPaid || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-bold">{balance.toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-destructive">{(loan.totalPenalties || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{expectedInterest.toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-bold">{expectedIncome.toLocaleString()}</TableCell>
                                              <TableCell className="text-center">
                                                  <div className="flex items-center gap-1 justify-center">
                                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditLedger(loan)}>
                                                          <Pencil className="h-3.5 w-3.5" />
                                                      </Button>
                                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLoanHistoryToShow(loan)}>
                                                          <History className="h-3.5 w-3.5" />
                                                      </Button>
                                                  </div>
                                              </TableCell>
                                          </TableRow>
                                      );
                                  })}
                              </TableBody>
                          </Table>
                          <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="reports">
              <PortfolioReportsTab loans={loans} />
          </TabsContent>
          <TabsContent value="receipts">
              <EditableFinanceReportTab 
                title="Receipts" 
                description="Income transactions including loan repayments and manual receipts." 
                entries={financialData.allReceipts} 
                loading={financeEntriesLoading}
                onEdit={handleEditEntry}
                onDelete={handleDeleteEntry}
              />
          </TabsContent>
          <TabsContent value="payouts">
              <EditableFinanceReportTab 
                title="Payouts & Expenses" 
                description="Outgoing transactions including loan disbursements and operating expenses." 
                entries={financialData.allPayouts} 
                loading={financeEntriesLoading}
                onEdit={handleEditEntry}
                onDelete={handleDeleteEntry}
              />
          </TabsContent>
          <TabsContent value="investors"><InvestorsPortfolioTab/></TabsContent>
          <TabsContent value="staff"><StaffPortfoliosTab loans={loans} staffList={staffList}/></TabsContent>
      </Tabs>

      {/* Edit Loan Ledger Dialog */}
      <Dialog open={!!loanToEditLedger} onOpenChange={(open) => !open && setLoanToEditLedger(null)}>
          <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                  <DialogTitle>Edit Internal Ledger Record</DialogTitle>
                  <DialogDescription>Modify primary financial terms. You can manually adjust the "Amount to Pay".</DialogDescription>
              </DialogHeader>
              <Form {...ledgerForm}>
                  <ScrollArea className="max-h-[70vh] pr-4">
                    <form id="edit-ledger-form" onSubmit={ledgerForm.handleSubmit(onLedgerSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 col-span-1 md:col-span-2">
                            <FormField control={ledgerForm.control} name="disbursementDate" render={({field}) => (<FormItem className="col-span-1 md:col-span-2"><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field}/></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="assignedStaffId" render={({ field }) => (
                                <FormItem className="col-span-1 md:col-span-2">
                                    <FormLabel>Assigned Staff (Reassignment)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger></FormControl>
                                    <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={ledgerForm.control} name="principalAmount" render={({field}) => (<FormItem><FormLabel>Principal (Ksh)</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="interestRate" render={({field}) => (<FormItem><FormLabel>Interest Rate %</FormLabel><FormControl><Input type="number" step="0.01" {...field}/></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="registrationFee" render={({field}) => (<FormItem><FormLabel>Reg. Fee</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="processingFee" render={({field}) => (<FormItem><FormLabel>Proc. Fee</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="carTrackInstallationFee" render={({field}) => (<FormItem><FormLabel>Car Track Fee</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="chargingCost" render={({field}) => (<FormItem><FormLabel>Charging Cost</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="numberOfInstalments" render={({field}) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="paymentFrequency" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Frequency</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select frequency"/></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                                    </Select>
                                </FormItem>
                            )}/>
                            <FormField control={ledgerForm.control} name="totalRepayableAmount" render={({field}) => (
                                <FormItem className="col-span-1 md:col-span-2">
                                    <FormLabel className="font-bold text-primary">Total Repayable (Amount to Pay)</FormLabel>
                                    <FormControl><Input type="number" {...field} className="border-primary/50 bg-primary/5 font-bold" /></FormControl>
                                    <FormDescription className="text-[10px]">Override the calculated total here if necessary. Installments will adjust automatically.</FormDescription>
                                </FormItem>
                            )} />
                        </div>
                    </form>
                  </ScrollArea>
                  <DialogFooter className="mt-6">
                    <Button type="submit" form="edit-ledger-form" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin"/>}
                        Update Ledger Record
                    </Button>
                  </DialogFooter>
              </Form>
          </DialogContent>
      </Dialog>

      <Dialog open={!!loanHistoryToShow} onOpenChange={(open) => !open && setLoanHistoryToShow(null)}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Repayment History: {loanHistoryToShow?.loanNumber}</DialogTitle>
                  <DialogDescription>Full list of payments received for this facility.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-80 border rounded-md p-4">
                  {(!loanHistoryToShow?.payments || loanHistoryToShow.payments.length === 0) ? (
                      <p className="text-center py-12 text-muted-foreground text-sm">No payments recorded yet.</p>
                  ) : (
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {loanHistoryToShow.payments.map((p, i) => {
                                  const payDate = (p.date as any)?.seconds 
                                    ? new Date((p.date as any).seconds * 1000) 
                                    : (p.date instanceof Date ? p.date : new Date());
                                  
                                  return (
                                    <TableRow key={p.paymentId || i}>
                                        <TableCell>{isNaN(payDate.getTime()) ? 'N/A' : format(payDate, 'PPP')}</TableCell>
                                        <TableCell className="text-right font-bold text-green-600">Ksh {(p.amount || 0).toLocaleString()}</TableCell>
                                    </TableRow>
                                  )
                              })}
                          </TableBody>
                      </Table>
                  )}
              </ScrollArea>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <AlertDialog open={!!entryToDelete} onOpenChange={(open) => !open && setEntryToDelete(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Delete Finance Entry?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently remove this financial record. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDeleteEntry} className="bg-destructive hover:bg-destructive/90">Delete Permanently</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
