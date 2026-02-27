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
  Search, 
  HandCoins, 
  TrendingUp,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle
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
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
  addPenaltyToLoan, 
  updateFinanceEntry 
} from '@/lib/firestore';
import { Textarea } from '@/components/ui/textarea';
import { EditableFinanceReportTab } from './components/editable-finance-report-tab';
import { InvestorsPortfolioTab } from './components/investors-portfolio-tab';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { calculateAmortization } from '@/lib/utils';

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

    if (!loans || !financeEntries) return { allReceipts: [], allUpfrontFees: [], allPayouts: [], allExpenses: [] };

    loans.forEach(loan => {
        if (loan.status === 'application' || loan.status === 'rejected') return;
        const totalFees = (Number(loan.registrationFee) || 0) + (Number(loan.processingFee) || 0) + (Number(loan.carTrackInstallationFee) || 0) + (Number(loan.chargingCost) || 0);
        if (totalFees > 0) {
            upfront.push({ id: `fee-${loan.id}`, type: 'receipt', receiptCategory: 'upfront_fees', date: loan.disbursementDate, amount: totalFees, description: `Fees: Loan #${loan.loanNumber}`, loanId: loan.id });
        }
        (loan.payments || []).forEach(p => {
            receipts.push({ id: p.paymentId, type: 'receipt', receiptCategory: 'loan_repayment', date: p.date, amount: p.amount, description: `Pay: Loan #${loan.loanNumber}`, loanId: loan.id });
        });
    });

    financeEntries.forEach(entry => {
        const isLendingDupe = (entry.receiptCategory === 'loan_repayment' || entry.receiptCategory === 'upfront_fees');
        if (entry.type === 'receipt') {
            if (!isLendingDupe) receipts.push(entry);
        } else {
            payouts.push(entry);
            if (entry.type === 'expense') expenses.push(entry);
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
    return { totalReceipts: totalMoneyIn, totalPayouts: totalMoneyOut, cashAtHand: totalMoneyIn - totalMoneyOut };
  }, [financialData]);

  const filteredLoans = useMemo(() => {
    if(!loans) return [];
    return loans.filter(loan => {
        const statusMatch = loanBookStatusFilter === 'all' || loan.status === loanBookStatusFilter;
        const searchMatch = loanBookSearchTerm === '' || loan.loanNumber.toLowerCase().includes(loanBookSearchTerm.toLowerCase()) || loan.customerName.toLowerCase().includes(loanBookSearchTerm.toLowerCase());
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

  const addFinanceEntryType = addForm.watch('type');

  async function onAddSubmit(values: z.infer<typeof addFinanceEntrySchema>) {
    setIsSubmitting(true);
    try {
      const rawData = { ...values, date: new Date(values.date) };
      if (editingEntry) { 
        await updateFinanceEntry(firestore, editingEntry.id, rawData); 
      } else { 
        await addFinanceEntry(firestore, rawData as any); 
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
        await updateLoan(firestore, loanToEdit.id, { 
          ...values, 
          disbursementDate: new Date(values.disbursementDate), 
          instalmentAmount, 
          totalRepayableAmount: totalRepayableAmount + (loanToEdit.totalPenalties || 0) 
        });
        toast({ title: 'Loan Updated' }); 
        setIsEditingLoan(false);
    } catch (e: any) { 
      toast({ variant: 'destructive', title: 'Error', description: e.message }); 
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
      toast({ variant: 'destructive', title: 'Error', description: e.message }); 
    } finally { 
      setIsRollingOver(false); 
    }
  }

  if (userLoading || loansLoading || financeEntriesLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAuthorized) return <div className="flex h-screen w-full flex-col items-center justify-center"><h2>Access Restricted</h2></div>;

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button onClick={() => setEditingEntry(null)}><PlusCircle className="mr-2 h-4 w-4" /> Add Entry</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingEntry ? 'Edit Entry' : 'New Entry'}</DialogTitle></DialogHeader>
                    <Form {...addForm}>
                        <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                            <FormField control={addForm.control} name="type" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Type</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="receipt">Receipt</SelectItem>
                                      <SelectItem value="payout">Payout</SelectItem>
                                      <SelectItem value="expense">Expense</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                            )} />
                            {addFinanceEntryType === 'payout' && (
                                <FormField control={addForm.control} name="payoutCategory" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Payout Category</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                          <SelectItem value="loan_disbursement">Disbursement</SelectItem>
                                          <SelectItem value="investor_withdrawal">Withdrawal</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                )} />
                            )}
                            {addFinanceEntryType === 'receipt' && (
                                <FormField control={addForm.control} name="receiptCategory" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Receipt Category</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                          <SelectItem value="loan_repayment">Repayment</SelectItem>
                                          <SelectItem value="upfront_fees">Upfront Fees</SelectItem>
                                          <SelectItem value="investment">Investor Deposit</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                )} />
                            )}
                            <FormField control={addForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                            <FormField control={addForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field}/></FormControl></FormItem>)} />
                            <FormField control={addForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field}/></FormControl></FormItem>)} />
                            <Button type="submit" className="w-full" disabled={isSubmitting}>{editingEntry ? 'Update' : 'Record'}</Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card><CardHeader><CardTitle className="text-sm">Cash at Hand</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">Ksh {stats.cashAtHand.toLocaleString()}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Total In</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">Ksh {stats.totalReceipts.toLocaleString()}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Total Out</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">Ksh {stats.totalPayouts.toLocaleString()}</div></CardContent></Card>
        </div>
      </div>

      <Tabs defaultValue="receipts">
          <TabsList><TabsTrigger value="receipts">Receipts</TabsTrigger><TabsTrigger value="payouts">Payouts</TabsTrigger><TabsTrigger value="loanbook">Loan Book</TabsTrigger><TabsTrigger value="investors">Investors</TabsTrigger></TabsList>
          <TabsContent value="receipts"><EditableFinanceReportTab title="Receipts" description="Lending income and deposits." entries={financialData.allReceipts} loading={false} onEdit={(e) => !e.id.startsWith('fee-') && handleEditEntry(e)} onDelete={(e) => !e.id.startsWith('fee-') && deleteFinanceEntry(firestore, e.id)} /></TabsContent>
          <TabsContent value="payouts"><EditableFinanceReportTab title="Payouts" description="Master outflow record." entries={financialData.allPayouts} loading={false} onEdit={handleEditEntry} onDelete={(e) => deleteFinanceEntry(firestore, e.id)} /></TabsContent>
          <TabsContent value="loanbook">
              <Card>
                <CardHeader><CardTitle>Internal Ledger</CardTitle></CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh]"><Table className="min-w-[1200px]">
                        <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Loan No.</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
                        <TableBody>{filteredLoans.map(loan => (<TableRow key={loan.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setLoanToEdit(loan)}><TableCell>{loan.customerName}</TableCell><TableCell>{loan.loanNumber}</TableCell><TableCell className="text-right font-bold">{(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}</TableCell><TableCell className="text-center"><Badge>{loan.status}</Badge></TableCell></TableRow>))}</TableBody>
                    </Table></ScrollArea>
                </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="investors"><InvestorsPortfolioTab /></TabsContent>
      </Tabs>

      <Dialog open={!!loanToEdit} onOpenChange={(isOpen) => !isOpen && setLoanToEdit(null)}>
          <DialogContent className="sm:max-w-4xl">
              {loanToEdit && (
                  <>
                    <DialogHeader><DialogTitle>Manage Loan #{loanToEdit.loanNumber}</DialogTitle></DialogHeader>
                    <ScrollArea className="max-h-[70vh]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                            <Card><CardHeader><CardTitle className="text-sm">Summary</CardTitle></CardHeader><CardContent className="space-y-2"><div className="flex justify-between"><span>Remaining:</span><span className="font-bold text-destructive">Ksh {(loanToEdit.totalRepayableAmount - loanToEdit.totalPaid).toLocaleString()}</span></div></CardContent></Card>
                            <Tabs defaultValue="payments">
                                <TabsList><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="penalties">Penalties</TabsTrigger></TabsList>
                                <TabsContent value="payments">
                                    <Form {...paymentForm}><form onSubmit={paymentForm.handleSubmit(onRecordPayment)} className="flex gap-2 mb-4"><FormField control={paymentForm.control} name="paymentAmount" render={({field}) => (<Input type="number" {...field}/>)} /><Button type="submit">Pay</Button></form></Form>
                                    <Table><TableBody>{loanToEdit.payments?.map((p, i) => (<TableRow key={i}><TableCell>{format(new Date(p.date.seconds * 1000), 'dd/MM/yy')}</TableCell><TableCell className="text-right">Ksh {p.amount.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table>
                                </TabsContent>
                                <TabsContent value="penalties">
                                    <Form {...penaltyForm}><form onSubmit={penaltyForm.handleSubmit(onAddPenalty)} className="space-y-2 mb-4"><FormField control={penaltyForm.control} name="penaltyAmount" render={({field}) => (<Input type="number" {...field}/>)} /><FormField control={penaltyForm.control} name="penaltyDescription" render={({field}) => (<Input placeholder="Reason" {...field}/>)} /><Button type="submit" variant="destructive" className="w-full">Add Penalty</Button></form></Form>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                  </>
              )}
          </DialogContent>
      </Dialog>
    </div>
  );
}
