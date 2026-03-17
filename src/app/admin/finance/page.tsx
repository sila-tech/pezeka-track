
'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format, addDays, addWeeks, addMonths, differenceInDays } from "date-fns";
import { PlusCircle, Loader2, AlertCircle, History, Info, Pencil, Trash2, FileBarChart, Search, X, HandCoins } from "lucide-react";
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
import { addFinanceEntry, updateLoan, rolloverLoan, addPenaltyToLoan, updateFinanceEntry, deleteFinanceEntry, deleteLoan, addLoan, addCustomer } from '@/lib/firestore';
import { EditableFinanceReportTab, DatePickerWithRange } from './components/editable-finance-report-tab';
import { InvestorsPortfolioTab } from './components/investors-portfolio-tab';
import { StaffPortfoliosTab } from './components/staff-portfolios-tab';
import { PortfolioReportsTab } from './components/portfolio-reports-tab';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateInterestForOneInstalment, calculateAmortization } from '@/lib/utils';
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
  interestRate: z.coerce.number().min(0, 'Interest rate must be a positive number.'),
  registrationFee: z.coerce.number().optional(),
  processingFee: z.coerce.number().optional(),
  carTrackInstallationFee: z.coerce.number().optional(),
  chargingCost: z.coerce.number().optional(),
  numberOfInstalments: z.coerce.number().int().min(1, 'Number of instalments is required.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  status: z.enum(['due', 'paid', 'active', 'rollover', 'overdue', 'application']),
  loanType: z.string().optional(),
  assignedStaffId: z.string().min(1, 'Please assign a staff member.'),
  customerType: z.enum(['existing', 'new']),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
  idNumber: z.string().min(1, "ID number is required."),
}).superRefine((data, ctx) => {
  if (data.customerType === 'existing' && !data.customerId) {
    ctx.addIssue({ code: 'custom', message: 'Please select a customer.', path: ['customerId'] });
  }
  if (data.customerType === 'new') {
    if (!data.newCustomerName) ctx.addIssue({ code: 'custom', message: 'New customer name is required.', path: ['newCustomerName'] });
    if (!data.newCustomerPhone) ctx.addIssue({ code: 'custom', message: 'New customer phone is required.', path: ['newCustomerPhone'] });
  }
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
  followUpNotes?: { noteId: string; date: any; staffName: string; content: string; }[];
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
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanHistoryToShow, setLoanHistoryToShow] = useState<Loan | null>(null);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<FinanceEntry | null>(null);
  const [loanToDeleteFromLedger, setLoanToDeleteFromLedger] = useState<Loan | null>(null);
  
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

  const userRole = user?.role?.toLowerCase()?.trim();
  const isSuperAdmin = user?.email?.toLowerCase()?.trim() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
  const isFinance = userRole === 'finance';
  
  const isAuthorized = isSuperAdmin || isFinance;
  const canEdit = isAuthorized;

  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<FinanceEntry>(isAuthorized ? 'financeEntries' : null);
  const { data: staffList } = useCollection<any>(isAuthorized ? 'users' : null);
  const { data: customers } = useCollection<any>(isAuthorized ? 'customers' : null);

  const loanForm = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      customerId: '', principalAmount: 0, interestRate: 0, registrationFee: 0, processingFee: 0, carTrackInstallationFee: 0, chargingCost: 0, numberOfInstalments: 1, paymentFrequency: 'monthly', status: 'active', customerType: 'existing', loanType: 'Quick Pesa', newCustomerName: '', newCustomerPhone: '', idNumber: '', assignedStaffId: '', disbursementDate: format(new Date(), 'yyyy-MM-dd')
    },
  });

  const ledgerForm = useForm<z.infer<typeof editLedgerSchema>>({
      resolver: zodResolver(editLedgerSchema),
  });

  const { watch: loanWatch } = loanForm;
  const principalWatch = loanWatch('principalAmount');
  const interestWatch = loanWatch('interestRate');
  const instalmentsWatch = loanWatch('numberOfInstalments');
  const freqWatch = loanWatch('paymentFrequency');
  const custTypeWatch = loanWatch('customerType');

  const calculatedValues = useMemo(() => {
    const { instalmentAmount, totalRepayableAmount } = calculateAmortization(principalWatch || 0, interestWatch || 0, instalmentsWatch || 0, freqWatch);
    return {
        instalmentAmount: instalmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        totalRepayableAmount: totalRepayableAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
    };
  }, [principalWatch, interestWatch, instalmentsWatch, freqWatch]);

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
      if (!canEdit) return;
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
      if (!canEdit) return;
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
      if (!loanToEditLedger || !canEdit) return;
      setIsSubmitting(true);
      try {
          const assignedStaff = staffList?.find(s => (s.uid || s.id) === values.assignedStaffId);
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

  async function onLoanSubmit(values: z.infer<typeof loanSchema>) {
    if (!canEdit) return;
    setIsSubmitting(true);
    try {
      let customerId = values.customerId;
      let customerName = '';
      let customerPhone = '';

      if (values.customerType === 'new') {
        const newCustomerData = { name: values.newCustomerName!, phone: values.newCustomerPhone!, idNumber: values.idNumber };
        const newCustomerDocRef = await addCustomer(firestore, newCustomerData);
        customerId = newCustomerDocRef.id;
        customerName = newCustomerData.name;
        customerPhone = newCustomerData.phone;
      } else {
        const selectedCustomer = customers?.find(c => c.id === customerId);
        if (!selectedCustomer) throw new Error("Selected customer not found.");
        customerName = selectedCustomer.name;
        customerPhone = selectedCustomer.phone;
      }
      
      const assignedStaff = staffList?.find(s => (s.uid || s.id) === values.assignedStaffId);
      const { instalmentAmount, totalRepayableAmount } = calculateAmortization(values.principalAmount, values.interestRate, values.numberOfInstalments, values.paymentFrequency);

      const loanData = {
        ...values, customerId: customerId!, customerName, customerPhone, idNumber: values.idNumber, assignedStaffId: values.assignedStaffId, assignedStaffName: assignedStaff?.name || assignedStaff?.email || "Unknown", disbursementDate: new Date(values.disbursementDate), totalRepayableAmount, instalmentAmount, totalPaid: 0,
      };
      
      delete (loanData as any).customerType;
      delete (loanData as any).newCustomerName;
      delete (loanData as any).newCustomerPhone;
      
      await addLoan(firestore, loanData);
      toast({ title: 'Loan Record Added Successfully' });
      loanForm.reset();
      setLoanDialogOpen(false);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); } finally { setIsSubmitting(false); }
  }

  const handleDeleteEntry = (entry: FinanceEntry) => {
      if (!canEdit) return;
      if ((entry as any).isSystemGenerated) {
          toast({ variant: 'destructive', title: 'System Entry', description: 'Loan repayments must be deleted from the Loans page.' });
          return;
      }
      setEntryToDelete(entry);
  };

  const confirmDeleteEntry = async () => {
      if (!entryToDelete || !canEdit) return;
      try {
          await deleteFinanceEntry(firestore, entryToDelete.id);
          toast({ title: 'Entry Deleted' });
          setEntryToDelete(null);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
      }
  };

  const confirmDeleteLoanFromLedger = async () => {
      if (!loanToDeleteFromLedger || !canEdit) return;
      setIsSubmitting(true);
      try {
          await deleteLoan(firestore, loanToDeleteFromLedger.id);
          toast({ title: 'Loan Record Deleted Permanently' });
          setLoanToDeleteFromLedger(null);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
      } finally {
          setIsSubmitting(false);
      }
  };

  async function onAddSubmit(values: z.infer<typeof addFinanceEntrySchema>) {
    if (!user || !canEdit) return;
    setIsSubmitting(true);
    try {
      const entryData: any = {
        type: values.type,
        date: new Date(values.date),
        amount: Number(values.amount),
        transactionFee: Number(values.transactionFee || 0),
        description: values.description,
        recordedBy: user.name || user.email || 'Admin'
      };

      if (values.type === 'expense' && values.expenseCategory) entryData.expenseCategory = values.expenseCategory;
      if (values.type === 'receipt' && values.receiptCategory) entryData.receiptCategory = values.receiptCategory;
      if (values.type === 'payout' && values.payoutCategory) entryData.payoutCategory = values.payoutCategory;
      if (values.loanId) entryData.loanId = values.loanId;

      if (editingEntry) {
        await updateFinanceEntry(firestore, editingEntry.id, entryData);
      } else {
        await addFinanceEntry(firestore, entryData);
      }

      setOpen(false); 
      setEditingEntry(null); 
      addForm.reset({ 
        type: 'receipt', 
        date: format(new Date(), 'yyyy-MM-dd'), 
        amount: 0, 
        description: '', 
        transactionFee: 0 
      });
      toast({ title: editingEntry ? 'Entry Updated' : 'Entry Recorded' });
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }); 
    } finally { 
      setIsSubmitting(false); 
    }
  }

  if (userLoading || loansLoading || financeEntriesLoading) return <div className="flex h-full w-full items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  
  if (!isAuthorized) {
      return (
          <div className="flex h-[60vh] flex-col items-center justify-center text-center p-8 bg-card rounded-xl border border-dashed">
              <FileBarChart className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold">Access Restricted</h2>
              <p className="text-muted-foreground mt-2">Only Finance and Super Admin roles can access the internal ledger and financial reports.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-[#1B2B33]">Finance</h1>
          {canEdit && (
            <div className="flex items-center gap-2">
                <Dialog open={loanDialogOpen} onOpenChange={setLoanDialogOpen}>
                    <DialogTrigger asChild><Button className="bg-[#1B2B33] hover:bg-[#1B2B33]/90"><PlusCircle className="mr-2 h-4 w-4" /> Add Loan Record</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Manually Add Loan Record</DialogTitle>
                            <DialogDescription>Input specific terms to record a credit facility manually in the ledger.</DialogDescription>
                        </DialogHeader>
                        <Form {...loanForm}>
                            <ScrollArea className="max-h-[70vh] pr-4">
                                <form id="manual-loan-form" onSubmit={loanForm.handleSubmit(onLoanSubmit)} className="space-y-4 py-2">
                                    <FormField control={loanForm.control} name="customerType" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Entry Context</FormLabel>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="existing" /></FormControl><FormLabel className="font-normal">Existing Customer</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="new" /></FormControl><FormLabel className="font-normal">New Customer</FormLabel></FormItem>
                                            </RadioGroup>
                                        </FormItem>
                                    )} />
                                    
                                    {custTypeWatch === 'existing' ? (
                                        <FormField control={loanForm.control} name="customerId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Customer</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select existing customer" /></SelectTrigger></FormControl>
                                                    <SelectContent>{customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={loanForm.control} name="newCustomerName" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl></FormItem>)} />
                                            <FormField control={loanForm.control} name="newCustomerPhone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="0712345678" {...field} /></FormControl></FormItem>)} />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={loanForm.control} name="idNumber" render={({ field }) => (<FormItem><FormLabel>National ID</FormLabel><FormControl><Input placeholder="12345678" {...field} /></FormControl></FormItem>)} />
                                        <FormField control={loanForm.control} name="disbursementDate" render={({ field }) => (<FormItem><FormLabel>Record Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                                    </div>

                                    <FormField control={loanForm.control} name="assignedStaffId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Assign Follow-up</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger></FormControl>
                                                <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={loanForm.control} name="principalAmount" render={({ field }) => (<FormItem><FormLabel>Principal (Ksh)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                        <FormField control={loanForm.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Monthly Interest %</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={loanForm.control} name="numberOfInstalments" render={({ field }) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                        <FormField control={loanForm.control} name="paymentFrequency" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Frequency</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                    </div>

                                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-2">
                                        <div className="flex justify-between items-center"><span className="text-xs font-bold text-muted-foreground uppercase">Estimated Instalment</span><span className="text-lg font-black text-[#1B2B33]">Ksh {calculatedValues.instalmentAmount}</span></div>
                                        <div className="flex justify-between items-center border-t pt-2 mt-2"><span className="text-xs font-bold text-muted-foreground uppercase">Total Repayable</span><span className="text-lg font-black text-primary">Ksh {calculatedValues.totalRepayableAmount}</span></div>
                                    </div>
                                </form>
                            </ScrollArea>
                            <DialogFooter className="mt-6">
                                <Button type="submit" form="manual-loan-form" disabled={isSubmitting} className="w-full h-12 bg-[#1B2B33] font-bold">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                    Create Ledger Record
                                </Button>
                            </DialogFooter>
                        </Form>
                    </DialogContent>
                </Dialog>

                <Dialog open={open} onOpenChange={(isOpen) => {
                    setOpen(isOpen);
                    if (!isOpen) { setEditingEntry(null); addForm.reset({ type: 'receipt', date: format(new Date(), 'yyyy-MM-dd'), amount: 0, description: '', transactionFee: 0 }); }
                }}>
                    <DialogTrigger asChild><Button variant="outline" className="border-[#5BA9D0] text-[#5BA9D0] hover:bg-[#5BA9D0]/10"><PlusCircle className="mr-2 h-4 w-4" /> Add Expense/Receipt</Button></DialogTrigger>
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

                                <Button type="submit" className="w-full h-11 bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 font-bold" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    {editingEntry ? 'Update Entry' : 'Record Transaction'}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>
          )}
      </div>
      
      <Tabs defaultValue="loanbook" className="w-full">
          <TabsList className="mb-4 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="loanbook" className="data-[state=active]:bg-[#5BA9D0] data-[state=active]:text-white">Internal Ledger</TabsTrigger>
              <TabsTrigger value="reports" className="gap-2 data-[state=active]:bg-[#5BA9D0] data-[state=active]:text-white">
                <FileBarChart className="h-4 w-4" />
                Portfolio Reports
              </TabsTrigger>
              <TabsTrigger value="receipts" className="data-[state=active]:bg-[#5BA9D0] data-[state=active]:text-white">Receipts</TabsTrigger>
              <TabsTrigger value="payouts" className="data-[state=active]:bg-[#5BA9D0] data-[state=active]:text-white">Payouts & Expenses</TabsTrigger>
              <TabsTrigger value="investors" className="data-[state=active]:bg-[#5BA9D0] data-[state=active]:text-white">Investors</TabsTrigger>
              <TabsTrigger value="staff" className="data-[state=active]:bg-[#5BA9D0] data-[state=active]:text-white">Staff Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="loanbook">
              <Card className="rounded-2xl border-none shadow-xl shadow-navy-900/5">
                  <CardHeader>
                      <div className="flex flex-col gap-4">
                          <div>
                              <CardTitle className="text-2xl font-black text-[#1B2B33]">Internal Loan Book</CardTitle>
                              <CardDescription>Comprehensive tracking of all credit facilities, fees, and income.</CardDescription>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                              <div className="relative">
                                  <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                  <Input 
                                      placeholder="Search client or loan #..." 
                                      value={lbSearch} 
                                      onChange={(e) => setLbSearch(e.target.value)} 
                                      className="pl-8 w-full sm:w-[220px] rounded-xl border-muted bg-muted/20" 
                                  />
                              </div>
                              <Select value={lbStatus} onValueChange={setLbStatus}>
                                  <SelectTrigger className="w-full sm:w-[140px] rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
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
                                  <SelectTrigger className="w-full sm:w-[160px] rounded-xl"><SelectValue placeholder="Filter Staff" /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="all">All Team</SelectItem>
                                      {staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                              <DatePickerWithRange date={lbDate} setDate={setLbDate} className="w-full sm:w-[260px]" />
                              {(lbSearch || lbStatus !== 'all' || lbStaff !== 'all' || lbDate) && (
                                  <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setLbSearch(''); setLbStatus('all'); setLbStaff('all'); setLbDate(undefined); }}>
                                      <X className="h-4 w-4" />
                                  </Button>
                              )}
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="p-0">
                      <ScrollArea className="h-[65vh] w-full">
                          <Table className="min-w-[2300px]">
                              <TableHeader className="bg-[#1B2B33] text-white">
                                  <TableRow className="hover:bg-[#1B2B33]">
                                      <TableHead className="w-[150px] text-white/80 font-bold">Client Name</TableHead>
                                      <TableHead className="w-[120px] text-white/80 font-bold">Phone Number</TableHead>
                                      <TableHead className="w-[100px] text-white/80 font-bold">Loan No.</TableHead>
                                      <TableHead className="w-[100px] text-white/80 font-bold">Date</TableHead>
                                      <TableHead className="text-right text-white/80 font-bold">Principal</TableHead>
                                      <TableHead className="text-right text-white/80 font-bold">Reg. Fee</TableHead>
                                      <TableHead className="text-right text-white/80 font-bold">Proc. Fee</TableHead>
                                      <TableHead className="text-right font-black text-[#5BA9D0]">Disbursed Amt</TableHead>
                                      <TableHead className="text-right text-white/80 font-bold">Car Track</TableHead>
                                      <TableHead className="text-right text-white/80 font-bold">Charging Cost</TableHead>
                                      <TableHead className="text-center text-white/80 font-bold">Instalments</TableHead>
                                      <TableHead className="text-right text-white/80 font-bold">Inst. Amount</TableHead>
                                      <TableHead className="text-right font-black text-white">Total Repayable</TableHead>
                                      <TableHead className="text-right text-green-400 font-bold">Paid Amount</TableHead>
                                      <TableHead className="text-right font-black text-white">Balance</TableHead>
                                      <TableHead className="text-right text-destructive font-bold">Penalties</TableHead>
                                      <TableHead className="text-right text-white/80 font-bold">Exp. Interest</TableHead>
                                      <TableHead className="text-right font-black text-[#5BA9D0]">Exp. Income</TableHead>
                                      <TableHead className="text-center text-white/80 font-bold">Actions</TableHead>
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
                                          <TableRow key={loan.id} className="group hover:bg-muted/30">
                                              <TableCell className="font-bold text-[#1B2B33]">{loan.customerName}</TableCell>
                                              <TableCell className="text-muted-foreground font-medium">{loan.customerPhone}</TableCell>
                                              <TableCell className="font-mono text-xs font-bold text-primary">{loan.loanNumber}</TableCell>
                                              <TableCell className="text-xs">{isNaN(dDate.getTime()) ? 'N/A' : format(dDate, 'dd/MM/yy')}</TableCell>
                                              <TableCell className="text-right font-medium">{(loan.principalAmount || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-muted-foreground">{(loan.registrationFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-muted-foreground">{(loan.processingFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-black text-[#5BA9D0]">{takeHome.toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-muted-foreground">{(loan.carTrackInstallationFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-muted-foreground">{(loan.chargingCost || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-center text-xs font-bold uppercase">{(loan.numberOfInstalments || 0)} {loan.paymentFrequency.slice(0,1)}</TableCell>
                                              <TableCell className="text-right font-medium">{(loan.instalmentAmount || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-black">{(loan.totalRepayableAmount || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-green-600 font-black">{(loan.totalPaid || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-black text-destructive">{balance.toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-destructive font-medium">{(loan.totalPenalties || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-muted-foreground">{(expectedInterest || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-black text-[#1B2B33]">{(expectedIncome || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-center">
                                                  <div className="flex items-center gap-1 justify-center">
                                                      {canEdit && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5BA9D0]" onClick={() => handleEditLedger(loan)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                      )}
                                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setLoanHistoryToShow(loan)}>
                                                          <History className="h-3.5 w-3.5" />
                                                      </Button>
                                                      {canEdit && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setLoanToDeleteFromLedger(loan)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                      )}
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
                onEdit={canEdit ? handleEditEntry : undefined}
                onDelete={canEdit ? handleDeleteEntry : undefined}
              />
          </TabsContent>
          <TabsContent value="payouts">
              <EditableFinanceReportTab 
                title="Payouts & Expenses" 
                description="Outgoing transactions including loan disbursements and operating expenses." 
                entries={financialData.allPayouts} 
                loading={financeEntriesLoading}
                onEdit={canEdit ? handleEditEntry : undefined}
                onDelete={canEdit ? handleDeleteEntry : undefined}
              />
          </TabsContent>
          <TabsContent value="investors"><InvestorsPortfolioTab/></TabsContent>
          <TabsContent value="staff"><StaffPortfoliosTab loans={loans} staffList={staffList}/></TabsContent>
      </Tabs>

      {/* Edit Loan Ledger Dialog */}
      <Dialog open={!!loanToEditLedger} onOpenChange={(open) => !open && setLoanToEditLedger(null)}>
          <DialogContent className="sm:max-w-3xl rounded-[2rem]">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-[#1B2B33]">Modify Ledger Terms</DialogTitle>
                  <DialogDescription>Modify primary financial terms. Override "Amount to Pay" for historical corrections.</DialogDescription>
              </DialogHeader>
              <Form {...ledgerForm}>
                  <ScrollArea className="max-h-[70vh] pr-4">
                    <form id="edit-ledger-form" onSubmit={ledgerForm.handleSubmit(onLedgerSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 col-span-1 md:col-span-2">
                            <FormField control={ledgerForm.control} name="disbursementDate" render={({field}) => (<FormItem className="col-span-1 md:col-span-2"><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="assignedStaffId" render={({ field }) => (
                                <FormItem className="col-span-1 md:col-span-2">
                                    <FormLabel>Assigned Staff (Reassignment)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select staff member" /></SelectTrigger></FormControl>
                                    <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={ledgerForm.control} name="principalAmount" render={({field}) => (<FormItem><FormLabel>Principal (Ksh)</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="interestRate" render={({field}) => (<FormItem><FormLabel>Interest Rate %</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-12 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="registrationFee" render={({field}) => (<FormItem><FormLabel>Reg. Fee</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="processingFee" render={({field}) => (<FormItem><FormLabel>Proc. Fee</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="carTrackInstallationFee" render={({field}) => (<FormItem><FormLabel>Car Track Fee</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="chargingCost" render={({field}) => (<FormItem><FormLabel>Charging Cost</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="numberOfInstalments" render={({field}) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={ledgerForm.control} name="paymentFrequency" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Frequency</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select frequency"/></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                                    </Select>
                                </FormItem>
                            )}/>
                            <FormField control={ledgerForm.control} name="totalRepayableAmount" render={({field}) => (
                                <FormItem className="col-span-1 md:col-span-2">
                                    <FormLabel className="font-bold text-[#5BA9D0]">Total Repayable (Amount to Pay)</FormLabel>
                                    <FormControl><Input type="number" {...field} className="h-14 rounded-xl border-[#5BA9D0]/50 bg-[#5BA9D0]/5 font-black text-lg" /></FormControl>
                                    <FormDescription className="text-[10px]">Manual override. Adjusting this will recalculate individual installments.</FormDescription>
                                </FormItem>
                            )} />
                        </div>
                    </form>
                  </ScrollArea>
                  <DialogFooter className="mt-6">
                    <Button type="submit" form="edit-ledger-form" className="w-full h-14 text-lg font-black bg-[#1B2B33] rounded-2xl" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin"/>}
                        Update Ledger Record
                    </Button>
                  </DialogFooter>
              </Form>
          </DialogContent>
      </Dialog>

      <Dialog open={!!loanHistoryToShow} onOpenChange={(open) => !open && setLoanHistoryToShow(null)}>
          <DialogContent className="sm:max-w-md rounded-[2rem]">
              <DialogHeader>
                  <DialogTitle className="text-xl font-black text-[#1B2B33]">Repayment History: {loanHistoryToShow?.loanNumber}</DialogTitle>
                  <DialogDescription>Full audit trail of payments received for this facility.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-80 border rounded-2xl p-4 bg-muted/10">
                  {(!loanHistoryToShow?.payments || loanHistoryToShow.payments.length === 0) ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground italic text-sm">
                          <History className="h-10 w-10 mb-2 opacity-20" />
                          No payments recorded yet.
                      </div>
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
                                        <TableCell className="text-xs">{isNaN(payDate.getTime()) ? 'N/A' : format(payDate, 'PPP')}</TableCell>
                                        <TableCell className="text-right font-black text-green-600">Ksh {(p.amount || 0).toLocaleString()}</TableCell>
                                    </TableRow>
                                  )
                              })}
                          </TableBody>
                      </Table>
                  )}
              </ScrollArea>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline" className="w-full rounded-xl">Close History</Button></DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Delete Finance Entry Confirmation */}
      <AlertDialog open={!!entryToDelete} onOpenChange={(open) => !open && setEntryToDelete(null)}>
          <AlertDialogContent className="rounded-[2rem]">
              <AlertDialogHeader>
                  <AlertDialogTitle>Delete Finance Entry?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently remove this financial record. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDeleteEntry} className="bg-destructive hover:bg-destructive/90 rounded-xl">Delete Permanently</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      {/* Delete Loan from Ledger Confirmation */}
      <AlertDialog open={!!loanToDeleteFromLedger} onOpenChange={(open) => !open && setLoanToDeleteFromLedger(null)}>
          <AlertDialogContent className="rounded-[2rem]">
              <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black">Delete Loan Record Permanently?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm">
                      You are about to permanently delete <strong>Loan #{loanToDeleteFromLedger?.loanNumber}</strong> for <strong>{loanToDeleteFromLedger?.customerName}</strong>. 
                      This will remove all associated history and balances. This action is irreversible.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDeleteLoanFromLedger} className="bg-destructive hover:bg-destructive/90 rounded-xl" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                      Delete Permanently
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
