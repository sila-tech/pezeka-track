'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns";
import { FileDown, Loader2, PlusCircle, PenSquare, Trash2, Search } from "lucide-react";
import { arrayUnion, arrayRemove, increment } from 'firebase/firestore';

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
import { addFinanceEntry, updateLoan, updateFinanceEntry, deleteFinanceEntry, rolloverLoan, deleteLoan, addPenaltyToLoan } from '@/lib/firestore';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { exportToCsv } from '@/lib/excel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FinanceReportTab } from './components/finance-report-tab';
import { EditableFinanceReportTab } from './components/editable-finance-report-tab';
import { InvestorsPortfolioTab } from './components/investors-portfolio-tab';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateAmortization, calculateInterestForOneInstalment } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const addFinanceEntrySchema = z.object({
  type: z.enum(['receipt', 'payout'], { required_error: 'Please select an entry type.' }),
  payoutReason: z.enum(['loan_disbursement', 'expense']).optional(),
  date: z.string().min(1, 'A date is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  transactionCost: z.coerce.number().optional(),
  description: z.string().optional(),
  loanId: z.string().optional(),
  expenseCategory: z.enum(['facilitation_commission', 'office_purchase', 'other']).optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'receipt' && !data.loanId) {
        ctx.addIssue({ code: 'custom', message: 'Please select the loan this receipt is for.', path: ['loanId'] });
    }
    if (data.type === 'payout') {
        if (!data.payoutReason) {
            ctx.addIssue({ code: 'custom', message: 'Please select a reason for the payout.', path: ['payoutReason'] });
        } else if (data.payoutReason === 'loan_disbursement' && !data.loanId) {
            ctx.addIssue({ code: 'custom', message: 'Please select the loan being disbursed.', path: ['loanId'] });
        } else if (data.payoutReason === 'expense' && !data.expenseCategory) {
            ctx.addIssue({ code: 'custom', message: 'Please select an expense category.', path: ['expenseCategory'] });
        }
    }
});

