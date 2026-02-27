
'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns";
import { 
  PlusCircle, 
  Search, 
  Loader2,
  TrendingUp,
  Wallet,
  HandCoins,
  Receipt,
  CreditCard,
  User,
  MessageSquare,
  Plus
} from "lucide-react";
import { arrayUnion, increment, doc, collection } from 'firebase/firestore';

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { 
  addFinanceEntry, 
  updateLoan, 
  deleteFinanceEntry, 
  rolloverLoan, 
  addPenaltyToLoan, 
  updateFinanceEntry,
  addFollowUpNoteToLoan
} from '@/lib/firestore';
import { Textarea } from '@/components/ui/textarea';
import { EditableFinanceReportTab } from './components/editable-finance-report-tab';
import { InvestorsPortfolioTab } from './components/investors-portfolio-tab';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const addFinanceEntrySchema = z.object({
  type: z.enum(['receipt', 'payout', 'expense'], { required_error: 'Please select an entry type.' }),
  date: z.string().min(1, 'A date is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  transactionFee: z.coerce.number().min(0, 'Transaction fee cannot be negative.').optional(),
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

const followUpNoteSchema = z.object({
    content: z.string().min(5, "Note must be at least 5 characters long."),
});

interface FollowUpNote {
    noteId: string;
    date: any;
    staffName: string;
    staffId: string;
    content: string;
}

interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  alternativeNumber?: string;
  idNumber?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
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
  followUpNotes?: FollowUpNote[];
  comments?: string;
  status: 'active' | 'due' | 'overdue' | 'paid' | 'rollover' | 'application' | 'rejected';
}

interface FinanceEntry {
  id: string;
  type: 'expense' | 'payout' | 'receipt' | 'unearned';
  date: any;
  amount: number;
  transactionFee?: number;
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
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [loanBookSearchTerm, setLoanBookSearchTerm] = useState('');
  const [loanBookStatusFilter, setLoanBookStatusFilter] = useState('all');

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isAuthorized = user ? (user.email === 'simon@pezeka.com' || user.role === 'finance') : false;

  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<FinanceEntry>(isAuthorized ? 'financeEntries' : null);
  
  const financialData = useMemo(() => {
    const receipts: any[] = [];
    const upfront: any[] = [];
    const payouts: any[] = [];
    const expenses: any[] = [];
    const transactionFees: any[] = [];

    if (!loans || !financeEntries) return { allReceipts: [], allUpfrontFees: [], allPayouts: [], allExpenses: [], allTransactionFees: [] };

    loans.forEach(loan => {
        if (loan.status === 'application' || loan.status === 'rejected') return;
        const totalFees = (Number(loan.registrationFee) || 0) + (Number(loan.processingFee) || 0) + (Number(loan.carTrackInstallationFee) || 0) + (Number(loan.chargingCost) || 0);
        if (totalFees > 0) {
            upfront.push({ 
                id: `fee-${loan.id}`, 
                type: 'receipt', 
                receiptCategory: 'upfront_fees', 
                date: loan.disbursementDate, 
                amount: totalFees, 
                description: `Fees Breakdown: Loan #${loan.loanNumber}. Reg: ${loan.registrationFee}, Proc: ${loan.processingFee}, Track: ${loan.carTrackInstallationFee}, Charge: ${loan.chargingCost}`, 
                loanId: loan.id 
            });
        }
        (loan.payments || []).forEach(p => {
            receipts.push({ id: p.paymentId, type: 'receipt', receiptCategory: 'loan_repayment', date: p.date, amount: p.amount, description: `Repayment: Loan #${loan.loanNumber}`, loanId: loan.id });
        });
    });

    financeEntries.forEach(entry => {
        const isLendingDupe = (entry.receiptCategory === 'loan_repayment' || entry.receiptCategory === 'upfront_fees');
        if (entry.type === 'receipt') {
            if (!isLendingDupe) receipts.push(entry);
        } else {
            payouts.push(entry);
            if (entry.type === 'expense') expenses.push(entry);
            
            if (entry.transactionFee && Number(entry.transactionFee) > 0) {
                transactionFees.push({
                    id: `tx-fee-${entry.id}`,
                    type: 'expense',
                    expenseCategory: 'other',
                    date: entry.date,
                    amount: entry.transactionFee,
                    description: `Transaction Fee for: ${entry.description}`
                });
            }
        }
    });

    return { allReceipts: receipts, allUpfrontFees: upfront, allPayouts: payouts, allExpenses: expenses, allTransactionFees: transactionFees };
  }, [loans, financeEntries]);

  const stats = useMemo(() => {
    const { allReceipts, allUpfrontFees, allPayouts, allTransactionFees } = financialData;
    const receiptsTotal = allReceipts.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const upfrontTotal = allUpfrontFees.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const totalMoneyIn = receiptsTotal + upfrontTotal;
    
    const payoutTotal = allPayouts.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const txFeeTotal = allTransactionFees.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const totalMoneyOut = payoutTotal + txFeeTotal;

    return { totalReceipts: totalMoneyIn, totalPayouts: totalMoneyOut, cashAtHand: totalMoneyIn - totalMoneyOut };
  }, [financialData]);

  const filteredLoans = useMemo(() => {
    if(!loans) return [];
    return loans.filter(loan => {
        const statusMatch = loanBookStatusFilter === 'all' || loan.status === loanBookStatusFilter;
        const searchMatch = loanBookSearchTerm === '' || 
            loan.loanNumber.toLowerCase().includes(loanBookSearchTerm.toLowerCase()) || 
            loan.customerName.toLowerCase().includes(loanBookSearchTerm.toLowerCase()) ||
            loan.customerPhone?.includes(loanBookSearchTerm) ||
            loan.idNumber?.includes(loanBookSearchTerm) ||
            loan.assignedStaffName?.toLowerCase().includes(loanBookSearchTerm.toLowerCase());
        return statusMatch && searchMatch;
    });
  }, [loans, loanBookSearchTerm, loanBookStatusFilter]);

  const addForm = useForm<z.infer<typeof addFinanceEntrySchema>>({
    resolver: zodResolver(addFinanceEntrySchema),
    defaultValues: { 
      date: format(new Date(), 'yyyy-MM-dd'), 
      type: 'receipt', 
      transactionFee: 0,
      amount: 0,
      description: '',
      loanId: '',
      expenseCategory: undefined,
      receiptCategory: undefined,
      payoutCategory: undefined
    }
  });

  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { 
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      paymentAmount: 0,
      comments: ''
    }
  });

  const penaltyForm = useForm<z.infer<typeof penaltySchema>>({
    resolver: zodResolver(penaltySchema),
    defaultValues: { 
      penaltyDate: format(new Date(), 'yyyy-MM-dd'),
      penaltyAmount: 0,
      penaltyDescription: ''
    }
  });

  const noteForm = useForm<z.infer<typeof followUpNoteSchema>>({
      resolver: zodResolver(followUpNoteSchema),
      defaultValues: { content: '' },
  });

  const addFinanceEntryType = addForm.watch('type');

  useEffect(() => {
    if (addFinanceEntryType === 'receipt') {
        addForm.setValue('payoutCategory', undefined);
        addForm.setValue('expenseCategory', undefined);
    } else if (addFinanceEntryType === 'payout') {
        addForm.setValue('receiptCategory', undefined);
        addForm.setValue('expenseCategory', undefined);
    } else if (addFinanceEntryType === 'expense') {
        addForm.setValue('receiptCategory', undefined);
        addForm.setValue('payoutCategory', undefined);
    }
  }, [addFinanceEntryType, addForm]);

  async function onAddSubmit(values: z.infer<typeof addFinanceEntrySchema>) {
    setIsSubmitting(true);
    try {
      const sanitizedData: any = {
        type: values.type,
        date: new Date(values.date),
        amount: values.amount,
        transactionFee: values.transactionFee || 0,
        description: values.description || '',
      };

      if (values.loanId) sanitizedData.loanId = values.loanId;

      if (values.type === 'receipt') {
        sanitizedData.receiptCategory = values.receiptCategory;
      } else if (values.type === 'payout') {
        sanitizedData.payoutCategory = values.payoutCategory;
      } else if (values.type === 'expense') {
        sanitizedData.expenseCategory = values.expenseCategory;
      }

      if (editingEntry) { 
        await updateFinanceEntry(firestore, editingEntry.id, sanitizedData); 
      } else { 
        await addFinanceEntry(firestore, sanitizedData); 
      }
      
      addForm.reset(); 
      setEditingEntry(null); 
      setOpen(false);
      toast({ title: editingEntry ? 'Entry Updated' : 'Entry Recorded' });
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
          transactionFee: entry.transactionFee || 0,
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
        await updateLoan(firestore, loanToEdit.id, { 
          totalPaid: increment(values.paymentAmount), 
          payments: arrayUnion({ paymentId, amount: values.paymentAmount, date: new Date(values.paymentDate) }) 
        });
        toast({ title: 'Payment Recorded' });
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
        toast({ title: 'Penalty Added' });
        penaltyForm.reset();
    } catch (e: any) { 
      toast({ variant: 'destructive', title: 'Error', description: e.message }); 
    } finally { 
      setIsAddingPenalty(false); 
    }
  }

  async function onAddNoteSubmit(values: z.infer<typeof followUpNoteSchema>) {
      if (!loanToEdit || !user) return;
      setIsAddingNote(true);
      try {
          await addFollowUpNoteToLoan(firestore, loanToEdit.id, {
              content: values.content,
              staffName: user.name || user.email?.split('@')[0] || "Staff",
              staffId: user.uid,
          });
          toast({ title: "Note Added" });
          noteForm.reset();
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
      } finally {
          setIsAddingNote(false);
      }
  }

  if (userLoading || loansLoading || financeEntriesLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAuthorized) return <div className="flex h-screen w-full flex-col items-center justify-center"><h2>Access Restricted</h2></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
            <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if(!isOpen) setEditingEntry(null); }}>
                <DialogTrigger asChild><Button onClick={() => setEditingEntry(null)}><PlusCircle className="mr-2 h-4 w-4" /> Add Entry</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingEntry ? 'Edit Entry' : 'New Entry'}</DialogTitle></DialogHeader>
                    <Form {...addForm}>
                        <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                            <FormField control={addForm.control} name="type" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Type</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select type"/></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="receipt">Receipt (Income)</SelectItem>
                                      <SelectItem value="payout">Payout (Outgoing)</SelectItem>
                                      <SelectItem value="expense">Expense (Operational)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                            )} />
                            {addFinanceEntryType === 'payout' && (
                                <FormField control={addForm.control} name="payoutCategory" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Payout Category</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select payout category"/></SelectTrigger></FormControl>
                                        <SelectContent>
                                          <SelectItem value="loan_disbursement">Loan Disbursement</SelectItem>
                                          <SelectItem value="investor_withdrawal">Investor Withdrawal</SelectItem>
                                          <SelectItem value="other">Other Payout</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                )} />
                            )}
                            {addFinanceEntryType === 'receipt' && (
                                <FormField control={addForm.control} name="receiptCategory" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Receipt Category</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select receipt category"/></SelectTrigger></FormControl>
                                        <SelectContent>
                                          <SelectItem value="loan_repayment">Loan Repayment</SelectItem>
                                          <SelectItem value="upfront_fees">Upfront Fees</SelectItem>
                                          <SelectItem value="investment">Investor Deposit</SelectItem>
                                          <SelectItem value="other">Other Income</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                )} />
                            )}
                            {addFinanceEntryType === 'expense' && (
                                <FormField control={addForm.control} name="expenseCategory" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Expense Category</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select expense category"/></SelectTrigger></FormControl>
                                        <SelectContent>
                                          <SelectItem value="facilitation_commission">Facilitation Commission</SelectItem>
                                          <SelectItem value="office_purchase">Office Purchase</SelectItem>
                                          <SelectItem value="other">Other Expense</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                )} />
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={addForm.control} name="amount" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Amount (Ksh)</FormLabel>
                                    <FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl>
                                  </FormItem>
                                )} />
                                {addFinanceEntryType !== 'receipt' && (
                                    <FormField control={addForm.control} name="transactionFee" render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Tx Fee (Ksh)</FormLabel>
                                        <FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl>
                                      </FormItem>
                                    )} />
                                )}
                            </div>
                            <FormField control={addForm.control} name="date" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl><Input type="date" {...field} value={field.value ?? ''}/></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={addForm.control} name="description" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl><Textarea {...field} value={field.value ?? ''}/></FormControl>
                              </FormItem>
                            )} />
                            <Button type="submit" className="w-full" disabled={isSubmitting}>{editingEntry ? 'Update' : 'Record'}</Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cash at Hand</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">Ksh {stats.cashAtHand.toLocaleString()}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Total In</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">Ksh {stats.totalReceipts.toLocaleString()}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">Total Out (incl. Fees)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">Ksh {stats.totalPayouts.toLocaleString()}</div></CardContent></Card>
        </div>
      </div>

      <Tabs defaultValue="loanbook" className="w-full">
          <TabsList className="mb-4">
              <TabsTrigger value="loanbook">Loan Book</TabsTrigger>
              <TabsTrigger value="upfront">Upfront Fees</TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
              <TabsTrigger value="txfees">Transaction Fees</TabsTrigger>
              <TabsTrigger value="investors">Investors</TabsTrigger>
          </TabsList>
          
          <TabsContent value="loanbook">
              <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>Internal Ledger</CardTitle>
                            <CardDescription>Comprehensive record of all disbursed loans and their financial parameters.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search ledger..." value={loanBookSearchTerm} onChange={(e) => setLoanBookSearchTerm(e.target.value)} className="pl-8 w-[250px]" />
                            </div>
                            <Select value={loanBookStatusFilter} onValueChange={setLoanBookStatusFilter}>
                                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="due">Due</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[65vh] w-full">
                      <Table className="min-w-[3000px]">
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead className="w-[250px]">Client Name</TableHead>
                            <TableHead className="w-[150px]">Client Phone</TableHead>
                            <TableHead className="w-[120px]">Loan No.</TableHead>
                            <TableHead className="w-[120px]">Date</TableHead>
                            <TableHead className="w-[180px]">Follow-up Staff</TableHead>
                            <TableHead className="text-right w-[150px]">Principal</TableHead>
                            <TableHead className="text-right w-[120px]">Reg Fee</TableHead>
                            <TableHead className="text-right w-[120px]">Proc Fee</TableHead>
                            <TableHead className="text-right w-[150px] bg-muted/30">Take Home</TableHead>
                            <TableHead className="text-right w-[120px]">Car Track</TableHead>
                            <TableHead className="text-right w-[120px]">Charging Cost</TableHead>
                            <TableHead className="text-center w-[100px]">Instalments</TableHead>
                            <TableHead className="text-right w-[150px]">Instalment Amt</TableHead>
                            <TableHead className="text-right w-[150px]">Amount to Pay</TableHead>
                            <TableHead className="text-right w-[150px] text-green-600">Paid Amount</TableHead>
                            <TableHead className="text-right w-[150px] font-bold">Balance</TableHead>
                            <TableHead className="text-right w-[150px] text-blue-600">Exp. Interest</TableHead>
                            <TableHead className="text-right w-[150px] text-orange-600">Exp. Income</TableHead>
                            <TableHead className="text-center w-[120px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLoans.map(loan => {
                            const reg = Number(loan.registrationFee) || 0;
                            const proc = Number(loan.processingFee) || 0;
                            const track = Number(loan.carTrackInstallationFee) || 0;
                            const charge = Number(loan.chargingCost) || 0;
                            const feesTotal = reg + proc + track + charge;
                            const takeHome = loan.principalAmount - feesTotal;
                            const expInterest = (loan.totalRepayableAmount - (Number(loan.totalPenalties) || 0)) - loan.principalAmount;
                            const expIncome = feesTotal + expInterest;
                            const balance = loan.totalRepayableAmount - loan.totalPaid;

                            return (
                                <TableRow key={loan.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setLoanToEdit(loan)}>
                                  <TableCell className="font-medium">
                                    {loan.customerName}
                                    <div className="text-[10px] text-muted-foreground">ID: {loan.idNumber || "N/A"}</div>
                                  </TableCell>
                                  <TableCell>{loan.customerPhone}</TableCell>
                                  <TableCell>{loan.loanNumber}</TableCell>
                                  <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'dd/MM/yy')}</TableCell>
                                  <TableCell>
                                      <div className="flex items-center gap-1">
                                          <User className="h-3 w-3 text-muted-foreground" />
                                          <span className="text-xs">{loan.assignedStaffName || "Unassigned"}</span>
                                      </div>
                                  </TableCell>
                                  <TableCell className="text-right">{loan.principalAmount.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{reg.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{proc.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-semibold bg-muted/30">{takeHome.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{track.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{charge.toLocaleString()}</TableCell>
                                  <TableCell className="text-center">{loan.numberOfInstalments}</TableCell>
                                  <TableCell className="text-right">{loan.instalmentAmount.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{loan.totalRepayableAmount.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-green-600">{loan.totalPaid.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-bold">{balance.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-blue-600">{expInterest.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-orange-600">{expIncome.toLocaleString()}</TableCell>
                                  <TableCell className="text-center">
                                      <Badge variant={loan.status === 'paid' ? 'default' : (loan.status === 'due' || loan.status === 'overdue') ? 'destructive' : 'secondary'}>
                                          {loan.status}
                                      </Badge>
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

          <TabsContent value="upfront">
            <EditableFinanceReportTab 
                title="Upfront Fees" 
                description="Fees collected directly from loan disbursements." 
                entries={financialData.allUpfrontFees} 
                loading={false} 
            />
          </TabsContent>

          <TabsContent value="receipts">
            <EditableFinanceReportTab 
                title="Receipts" 
                description="Lending income and deposits." 
                entries={financialData.allReceipts} 
                loading={false} 
                onEdit={(e) => !e.id.startsWith('fee-') && handleEditEntry(e)} 
                onDelete={(e) => !e.id.startsWith('fee-') && deleteFinanceEntry(firestore, e.id)} 
            />
          </TabsContent>
          
          <TabsContent value="payouts">
            <EditableFinanceReportTab 
                title="Payouts" 
                description="Master outflow record (Disbursements & Expenses)." 
                entries={financialData.allPayouts} 
                loading={false} 
                onEdit={handleEditEntry} 
                onDelete={(e) => deleteFinanceEntry(firestore, e.id)} 
            />
          </TabsContent>

          <TabsContent value="txfees">
            <EditableFinanceReportTab 
                title="Transaction Fees" 
                description="Consolidated record of all fees paid for money-out transactions." 
                entries={financialData.allTransactionFees} 
                loading={false} 
            />
          </TabsContent>
          
          <TabsContent value="investors">
            <InvestorsPortfolioTab />
          </TabsContent>
      </Tabs>

      <Dialog open={!!loanToEdit} onOpenChange={(isOpen) => !isOpen && setLoanToEdit(null)}>
          <DialogContent className="sm:max-w-5xl">
              {loanToEdit && (
                  <>
                    <DialogHeader><DialogTitle>Manage Loan #{loanToEdit.loanNumber}</DialogTitle></DialogHeader>
                    <ScrollArea className="max-h-[75vh]">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
                            <div className="space-y-4 md:col-span-1">
                                <Card>
                                    <CardHeader className="py-3"><CardTitle className="text-sm">Loan Summary</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex justify-between"><span>Customer:</span><span className="font-medium">{loanToEdit.customerName}</span></div>
                                        <div className="flex justify-between"><span>Staff Assigned:</span><span className="font-medium text-blue-600">{loanToEdit.assignedStaffName || "Unassigned"}</span></div>
                                        <div className="flex justify-between border-t pt-2"><span>Principal:</span><span className="font-medium">Ksh {loanToEdit.principalAmount.toLocaleString()}</span></div>
                                        <div className="flex justify-between"><span>Total Repayable:</span><span className="font-medium">Ksh {loanToEdit.totalRepayableAmount.toLocaleString()}</span></div>
                                        <div className="flex justify-between"><span>Total Paid:</span><span className="font-medium text-green-600">Ksh {loanToEdit.totalPaid.toLocaleString()}</span></div>
                                        <div className="flex justify-between border-t pt-2"><span>Remaining:</span><span className="font-bold text-destructive">Ksh {(loanToEdit.totalRepayableAmount - loanToEdit.totalPaid).toLocaleString()}</span></div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="py-3"><CardTitle className="text-sm">Collection Actions</CardTitle></CardHeader>
                                    <CardContent className="space-y-2">
                                        <Button 
                                            variant="outline" 
                                            className="w-full text-xs" 
                                            onClick={() => rolloverLoan(firestore, loanToEdit, new Date()).then(() => { toast({ title: 'Loan Rolled Over' }); setLoanToEdit(null); })}
                                        >
                                            Perform Rollover
                                        </Button>
                                        <Button 
                                            variant="secondary" 
                                            className="w-full text-xs"
                                            onClick={() => updateLoan(firestore, loanToEdit.id, { status: 'paid' }).then(() => { toast({ title: 'Marked as Paid' }); setLoanToEdit(null); })}
                                        >
                                            Mark as Fully Paid
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                            
                            <div className="md:col-span-2 space-y-6">
                                <Tabs defaultValue="payments">
                                    <TabsList className="grid grid-cols-3 w-full">
                                        <TabsTrigger value="payments">Payments</TabsTrigger>
                                        <TabsTrigger value="followups">Follow-ups</TabsTrigger>
                                        <TabsTrigger value="penalties">Penalties</TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="payments">
                                        <Form {...paymentForm}>
                                            <form onSubmit={paymentForm.handleSubmit(onRecordPayment)} className="space-y-4 mb-4">
                                                <div className="flex gap-2">
                                                    <FormField control={paymentForm.control} name="paymentAmount" render={({field}) => (
                                                      <Input type="number" placeholder="Amt" {...field} value={field.value ?? ''}/>
                                                    )} />
                                                    <FormField control={paymentForm.control} name="paymentDate" render={({field}) => (
                                                      <Input type="date" {...field} value={field.value ?? ''}/>
                                                    )} />
                                                    <Button type="submit" disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin h-4 w-4"/> : 'Pay'}</Button>
                                                </div>
                                            </form>
                                        </Form>
                                        <ScrollArea className="h-64 border rounded-md">
                                            <Table>
                                                <TableBody>
                                                    {loanToEdit.payments?.map((p, i) => (
                                                        <TableRow key={p.paymentId || i}>
                                                            <TableCell className="text-xs">{format(new Date(p.date.seconds * 1000), 'dd/MM/yy HH:mm')}</TableCell>
                                                            <TableCell className="text-right font-medium">Ksh {p.amount.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </TabsContent>

                                    <TabsContent value="followups">
                                        <Form {...noteForm}>
                                            <form onSubmit={noteForm.handleSubmit(onAddNoteSubmit)} className="space-y-3 mb-4">
                                                <FormField control={noteForm.control} name="content" render={({field}) => (
                                                    <FormItem>
                                                        <FormControl><Textarea placeholder="Add a follow-up note..." className="h-20" {...field} value={field.value ?? ''}/></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}/>
                                                <Button type="submit" className="w-full" size="sm" disabled={isAddingNote}>
                                                    {isAddingNote ? <Loader2 className="animate-spin h-4 w-4"/> : <Plus className="h-4 w-4 mr-2" />}
                                                    Add Interaction Note
                                                </Button>
                                            </form>
                                        </Form>
                                        <ScrollArea className="h-64 border rounded-md p-3">
                                            <div className="space-y-3">
                                                {(!loanToEdit.followUpNotes || loanToEdit.followUpNotes.length === 0) ? (
                                                    <p className="text-xs text-muted-foreground text-center py-8">No interaction history recorded.</p>
                                                ) : (
                                                    [...loanToEdit.followUpNotes].reverse().map((note) => (
                                                        <div key={note.noteId} className="bg-muted p-2 rounded border text-[11px]">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-bold flex items-center gap-1"><User className="h-2 w-2" /> {note.staffName}</span>
                                                                <span className="text-[9px] text-muted-foreground">{format(new Date(note.date.seconds * 1000), 'dd/MM/yy HH:mm')}</span>
                                                            </div>
                                                            <p className="italic">"{note.content}"</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>

                                    <TabsContent value="penalties">
                                        <Form {...penaltyForm}>
                                            <form onSubmit={penaltyForm.handleSubmit(onAddPenalty)} className="space-y-2 mb-4">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <FormField control={penaltyForm.control} name="penaltyAmount" render={({field}) => (
                                                      <Input type="number" placeholder="Amt" {...field} value={field.value ?? ''}/>
                                                    )} />
                                                    <FormField control={penaltyForm.control} name="penaltyDate" render={({field}) => (
                                                      <Input type="date" {...field} value={field.value ?? ''}/>
                                                    )} />
                                                </div>
                                                <FormField control={penaltyForm.control} name="penaltyDescription" render={({field}) => (
                                                  <Input placeholder="Reason" {...field} value={field.value ?? ''}/>
                                                )} />
                                                <Button type="submit" variant="destructive" className="w-full" disabled={isAddingPenalty}>
                                                    {isAddingPenalty ? <Loader2 className="animate-spin h-4 w-4"/> : 'Add Penalty'}
                                                </Button>
                                            </form>
                                        </Form>
                                        <ScrollArea className="h-64 border rounded-md">
                                            <Table>
                                                <TableBody>
                                                    {loanToEdit.penalties?.map((p, i) => (
                                                        <TableRow key={p.penaltyId || i}>
                                                            <TableCell>
                                                                <div className="text-[10px]">{format(new Date(p.date.seconds * 1000), 'dd/MM/yy')}</div>
                                                                <div className="font-medium text-xs">{p.description}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right text-destructive font-bold text-xs">Ksh {p.amount.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </ScrollArea>
                  </>
              )}
          </DialogContent>
      </Dialog>
    </div>
  );
}
