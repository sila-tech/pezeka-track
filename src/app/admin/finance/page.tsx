'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns";
import { 
  FileDown, 
  Loader2, 
  PlusCircle, 
  PenSquare, 
  Trash2, 
  Search, 
  HandCoins, 
  AlertCircle, 
  RefreshCw, 
  Calculator, 
  Wallet, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  History 
} from "lucide-react";
import { arrayUnion, increment, doc, collection } from 'firebase/firestore';

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  addFinanceEntry, 
  updateLoan, 
  deleteFinanceEntry, 
  rolloverLoan, 
  deleteLoan, 
  addPenaltyToLoan, 
  updateFinanceEntry 
} from '@/lib/firestore';
import { Textarea } from '@/components/ui/textarea';
import { EditableFinanceReportTab } from './components/editable-finance-report-tab';
import { InvestorsPortfolioTab } from './components/investors-portfolio-tab';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateAmortization } from '@/lib/utils';

// --- SCHEMAS ---

const addFinanceEntrySchema = z.object({
  type: z.enum(['receipt', 'payout', 'expense'], { required_error: 'Please select an entry type.' }),
  date: z.string().min(1, 'A date is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  description: z.string().optional(),
  loanId: z.string().optional(),
  expenseCategory: z.enum(['facilitation_commission', 'office_purchase', 'other']).optional(),
  receiptCategory: z.enum(['loan_repayment', 'upfront_fees', 'investment', 'other']).optional(),
  payoutCategory: z.enum(['loan_disbursement', 'investor_withdrawal', 'other']).optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'receipt' && !data.receiptCategory) {
        ctx.addIssue({ code: 'custom', message: 'Please select a receipt category.', path: ['receiptCategory'] });
    }
    if (data.type === 'expense' && !data.expenseCategory) {
        ctx.addIssue({ code: 'custom', message: 'Please select an expense category.', path: ['expenseCategory'] });
    }
    if (data.type === 'payout' && !data.payoutCategory) {
        ctx.addIssue({ code: 'custom', message: 'Please select a payout category.', path: ['payoutCategory'] });
    }
});

const paymentSchema = z.object({
    paymentAmount: z.coerce.number().min(0.01, 'Payment amount must be greater than 0.'),
    paymentDate: z.string().min(1, 'Payment date is required.'),
    comments: z.string().optional(),
});

const penaltySchema = z.object({
    penaltyAmount: z.coerce.number().min(0.01, 'Penalty amount must be greater than 0.'),
    penaltyDate: z.string().min(1, 'Penalty date is required.'),
    penaltyDescription: z.string().min(1, 'A description for the penalty is required.'),
});

const editLoanSchema = z.object({
  disbursementDate: z.string().min(1, 'Disbursement date is required.'),
  principalAmount: z.coerce.number().min(1, 'Principal amount is required.'),
  interestRate: z.coerce.number().min(0, 'Interest rate cannot be negative.'),
  registrationFee: z.coerce.number().optional(),
  processingFee: z.coerce.number().optional(),
  carTrackInstallationFee: z.coerce.number().optional(),
  chargingCost: z.coerce.number().optional(),
  numberOfInstalments: z.coerce.number().int().min(1, 'Number of instalments is required.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  status: z.enum(['active', 'due', 'overdue', 'paid', 'rollover', 'application', 'rejected']),
});

const rolloverSchema = z.object({
    rolloverDate: z.string().min(1, 'Rollover date is required.'),
});

// --- INTERFACES ---

interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
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
  payments?: { paymentId: string; date: any; amount: number; }[];
  penalties?: { penaltyId: string; date: any; amount: number; description: string; }[];
  comments?: string;
  status: 'active' | 'due' | 'overdue' | 'paid' | 'rollover' | 'application' | 'rejected';
}

interface FinanceEntry {
  id: string;
  type: 'expense' | 'payout' | 'receipt' | 'unearned';
  date: any;
  amount: number;
  description: string;
  loanId?: string;
  expenseCategory?: string;
  receiptCategory?: string;
  payoutCategory?: string;
}