const editFinanceEntrySchema = z.object({
  type: z.enum(['expense', 'payout', 'receipt']),
  date: z.string().min(1, 'A date is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  transactionCost: z.coerce.number().optional(),
  description: z.string().optional(),
  loanId: z.string().optional(),
  expenseCategory: z.enum(['facilitation_commission', 'office_purchase', 'other']).optional(),
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
  status: z.enum(['due', 'paid', 'active', 'rollover', 'overdue', 'application']),
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
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
}

interface FinanceEntry {
  id: string;
  type: 'expense' | 'payout' | 'receipt' | 'unearned';
  date: any;
  amount: number;
  description: string;
  transactionCost?: number;
  loanId?: string;
  expenseCategory?: string;
}

export default function FinancePage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingPenalty, setIsAddingPenalty] = useState(false);
  const [isEditingLoan, setIsEditingLoan] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);
  const [editEntryOpen, setEditEntryOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<FinanceEntry | null>(null);
  const [isUpdatingEntry, setIsUpdatingEntry] = useState(false);
  const [deleteEntryOpen, setDeleteEntryOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<FinanceEntry | null>(null);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);
  const [deleteLoanOpen, setDeleteLoanOpen] = useState(false);
  const [isDeletingLoan, setIsDeletingLoan] = useState(false);
  const [loanBookSearchTerm, setLoanBookSearchTerm] = useState('');
  const [loanBookStatusFilter, setLoanBookStatusFilter] = useState('all');

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isSuperAdmin = user?.email === 'simon@pezeka.com';
  const isFinance = user?.role === 'finance' || user?.email?.endsWith('@finance.pezeka.com');
  const canPerformActions = isSuperAdmin || isFinance;

  // Layout allows staff, but we restrict data access here
  const isAuthorized = isSuperAdmin || isFinance || user?.role === 'staff';

  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<FinanceEntry>(isAuthorized ? 'financeEntries' : null);
  
  const isLoading = userLoading || loansLoading || financeEntriesLoading;

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
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd'), transactionCost: 0 }
  });

  const editForm = useForm<z.infer<typeof editFinanceEntrySchema>>({ resolver: zodResolver(editFinanceEntrySchema) });
  const paymentForm = useForm<z.infer<typeof paymentSchema>>({ resolver: zodResolver(paymentSchema) });
  const penaltyForm = useForm<z.infer<typeof penaltySchema>>({ resolver: zodResolver(penaltySchema) });
  const editLoanForm = useForm<z.infer<typeof editLoanSchema>>({ resolver: zodResolver(editLoanSchema) });
  const rolloverForm = useForm<z.infer<typeof rolloverSchema>>({ resolver: zodResolver(rolloverSchema) });

  const { watch: addFinanceEntryWatch } = addForm;
  const addFinanceEntryType = addFinanceEntryWatch('type');
  const addPayoutReason = addFinanceEntryWatch('payoutReason');

  async function onAddSubmit(values: z.infer<typeof addFinanceEntrySchema>) {
    setIsSubmitting(true);
    try {
      const entryType = values.type === 'payout' ? (values.payoutReason === 'loan_disbursement' ? 'payout' : 'expense') : 'receipt';
      const rawEntryData = { ...values, type: entryType, date: new Date(values.date) };
      delete (rawEntryData as any).payoutReason;
      const docRef = await addFinanceEntry(firestore, rawEntryData as any);
      if (values.type === 'receipt' && values.loanId) {
        const loan = loans?.find(l => l.id === values.loanId);
        if (loan) {
            await updateLoan(firestore, loan.id, {
                totalPaid: increment(values.amount),
                payments: arrayUnion({ paymentId: docRef.id, amount: values.amount, date: new Date(values.date) })
            });
        }
      }
      toast({ title: 'Success', description: 'Finance entry recorded.' });
      addForm.reset();
      setOpen(false);
    } catch (e: any) {
       toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  const receipts = useMemo(() => financeEntries?.filter(e => e.type === 'receipt') ?? null, [financeEntries]);
  const payouts = useMemo(() => financeEntries?.filter(e => e.type === 'payout') ?? null, [financeEntries]);
  const expenses = useMemo(() => financeEntries?.filter(e => e.type === 'expense') ?? null, [financeEntries]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        {canPerformActions && (
          <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Entry</Button></DialogTrigger>
              <DialogContent>
                  <DialogHeader><DialogTitle>New Finance Entry</DialogTitle></DialogHeader>
                  <Form {...addForm}>
                      <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                          <FormField control={addForm.control} name="type" render={({ field }) => (
                              <FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="receipt">Receipt</SelectItem><SelectItem value="payout">Payout</SelectItem></SelectContent></Select></FormItem>
                          )} />
                          {addFinanceEntryType === 'payout' && (
                              <FormField control={addForm.control} name="payoutReason" render={({ field }) => (
                                  <FormItem><FormLabel>Reason</FormLabel><RadioGroup onValueChange={field.onChange}><FormItem className="flex items-center space-x-2"><RadioGroupItem value="loan_disbursement"/> <FormLabel>Loan Disbursement</FormLabel></FormItem><FormItem className="flex items-center space-x-2"><RadioGroupItem value="expense"/> <FormLabel>Expense</FormLabel></FormItem></RadioGroup></FormItem>
                              )} />
                          )}
                          <FormField control={addForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                          <FormField control={addForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field}/></FormControl></FormItem>)} />
                          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Record Entry</Button>
                      </form>
                  </Form>
              </DialogContent>
          </Dialog>
        )}
      </div>
      <Tabs defaultValue="receipts">
          <ScrollArea className="w-full whitespace-nowrap pb-4">
              <TabsList className="inline-flex w-max">
                  <TabsTrigger value="receipts">Receipts</TabsTrigger>
                  <TabsTrigger value="payouts">Payouts</TabsTrigger>
                  <TabsTrigger value="expenses">Expenses</TabsTrigger>
                  <TabsTrigger value="loanbook">Loan Book</TabsTrigger>
                  {canPerformActions && <TabsTrigger value="investors">Investors</TabsTrigger>}
              </TabsList>
              <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <TabsContent value="receipts">
              <EditableFinanceReportTab title="Receipts" description="Incoming payments." entries={receipts} loading={isLoading} onEdit={canPerformActions ? (e) => {} : undefined} onDelete={canPerformActions ? (e) => {} : undefined} />
          </TabsContent>
          <TabsContent value="payouts">
              <EditableFinanceReportTab title="Payouts" description="Outgoing disbursements." entries={payouts} loading={isLoading} />
          </TabsContent>
          <TabsContent value="expenses">
               <EditableFinanceReportTab title="Expenses" description="Facilitation costs." entries={expenses} loading={isLoading} />
          </TabsContent>
          <TabsContent value="loanbook">
              <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Loan Book</CardTitle>
                        <Input placeholder="Search..." value={loanBookSearchTerm} onChange={(e) => setLoanBookSearchTerm(e.target.value)} className="w-[300px]" />
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh]">
                        <Table>
                            <TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Principal</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {filteredLoans.map(loan => (
                                    <TableRow key={loan.id} className="cursor-pointer" onClick={() => setLoanToEdit(loan)}>
                                        <TableCell>{loan.loanNumber}</TableCell>
                                        <TableCell>{loan.customerName}</TableCell>
                                        <TableCell className="text-right">{loan.principalAmount.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}</TableCell>
                                        <TableCell><Badge>{loan.status}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
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
    </div>
  );
}