export default function FinancePage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingPenalty, setIsAddingPenalty] = useState(false);
  const [isEditingLoan, setIsEditingLoan] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);
  const [deleteLoanOpen, setDeleteLoanOpen] = useState(false);
  const [loanBookSearchTerm, setLoanBookSearchTerm] = useState('');
  const [loanBookStatusFilter, setLoanBookStatusFilter] = useState('all');

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isAuthorized = user ? (user.email === 'simon@pezeka.com' || user.role === 'staff' || user.role === 'finance') : false;
  const canPerformActions = user ? (user.email === 'simon@pezeka.com' || user.role === 'finance') : false;

  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<FinanceEntry>(isAuthorized ? 'financeEntries' : null);
  
  const financialData = useMemo(() => {
    const receipts: any[] = [];
    const upfront: any[] = [];
    const payouts: any[] = [];
    const expenses: any[] = [];

    if (!loans || !financeEntries) return { allReceipts: [], allUpfrontFees: [], allPayouts: [], allExpenses: [] };

    loans.forEach(loan => {
        if (loan.status === 'application' || loan.status === 'rejected') return;

        const reg = Number(loan.registrationFee) || 0;
        const proc = Number(loan.processingFee) || 0;
        const track = Number(loan.carTrackInstallationFee) || 0;
        const charge = Number(loan.chargingCost) || 0;
        const totalFees = reg + proc + track + charge;

        if (totalFees > 0) {
            upfront.push({
                id: `fee-${loan.id}`,
                type: 'receipt',
                receiptCategory: 'upfront_fees',
                date: loan.disbursementDate,
                amount: totalFees,
                description: `Retained upfront fees for Loan #${loan.loanNumber} (${loan.customerName})`,
                loanId: loan.id
            });
        }

        (loan.payments || []).forEach(p => {
            receipts.push({
                id: p.paymentId,
                type: 'receipt',
                receiptCategory: 'loan_repayment',
                date: p.date,
                amount: p.amount,
                description: `Repayment for Loan #${loan.loanNumber} (${loan.customerName})`,
                loanId: loan.id
            });
        });
    });

    financeEntries.forEach(entry => {
        const isLendingDupe = (entry.receiptCategory === 'loan_repayment' || entry.receiptCategory === 'upfront_fees');
        if (entry.type === 'receipt') {
            if (!isLendingDupe) receipts.push(entry);
        } else {
            payouts.push(entry);
            if (entry.type === 'expense') {
                expenses.push(entry);
            }
        }
    });

    return { allReceipts: receipts, allUpfrontFees: upfront, allPayouts: payouts, allExpenses: expenses };
  }, [loans, financeEntries]);

  const stats = useMemo(() => {
    const { allReceipts, allUpfrontFees, allPayouts } = financialData;
    const receiptsTotal = allReceipts.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const upfrontTotal = allUpfrontFees.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const totalMoneyIn = receiptsTotal + upfrontTotal;
    const totalMoneyOut = allPayouts.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    
    return {
      totalReceipts: totalMoneyIn,
      totalPayouts: totalMoneyOut,
      cashAtHand: totalMoneyIn - totalMoneyOut
    };
  }, [financialData]);

  const filteredLoans = useMemo(() => {
    if(!loans) return [];
    return loans.filter(loan => {
        const statusMatch = loanBookStatusFilter === 'all' || loan.status === loanBookStatusFilter;
        const searchMatch = loanBookSearchTerm === '' ||
            loan.loanNumber.toLowerCase().includes(loanBookSearchTerm.toLowerCase()) ||
            loan.customerName.toLowerCase().includes(loanBookSearchTerm.toLowerCase()) ||
            loan.customerPhone.includes(loanBookSearchTerm);
        return statusMatch && searchMatch;
    });
  }, [loans, loanBookSearchTerm, loanBookStatusFilter]);

  const addForm = useForm<z.infer<typeof addFinanceEntrySchema>>({
    resolver: zodResolver(addFinanceEntrySchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd') }
  });

  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: format(new Date(), 'yyyy-MM-dd') }
  });

  const penaltyForm = useForm<z.infer<typeof penaltySchema>>({
    resolver: zodResolver(penaltySchema),
    defaultValues: { penaltyDate: format(new Date(), 'yyyy-MM-dd') }
  });

  const editLoanForm = useForm<z.infer<typeof editLoanSchema>>({ resolver: zodResolver(editLoanSchema) });
  
  const rolloverForm = useForm<z.infer<typeof rolloverSchema>>({
    resolver: zodResolver(rolloverSchema),
    defaultValues: { rolloverDate: format(new Date(), 'yyyy-MM-dd') }
  });

  const { watch: addFinanceEntryWatch } = addForm;
  const addFinanceEntryType = addFinanceEntryWatch('type');

  async function onAddSubmit(values: z.infer<typeof addFinanceEntrySchema>) {
    setIsSubmitting(true);
    try {
      const rawEntryData = { ...values, date: new Date(values.date) };
      if (editingEntry) {
          await updateFinanceEntry(firestore, editingEntry.id, rawEntryData);
          toast({ title: 'Success', description: 'Finance entry updated.' });
      } else {
          await addFinanceEntry(firestore, rawEntryData as any);
          toast({ title: 'Success', description: 'Finance entry recorded.' });
      }
      addForm.reset();
      setEditingEntry(null);
      setOpen(false);
    } catch (e: any) {
       toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleEditEntry = (entry: FinanceEntry) => {
      setEditingEntry(entry);
      addForm.reset({
          type: entry.type as any,
          date: format(typeof entry.date === 'string' ? new Date(entry.date) : new Date(entry.date.seconds * 1000), 'yyyy-MM-dd'),
          amount: entry.amount,
          description: entry.description,
          expenseCategory: entry.expenseCategory as any,
          receiptCategory: entry.receiptCategory as any,
          payoutCategory: entry.payoutCategory as any,
      });
      setOpen(true);
  };

  async function onRecordPayment(values: z.infer<typeof paymentSchema>) {
    if (!loanToEdit) return;
    setIsUpdating(true);
    try {
        const paymentId = doc(collection(firestore, 'payments')).id;
        const paymentData = {
            paymentId, 
            amount: values.paymentAmount,
            date: new Date(values.paymentDate)
        };
        await updateLoan(firestore, loanToEdit.id, {
            totalPaid: increment(values.paymentAmount),
            payments: arrayUnion(paymentData),
            comments: values.comments ? `${loanToEdit.comments || ''}\n[${values.paymentDate}] ${values.comments}`.trim() : loanToEdit.comments
        });
        toast({ title: 'Payment Recorded', description: `Successfully added Ksh ${values.paymentAmount.toLocaleString()}`});
        paymentForm.reset();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsUpdating(false);
    }
  }

  async function onAddPenalty(values: z.infer<typeof penaltySchema>) {
    if (!loanToEdit) return;
    setIsAddingPenalty(true);
    try {
        await addPenaltyToLoan(firestore, loanToEdit.id, {
            amount: values.penaltyAmount,
            date: new Date(values.penaltyDate),
            description: values.penaltyDescription
        });
        toast({ title: 'Penalty Added', description: `Penalty of Ksh ${values.penaltyAmount.toLocaleString()} added.`});
        penaltyForm.reset();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsAddingPenalty(false);
    }
  }

  const handleEditLoanClick = () => {
    if (!loanToEdit) return;
    editLoanForm.reset({
        disbursementDate: format(new Date(loanToEdit.disbursementDate.seconds * 1000), 'yyyy-MM-dd'),
        principalAmount: loanToEdit.principalAmount,
        interestRate: loanToEdit.interestRate || 0,
        registrationFee: loanToEdit.registrationFee,
        processingFee: loanToEdit.processingFee,
        carTrackInstallationFee: loanToEdit.carTrackInstallationFee,
        chargingCost: loanToEdit.chargingCost,
        numberOfInstalments: loanToEdit.numberOfInstalments,
        paymentFrequency: loanToEdit.paymentFrequency,
        status: loanToEdit.status
    });
    setIsEditingLoan(true);
  };

  async function onEditLoanSubmit(values: z.infer<typeof editLoanSchema>) {
    if (!loanToEdit) return;
    setIsUpdating(true);
    try {
        const { instalmentAmount, totalRepayableAmount } = calculateAmortization(values.principalAmount, values.interestRate, values.numberOfInstalments, values.paymentFrequency);
        const updateData = {
            ...values,
            disbursementDate: new Date(values.disbursementDate),
            instalmentAmount,
            totalRepayableAmount: totalRepayableAmount + (loanToEdit.totalPenalties || 0)
        };
        await updateLoan(firestore, loanToEdit.id, updateData);
        toast({ title: 'Loan Updated' });
        setIsEditingLoan(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
        setIsUpdating(false);
    }
  }

  async function onRolloverSubmit(values: z.infer<typeof rolloverSchema>) {
    if (!loanToEdit) return;
    setIsRollingOver(true);
    try {
        await rolloverLoan(firestore, loanToEdit, new Date(values.rolloverDate));
        toast({ title: 'Loan Rolled Over' });
        setLoanToEdit(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Rollover Failed', description: e.message });
    } finally {
        setIsRollingOver(false);
    }
  }

  async function confirmDeleteLoan() {
    if (!loanToEdit) return;
    setIsUpdating(true);
    try {
        await deleteLoan(firestore, loanToEdit.id);
        toast({ title: 'Loan Deleted' });
        setLoanToEdit(null);
        setDeleteLoanOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
        setIsUpdating(false);
    }
  }

  if (userLoading || loansLoading || financeEntriesLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
            {canPerformActions && (
            <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if(!isOpen) setEditingEntry(null); }}>
                <DialogTrigger asChild><Button onClick={() => setEditingEntry(null)}><PlusCircle className="mr-2 h-4 w-4" /> Add Entry</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingEntry ? 'Edit Finance Entry' : 'New Finance Entry'}</DialogTitle></DialogHeader>
                    <Form {...addForm}>
                        <ScrollArea className="max-h-[70vh] pr-4">
                            <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                                <FormField control={addForm.control} name="type" render={({ field }) => (
                                    <FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type"/></SelectTrigger></FormControl><SelectContent><SelectItem value="receipt">Receipt (Income)</SelectItem><SelectItem value="payout">Payout (Outgoing)</SelectItem><SelectItem value="expense">Expense (Operational)</SelectItem></Select></FormItem>
                                )} />
                                {addFinanceEntryType === 'payout' && (
                                    <FormField control={addForm.control} name="payoutCategory" render={({ field }) => (
                                        <FormItem><FormLabel>Payout Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select payout category"/></SelectTrigger></FormControl><SelectContent><SelectItem value="loan_disbursement">Loan Disbursement</SelectItem><SelectItem value="investor_withdrawal">Investor Withdrawal</SelectItem><SelectItem value="other">Other Payout</SelectItem></Select></FormItem>
                                    )} />
                                )}
                                {addFinanceEntryType === 'receipt' && (
                                    <FormField control={addForm.control} name="receiptCategory" render={({ field }) => (
                                        <FormItem><FormLabel>Receipt Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select receipt category"/></SelectTrigger></FormControl><SelectContent><SelectItem value="loan_repayment">Loan Repayment</SelectItem><SelectItem value="upfront_fees">Upfront Fees</SelectItem><SelectItem value="investment">Investor Deposit</SelectItem><SelectItem value="other">Other Income</SelectItem></Select></FormItem>
                                    )} />
                                )}
                                {addFinanceEntryType === 'expense' && (
                                    <FormField control={addForm.control} name="expenseCategory" render={({ field }) => (
                                        <FormItem><FormLabel>Expense Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select expense category"/></SelectTrigger></FormControl><SelectContent><SelectItem value="facilitation_commission">Facilitation Commission</SelectItem><SelectItem value="office_purchase">Office Purchase</SelectItem><SelectItem value="other">Other Expense</SelectItem></Select></FormItem>
                                    )} />
                                )}
                                <FormField control={addForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                                <FormField control={addForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field}/></FormControl></FormItem>)} />
                                <FormField control={addForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field}/></FormControl></FormItem>)} />
                                <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}{editingEntry ? 'Update Entry' : 'Record Entry'}</Button>
                            </form>
                        </ScrollArea>
                    </Form>
                </DialogContent>
            </Dialog>
            )}
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Cash at Hand</CardTitle><Wallet className="h-4 w-4 text-muted-foreground"/></CardHeader>
                <CardContent><div className="text-2xl font-bold">Ksh {stats.cashAtHand.toLocaleString()}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Receipts</CardTitle><ArrowUpCircle className="h-4 w-4 text-green-600"/></CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600">Ksh {stats.totalReceipts.toLocaleString()}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Payouts</CardTitle><ArrowDownCircle className="h-4 w-4 text-destructive"/></CardHeader>
                <CardContent><div className="text-2xl font-bold text-destructive">Ksh {stats.totalPayouts.toLocaleString()}</div></CardContent>
            </Card>
        </div>
      </div>

      <Tabs defaultValue="receipts">
          <ScrollArea className="w-full whitespace-nowrap pb-4">
              <TabsList className="inline-flex w-max">
                  <TabsTrigger value="receipts">Receipts</TabsTrigger>
                  <TabsTrigger value="upfront">Upfront Fees</TabsTrigger>
                  <TabsTrigger value="payouts">Payouts (Total Out)</TabsTrigger>
                  <TabsTrigger value="expenses">Expenses (Ops)</TabsTrigger>
                  <TabsTrigger value="loanbook">Loan Book</TabsTrigger>
                  {canPerformActions && <TabsTrigger value="investors">Investors</TabsTrigger>}
              </TabsList>
              <ScrollBar orientation="horizontal" />
          </ScrollArea>
          
          <TabsContent value="receipts">
              <EditableFinanceReportTab 
                title="Receipts" 
                description="Includes loan repayments, investor deposits, and other income." 
                entries={financialData.allReceipts} 
                loading={false} 
                onEdit={(e) => {
                    if (e.id.startsWith('fee-')) return;
                    handleEditEntry(e);
                }}
                onDelete={(e) => {
                    if (e.id.startsWith('fee-')) return;
                    deleteFinanceEntry(firestore, e.id);
                }} 
              />
          </TabsContent>
          <TabsContent value="upfront">
              <EditableFinanceReportTab 
                title="Upfront Fees" 
                description="Revenue from Registration, Processing, and other fees retained during disbursement." 
                entries={financialData.allUpfrontFees} 
                loading={false} 
                onDelete={(e) => {
                    if (e.id.startsWith('fee-')) return;
                    deleteFinanceEntry(firestore, e.id);
                }}
              />
          </TabsContent>
          <TabsContent value="payouts">
              <EditableFinanceReportTab 
                title="Payouts" 
                description="Master ledger of all outgoing funds: take-home disbursements, withdrawals, and all expenses." 
                entries={financialData.allPayouts} 
                loading={false} 
                onEdit={(e) => handleEditEntry(e)}
                onDelete={(e) => deleteFinanceEntry(firestore, e.id)} 
              />
          </TabsContent>
          <TabsContent value="expenses">
               <EditableFinanceReportTab 
                title="Expenses" 
                description="Dedicated view of operational costs and miscellaneous spending." 
                entries={financialData.allExpenses} 
                loading={false} 
                onEdit={(e) => handleEditEntry(e)}
                onDelete={(e) => deleteFinanceEntry(firestore, e.id)} 
               />
          </TabsContent>
          
          <TabsContent value="loanbook">
              <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>Loan Book</CardTitle>
                            <CardDescription>Comprehensive list of all loans and financial breakdowns.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={loanBookStatusFilter} onValueChange={setLoanBookStatusFilter}>
                                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Loans</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="due">Due</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="rollover">Rollover</SelectItem>
                                    <SelectItem value="application">Application</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search..." value={loanBookSearchTerm} onChange={(e) => setLoanBookSearchTerm(e.target.value)} className="pl-8 w-[250px]" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[65vh] w-full">
                        <Table className="min-w-[1800px]">
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead className="w-[150px]">Client Name</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Loan No.</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Principal</TableHead>
                                    <TableHead className="text-right">Reg Fee</TableHead>
                                    <TableHead className="text-right">Proc Fee</TableHead>
                                    <TableHead className="text-right">Take Home</TableHead>
                                    <TableHead className="text-right">Car Track</TableHead>
                                    <TableHead className="text-right">Charge Cost</TableHead>
                                    <TableHead className="text-center">Instalments</TableHead>
                                    <TableHead className="text-right">Inst. Amount</TableHead>
                                    <TableHead className="text-right">Amount to Pay</TableHead>
                                    <TableHead className="text-right">Paid Amount</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="text-right">Expected Interest</TableHead>
                                    <TableHead className="text-right">Expected Income</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-center">History</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLoans.map(loan => {
                                    const reg = Number(loan.registrationFee) || 0;
                                    const proc = Number(loan.processingFee) || 0;
                                    const track = Number(loan.carTrackInstallationFee) || 0;
                                    const charge = Number(loan.chargingCost) || 0;
                                    const totalFees = reg + proc + track + charge;
                                    const takeHome = Number(loan.principalAmount) - totalFees;
                                    const expectedInterest = (loan.totalRepayableAmount || 0) - loan.principalAmount;
                                    const expectedIncome = expectedInterest + totalFees;
                                    const balance = (loan.totalRepayableAmount || 0) - loan.totalPaid;

                                    return (
                                        <TableRow key={loan.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setLoanToEdit(loan)}>
                                            <TableCell className="font-medium whitespace-nowrap">{loan.customerName}</TableCell>
                                            <TableCell className="whitespace-nowrap">{loan.customerPhone}</TableCell>
                                            <TableCell className="whitespace-nowrap">{loan.loanNumber}</TableCell>
                                            <TableCell className="whitespace-nowrap">{format(new Date(loan.disbursementDate.seconds * 1000), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-right">{loan.principalAmount.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{reg.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{proc.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-semibold text-primary">{takeHome.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{track.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{charge.toLocaleString()}</TableCell>
                                            <TableCell className="text-center">{loan.numberOfInstalments} ({loan.paymentFrequency[0].toUpperCase()})</TableCell>
                                            <TableCell className="text-right">{loan.instalmentAmount.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-medium">{loan.totalRepayableAmount?.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-green-600">{loan.totalPaid.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold text-destructive">{balance.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-blue-600">{expectedInterest.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold text-green-700">{expectedIncome.toLocaleString()}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={loan.status === 'paid' ? 'default' : (loan.status === 'due' || loan.status === 'overdue') ? 'destructive' : 'secondary'}>{loan.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setLoanToEdit(loan); }}>
                                                    <History className="h-4 w-4" />
                                                </Button>
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
          
          {canPerformActions && (
            <TabsContent value="investors">
                <InvestorsPortfolioTab />
            </TabsContent>
          )}
      </Tabs>

      <Dialog open={!!loanToEdit} onOpenChange={(isOpen) => !isOpen && setLoanToEdit(null)}>
          <DialogContent className="sm:max-w-4xl">
              {loanToEdit && (
                  <>
                    <DialogHeader>
                        <div className="flex items-center justify-between pr-6">
                            <DialogTitle>Manage Loan #{loanToEdit.loanNumber}</DialogTitle>
                            <Badge>{loanToEdit.status.toUpperCase()}</Badge>
                        </div>
                        <DialogDescription>Customer: {loanToEdit.customerName}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[75vh] pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                            <div className="md:col-span-2 space-y-6">
                                <Card>
                                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><HandCoins className="h-4 w-4"/> Financial Overview</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-2 gap-4">
                                        <div><p className="text-xs text-muted-foreground">Total Repayable</p><p className="font-bold">Ksh {loanToEdit.totalRepayableAmount?.toLocaleString()}</p></div>
                                        <div><p className="text-xs text-muted-foreground">Total Paid</p><p className="font-bold text-green-600">Ksh {loanToEdit.totalPaid.toLocaleString()}</p></div>
                                        <div><p className="text-xs text-muted-foreground">Outstanding Balance</p><p className="font-bold text-lg text-destructive">Ksh {(loanToEdit.totalRepayableAmount - loanToEdit.totalPaid).toLocaleString()}</p></div>
                                        <div><p className="text-xs text-muted-foreground">Instalment</p><p className="font-bold">Ksh {loanToEdit.instalmentAmount.toLocaleString()} ({loanToEdit.paymentFrequency})</p></div>
                                    </CardContent>
                                </Card>
                                
                                <Tabs defaultValue="payments">
                                    <TabsList><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="penalties">Penalties</TabsTrigger><TabsTrigger value="actions">Advanced Actions</TabsTrigger></TabsList>
                                    <TabsContent value="payments" className="space-y-4">
                                        {canPerformActions && (
                                            <Card className="border-primary/20 bg-primary/5">
                                                <CardHeader><CardTitle className="text-sm">Record New Payment</CardTitle></CardHeader>
                                                <CardContent>
                                                    <Form {...paymentForm}>
                                                        <form onSubmit={paymentForm.handleSubmit(onRecordPayment)} className="flex items-end gap-2">
                                                            <FormField control={paymentForm.control} name="paymentAmount" render={({field}) => (<FormItem className="flex-1"><FormLabel className="text-xs">Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                                                            <FormField control={paymentForm.control} name="paymentDate" render={({field}) => (<FormItem className="flex-1"><FormLabel className="text-xs">Date</FormLabel><FormControl><Input type="date" {...field}/></FormControl></FormItem>)} />
                                                            <Button type="submit" disabled={isUpdating}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Record</Button>
                                                        </form>
                                                    </Form>
                                                </CardContent>
                                            </Card>
                                        )}
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {loanToEdit.payments?.map((p, i) => (
                                                    <TableRow key={i}><TableCell>{format(new Date(p.date.seconds * 1000), 'dd/MM/yyyy')}</TableCell><TableCell className="text-right">Ksh {p.amount.toLocaleString()}</TableCell></TableRow>
                                                ))}
                                                {(!loanToEdit.payments || loanToEdit.payments.length === 0) && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">No payments recorded</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    </TabsContent>
                                    <TabsContent value="penalties" className="space-y-4">
                                        {canPerformActions && (
                                            <Card className="border-destructive/20 bg-destructive/5">
                                                <CardHeader><CardTitle className="text-sm">Add Penalty</CardTitle></CardHeader>
                                                <CardContent>
                                                    <Form {...penaltyForm}>
                                                        <form onSubmit={penaltyForm.handleSubmit(onAddPenalty)} className="space-y-2">
                                                            <div className="flex gap-2">
                                                                <FormField control={penaltyForm.control} name="penaltyAmount" render={({field}) => (<FormItem className="flex-1"><FormControl><Input type="number" placeholder="Amount" {...field}/></FormControl></FormItem>)} />
                                                                <FormField control={penaltyForm.control} name="penaltyDate" render={({field}) => (<FormItem className="flex-1"><FormControl><Input type="date" {...field}/></FormControl></FormItem>)} />
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <FormField control={penaltyForm.control} name="penaltyDescription" render={({field}) => (<FormItem className="flex-1"><FormControl><Input placeholder="Reason" {...field}/></FormControl></FormItem>)} />
                                                                <Button type="submit" variant="destructive" disabled={isAddingPenalty}>{isAddingPenalty && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add</Button>
                                                            </div>
                                                        </form>
                                                    </Form>
                                                </CardContent>
                                            </Card>
                                        )}
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {loanToEdit.penalties?.map((p, i) => (
                                                    <TableRow key={i}><TableCell>{format(new Date(p.date.seconds * 1000), 'dd/MM/yy')}</TableCell><TableCell>{p.description}</TableCell><TableCell className="text-right">Ksh {p.amount.toLocaleString()}</TableCell></TableRow>
                                                ))}
                                                {(!loanToEdit.penalties || loanToEdit.penalties.length === 0) && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No penalties applied</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    </TabsContent>
                                    <TabsContent value="actions" className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Card>
                                                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4"/> Rollover</CardTitle></CardHeader>
                                                <CardContent>
                                                    <Form {...rolloverForm}>
                                                        <form onSubmit={rolloverForm.handleSubmit(onRolloverSubmit)} className="space-y-2">
                                                            <FormField control={rolloverForm.control} name="rolloverDate" render={({field}) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">Rollover Date</FormLabel>
                                                                    <FormControl><Input type="date" {...field}/></FormControl>
                                                                </FormItem>
                                                            )} />
                                                            <Button type="submit" variant="outline" className="w-full" disabled={isRollingOver || !canPerformActions}>
                                                                {isRollingOver && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Process Rollover
                                                            </Button>
                                                        </form>
                                                    </Form>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4"/> Structure</CardTitle></CardHeader>
                                                <CardContent className="space-y-2">
                                                    <Button onClick={handleEditLoanClick} variant="outline" className="w-full" disabled={!canPerformActions}><PenSquare className="mr-2 h-4 w-4"/> Edit Parameters</Button>
                                                    {user?.email === 'simon@pezeka.com' && <Button onClick={() => setDeleteLoanOpen(true)} variant="destructive" className="w-full"><Trash2 className="mr-2 h-4 w-4"/> Delete Loan</Button>}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4"/> Loan Profile</CardTitle></CardHeader>
                                    <CardContent className="text-sm space-y-2">
                                        <div className="flex justify-between"><span>Principal:</span><span className="font-medium">Ksh {loanToEdit.principalAmount.toLocaleString()}</span></div>
                                        <div className="flex justify-between"><span>Rate:</span><span className="font-medium">{loanToEdit.interestRate}% monthly</span></div>
                                        <div className="flex justify-between"><span>Instalments:</span><span className="font-medium">{loanToEdit.numberOfInstalments}</span></div>
                                        <div className="flex justify-between"><span>Disbursed:</span><span className="font-medium">{format(new Date(loanToEdit.disbursementDate.seconds * 1000), 'dd/MM/yyyy')}</span></div>
                                        <div className="pt-2 border-t text-xs italic text-muted-foreground">{loanToEdit.comments || 'No comments'}</div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>

      <Dialog open={isEditingLoan} onOpenChange={setIsEditingLoan}>
          <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Edit Loan Parameters</DialogTitle><DialogDescription>Update principal, rates, or fees. This recalculates totals.</DialogDescription></DialogHeader>
              <Form {...editLoanForm}>
                  <form onSubmit={editLoanForm.handleSubmit(onEditLoanSubmit)} className="grid grid-cols-2 gap-4 py-4">
                      <FormField control={editLoanForm.control} name="disbursementDate" render={({field}) => (<FormItem className="col-span-2"><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field}/></FormControl></FormItem>)} />
                      <FormField control={editLoanForm.control} name="principalAmount" render={({field}) => (<FormItem><FormLabel>Principal</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                      <FormField control={editLoanForm.control} name="interestRate" render={({field}) => (<FormItem><FormLabel>Interest %</FormLabel><FormControl><Input type="number" step="0.01" {...field}/></FormControl></FormItem>)} />
                      <FormField control={editLoanForm.control} name="numberOfInstalments" render={({field}) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                      <FormField control={editLoanForm.control} name="paymentFrequency" render={({field}) => (<FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></Select></FormItem>)} />
                      <FormField control={editLoanForm.control} name="registrationFee" render={({field}) => (<FormItem><FormLabel>Reg Fee</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                      <FormField control={editLoanForm.control} name="processingFee" render={({field}) => (<FormItem><FormLabel>Proc Fee</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                      <FormField control={editLoanForm.control} name="carTrackInstallationFee" render={({field}) => (<FormItem><FormLabel>Car Track</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                      <FormField control={editLoanForm.control} name="chargingCost" render={({field}) => (<FormItem><FormLabel>Charge Cost</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                      <FormField control={editLoanForm.control} name="status" render={({field}) => (<FormItem className="col-span-2"><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="due">Due</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="rollover">Rollover</SelectItem></Select></FormItem>)} />
                      <div className="col-span-2 pt-4 flex gap-2">
                          <Button type="submit" className="flex-1" disabled={isUpdating}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Changes</Button>
                          <Button type="button" variant="outline" onClick={() => setIsEditingLoan(false)}>Cancel</Button>
                      </div>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>

      <AlertDialog open={deleteLoanOpen} onOpenChange={setDeleteLoanOpen}>
          <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete Loan Record?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the loan and all history. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteLoanOpen(false)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDeleteLoan} className="bg-destructive hover:bg-destructive/90 text-white" disabled={isUpdating}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Delete Permanently</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}