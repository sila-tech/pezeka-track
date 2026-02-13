'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns";
import { FileDown, Loader2, PlusCircle, PenSquare, Trash2 } from "lucide-react";
import { arrayUnion, arrayRemove, increment } from 'firebase/firestore';

import { useCollection, useFirestore } from '@/firebase';
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
import { addFinanceEntry, updateLoan, updateFinanceEntry, deleteFinanceEntry } from '@/lib/firestore';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToCsv } from '@/lib/excel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FinanceReportTab } from './components/finance-report-tab';
import { EditableFinanceReportTab } from './components/editable-finance-report-tab';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateAmortization } from '@/lib/utils';


const financeEntrySchema = z.object({
  type: z.enum(['expense', 'payout', 'receipt'], { required_error: 'Please select an entry type.' }),
  date: z.string().min(1, 'A date is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  transactionCost: z.coerce.number().optional(),
  description: z.string().optional(),
  loanId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'receipt' && !data.loanId) {
        ctx.addIssue({
            code: 'custom',
            message: 'Please select the loan this receipt is for.',
            path: ['loanId'],
        });
    }
});


const paymentSchema = z.object({
    paymentAmount: z.coerce.number().min(0.01, 'Payment amount must be greater than 0.'),
    paymentDate: z.string().min(1, 'Payment date is required.'),
    comments: z.string().optional(),
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
  status: z.enum(['due', 'paid', 'active']),
});


interface Payment {
  paymentId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
}

interface Loan {
  id: string;
  loanNumber: string;
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
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  payments?: Payment[];
  comments?: string;
  status: 'due' | 'paid' | 'active';
}

interface FinanceEntry {
  id: string;
  type: 'expense' | 'payout' | 'receipt' | 'unearned';
  date: { seconds: number; nanoseconds: number } | string;
  amount: number;
  description: string;
  transactionCost?: number;
  loanId?: string;
}


export default function FinancePage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingLoan, setIsEditingLoan] = useState(false);

  const [editEntryOpen, setEditEntryOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<FinanceEntry | null>(null);
  const [isUpdatingEntry, setIsUpdatingEntry] = useState(false);
  
  const [deleteEntryOpen, setDeleteEntryOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<FinanceEntry | null>(null);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

  const firestore = useFirestore();
  const { toast } = useToast();
  const { data: loans, loading: loansLoading } = useCollection<Loan>('loans');
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<FinanceEntry>('financeEntries');

  const addForm = useForm<z.infer<typeof financeEntrySchema>>({
    resolver: zodResolver(financeEntrySchema),
    defaultValues: {
        description: "",
        amount: undefined,
        date: format(new Date(), 'yyyy-MM-dd'),
        loanId: "",
        transactionCost: 0,
    }
  });

  const editForm = useForm<z.infer<typeof financeEntrySchema>>({
    resolver: zodResolver(financeEntrySchema)
  });

  const { watch: addFinanceEntryWatch } = addForm;
  const addFinanceEntryType = addFinanceEntryWatch('type');
  
  const { watch: editFinanceEntryWatch } = editForm;
  const editFinanceEntryType = editFinanceEntryWatch('type');


  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
        paymentAmount: undefined,
        comments: '',
    },
  });

  const editLoanForm = useForm<z.infer<typeof editLoanSchema>>({
    resolver: zodResolver(editLoanSchema),
  });

  const { watch } = editLoanForm;
  const principalAmount = watch('principalAmount');
  const interestRate = watch('interestRate');
  const numberOfInstalments = watch('numberOfInstalments');
  const paymentFrequency = watch('paymentFrequency');

  const recalculatedValues = useMemo(() => {
    if (!principalAmount || !interestRate || !numberOfInstalments || !paymentFrequency) {
        return { instalmentAmount: '0.00', totalRepayableAmount: '0.00' };
    }
    const { instalmentAmount, totalRepayableAmount } = calculateAmortization(principalAmount, interestRate, numberOfInstalments, paymentFrequency);
    return {
        instalmentAmount: instalmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalRepayableAmount: totalRepayableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
  }, [principalAmount, interestRate, numberOfInstalments, paymentFrequency]);

  async function onAddSubmit(values: z.infer<typeof financeEntrySchema>) {
    setIsSubmitting(true);
    try {
      const isReceipt = values.type === 'receipt' && values.loanId;
      const loanToUpdate = isReceipt ? loans?.find(l => l.id === values.loanId) : undefined;
       
      if (isReceipt && !loanToUpdate) throw new Error("Selected loan not found.");

      const description = isReceipt && !values.description
        ? `Payment for Loan #${loanToUpdate!.loanNumber} by ${loanToUpdate!.customerName}`
        : values.type === 'payout' && values.loanId && !values.description
        ? `Disbursement for Loan #${loans?.find(l => l.id === values.loanId)?.loanNumber}`
        : values.description;
      
      const entryData = {
          ...values,
          date: new Date(values.date),
          description,
      };

      const docRef = await addFinanceEntry(firestore, entryData);

      if (isReceipt && loanToUpdate) {
        const currentTotalPaid = loanToUpdate.totalPaid || 0;
        const newTotalPaid = currentTotalPaid + values.amount;
        
        const newPayment: Payment = {
            paymentId: docRef.id,
            amount: values.amount,
            date: new Date(values.date),
        };

        const newStatus = newTotalPaid >= loanToUpdate.totalRepayableAmount ? 'paid' : loanToUpdate.status;

        await updateLoan(firestore, loanToUpdate.id, {
            totalPaid: newTotalPaid,
            payments: arrayUnion(newPayment),
            status: newStatus,
        });
      }
      
      toast({
          title: 'Finance Entry Added',
          description: `A new ${values.type} entry of Ksh ${values.amount.toLocaleString()} has been added.`,
      });

      addForm.reset();
      setOpen(false);
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: error.message || "Could not add finance entry. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleExport = () => {
    if (loans) {
      const dataForExport = loans.map(loan => {
        const takeHome = loan.principalAmount - (loan.registrationFee || 0) - (loan.processingFee || 0) - (loan.carTrackInstallationFee || 0) - (loan.chargingCost || 0);
        const balance = loan.totalRepayableAmount - loan.totalPaid;
        return {
          'Client Name': loan.customerName,
          'Client Phone Number': loan.customerPhone,
          'Loan No.': loan.loanNumber,
          'Date': format(new Date(loan.disbursementDate.seconds * 1000), 'PPP'),
          'Principal Amount': loan.principalAmount,
          'Interest Rate (%)': loan.interestRate || 0,
          'Registration Fee': loan.registrationFee,
          'Processing Fee': loan.processingFee,
          'Take Home': takeHome,
          'Car Track Installation': loan.carTrackInstallationFee,
          'Charging Cost': loan.chargingCost,
          'No. of Instalments': loan.numberOfInstalments,
          'Instalment Amount': loan.instalmentAmount,
          'Amount to Pay': loan.totalRepayableAmount,
          'Paid Amount': loan.totalPaid,
          'Balance': balance,
          'Status': loan.status,
          'Comments': loan.comments,
        };
      });
      exportToCsv(dataForExport, 'loan_book');
    }
  };
  
  const handleEditLoanClick = (loan: Loan) => {
    setLoanToEdit(loan);
    paymentForm.reset({
        paymentAmount: undefined,
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        comments: loan.comments || '',
    });
    editLoanForm.reset({
        disbursementDate: format(new Date(loan.disbursementDate.seconds * 1000), 'yyyy-MM-dd'),
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate || 0,
        registrationFee: loan.registrationFee || 0,
        processingFee: loan.processingFee || 0,
        carTrackInstallationFee: loan.carTrackInstallationFee || 0,
        chargingCost: loan.chargingCost || 0,
        numberOfInstalments: loan.numberOfInstalments,
        paymentFrequency: loan.paymentFrequency,
        status: loan.status,
    });
  }

  async function onPaymentSubmit(values: z.infer<typeof paymentSchema>) {
    if (!loanToEdit) return;
    setIsUpdating(true);
    try {
        const description = `Payment for Loan #${loanToEdit.loanNumber} by ${loanToEdit.customerName}`;
        const receiptData = { 
            type: 'receipt' as const,
            date: new Date(values.paymentDate),
            amount: values.paymentAmount,
            description: description,
            loanId: loanToEdit.id
        };

        const docRef = await addFinanceEntry(firestore, receiptData);

        const currentTotalPaid = loanToEdit.totalPaid || 0;
        const newTotalPaid = currentTotalPaid + values.paymentAmount;
        
        const newPayment: Payment = {
            paymentId: docRef.id,
            amount: values.paymentAmount,
            date: new Date(values.paymentDate),
        };

        const newStatus = newTotalPaid >= loanToEdit.totalRepayableAmount ? 'paid' : loanToEdit.status;

        await updateLoan(firestore, loanToEdit.id, {
            totalPaid: newTotalPaid,
            payments: arrayUnion(newPayment),
            comments: values.comments,
            status: newStatus,
        });

        toast({
            title: "Payment Recorded",
            description: `Payment of Ksh ${values.paymentAmount.toLocaleString()} for loan #${loanToEdit.loanNumber} has been recorded.`,
        });
        setLoanToEdit(null);
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Update failed",
            description: "Could not record payment. Please try again.",
        });
    } finally {
        setIsUpdating(false);
    }
  }

  async function onLoanEditSubmit(values: z.infer<typeof editLoanSchema>) {
    if (!loanToEdit) return;
    setIsEditingLoan(true);

    const { instalmentAmount, totalRepayableAmount } = calculateAmortization(
        values.principalAmount,
        values.interestRate ?? 0,
        values.numberOfInstalments,
        values.paymentFrequency
    );
    
    const updateData = {
        ...values,
        disbursementDate: new Date(values.disbursementDate),
        instalmentAmount,
        totalRepayableAmount,
    };

    try {
        await updateLoan(firestore, loanToEdit.id, updateData);
        toast({
            title: "Loan Updated",
            description: `Loan #${loanToEdit.loanNumber} has been updated successfully.`,
        });
        setLoanToEdit(null); // Close dialog on success
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Update failed",
            description: "Could not update loan details. Please try again.",
        });
    } finally {
        setIsEditingLoan(false);
    }
}

  const handleEditEntryClick = (entry: FinanceEntry) => {
    setEntryToEdit(entry);
    editForm.reset({
        ...entry,
        date: format(typeof entry.date === 'string' ? new Date(entry.date) : new Date(entry.date.seconds * 1000), 'yyyy-MM-dd'),
    });
    setEditEntryOpen(true);
  };

  async function onEditEntrySubmit(values: z.infer<typeof financeEntrySchema>) {
    if (!entryToEdit) return;
    setIsUpdatingEntry(true);
    try {
        const updateData = {
            ...values,
            date: new Date(values.date),
        };
        await updateFinanceEntry(firestore, entryToEdit.id, updateData);
        toast({
            title: 'Entry Updated',
            description: 'The finance entry has been updated successfully.'
        });
        setEditEntryOpen(false);
        setEntryToEdit(null);
    } catch(error: any) {
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message || "Could not update the entry. Please try again.",
        });
    } finally {
        setIsUpdatingEntry(false);
    }
  }

  const handleDeleteEntryClick = (entry: FinanceEntry) => {
    setEntryToDelete(entry);
    setDeleteEntryOpen(true);
  };
  
  async function confirmDeleteEntry() {
    if (!entryToDelete) return;
    setIsDeletingEntry(true);

    try {
        if(entryToDelete.type === 'receipt' && entryToDelete.loanId) {
            const loan = loans?.find(l => l.id === entryToDelete.loanId);
            if(loan) {
                const paymentToRemove = loan.payments?.find(p => p.paymentId === entryToDelete.id);
                
                if (paymentToRemove) {
                    await updateLoan(firestore, loan.id, {
                        totalPaid: increment(-entryToDelete.amount),
                        payments: arrayRemove(paymentToRemove)
                    });
                }
            }
        }
        await deleteFinanceEntry(firestore, entryToDelete.id);

        toast({
            title: 'Entry Deleted',
            description: 'The finance entry has been deleted successfully.'
        });

    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Delete Failed",
            description: error.message || "Could not delete the entry. Please try again.",
        });
    } finally {
        setDeleteEntryOpen(false);
        setEntryToDelete(null);
        setIsDeletingEntry(false);
    }
  }


  const receipts = useMemo(() => financeEntries?.filter(e => e.type === 'receipt') ?? null, [financeEntries]);
  const payouts = useMemo(() => financeEntries?.filter(e => e.type === 'payout') ?? null, [financeEntries]);
  const expenses = useMemo(() => financeEntries?.filter(e => e.type === 'expense') ?? null, [financeEntries]);

  const unearnedIncomeEntries = useMemo(() => {
    if (!loans) return null;
    return loans.map(loan => ({
        id: loan.id,
        type: 'unearned' as const,
        date: loan.disbursementDate,
        amount: (loan.registrationFee || 0) + (loan.processingFee || 0),
        description: `Fees from Loan #${loan.loanNumber}`
    })).filter(entry => entry.amount > 0);
  }, [loans]);

  const earnedInterestEntries = useMemo(() => {
    if (!loans) return null;
    
    return loans.flatMap(loan => {
        if (!loan.payments || loan.payments.length === 0 || !loan.interestRate || loan.interestRate === 0) {
            return [];
        }

        const { totalRepayableAmount } = calculateAmortization(
            loan.principalAmount,
            loan.interestRate,
            loan.numberOfInstalments,
            loan.paymentFrequency
        );

        if (totalRepayableAmount <= loan.principalAmount) {
            return [];
        }

        const totalInterest = totalRepayableAmount - loan.principalAmount;
        const interestRatio = loan.principalAmount > 0 ? totalInterest / loan.principalAmount : 0;

        return (loan.payments || []).map((payment) => {
            const interestPaid = payment.amount * interestRatio;
            
            if (interestPaid > 0) {
                return {
                    id: payment.paymentId,
                    type: 'receipt' as const,
                    date: payment.date as { seconds: number; nanoseconds: number },
                    amount: interestPaid,
                    description: `Interest from payment on Loan #${loan.loanNumber}`
                };
            }
            return null;
        }).filter((entry): entry is FinanceEntry => entry !== null);
    });
  }, [loans]);


  const earnedIncomeEntries = useMemo(() => {
    if (!unearnedIncomeEntries || !earnedInterestEntries) return null;
    return [...unearnedIncomeEntries, ...earnedInterestEntries];
  }, [unearnedIncomeEntries, earnedInterestEntries]);

  const allLoanPayments = useMemo(() => {
    if (!loans) return null;
    return loans.flatMap(loan => 
        (loan.payments || []).map(payment => ({
            id: payment.paymentId,
            type: 'receipt' as const,
            date: payment.date as { seconds: number; nanoseconds: number },
            amount: payment.amount,
            description: `Payment from ${loan.customerName} (Loan #${loan.loanNumber})`
        }))
    );
  }, [loans]);


  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Entry
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a New Finance Entry</DialogTitle>
                    <DialogDescription>
                        Fill in the details below to record a financial transaction.
                    </DialogDescription>
                </DialogHeader>
                <Form {...addForm}>
                    <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                        <FormField
                            control={addForm.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Entry Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an entry type" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="receipt">Receipt</SelectItem>
                                    <SelectItem value="payout">Payout</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        {(addFinanceEntryType === 'receipt' || addFinanceEntryType === 'payout') && (
                            <FormField
                                control={addForm.control}
                                name="loanId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>For Loan</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loansLoading}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={loansLoading ? "Loading loans..." : "Select a loan"} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {loans && loans.filter(l => l.status !== 'paid').map(loan => (
                                                    <SelectItem key={loan.id} value={loan.id}>
                                                        {`#${loan.loanNumber} - ${loan.customerName} (Balance: ${(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()})`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <FormField
                            control={addForm.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={addForm.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Amount (Ksh)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         {(addFinanceEntryType === 'payout' || addFinanceEntryType === 'expense') && (
                            <FormField
                                control={addForm.control}
                                name="transactionCost"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Transaction Cost (Optional)</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <FormField
                            control={addForm.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Describe the transaction..." {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="ghost">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Entry
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>
      <Tabs defaultValue="receipts">
          <ScrollArea className="w-full whitespace-nowrap pb-4">
              <TabsList className="inline-flex w-max">
                  <TabsTrigger value="receipts">Receipts</TabsTrigger>
                  <TabsTrigger value="payouts">Payouts</TabsTrigger>
                  <TabsTrigger value="expenses">Expenses</TabsTrigger>
                  <TabsTrigger value="unearned">Unearned Income</TabsTrigger>
                  <TabsTrigger value="earned_interest">Earned Interest</TabsTrigger>
                  <TabsTrigger value="earned_income">Earned Income</TabsTrigger>
                  <TabsTrigger value="payments">All Payments</TabsTrigger>
                  <TabsTrigger value="loanbook">Loan Book</TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <TabsContent value="receipts">
              <EditableFinanceReportTab 
                title="Receipts"
                description="Amount received from customers."
                entries={receipts}
                loading={financeEntriesLoading}
                onEdit={handleEditEntryClick}
                onDelete={handleDeleteEntryClick}
              />
          </TabsContent>
          <TabsContent value="payouts">
              <EditableFinanceReportTab 
                title="Payouts"
                description="Amount disbursed to customers, including costs."
                entries={payouts}
                loading={financeEntriesLoading}
                onEdit={handleEditEntryClick}
                onDelete={handleDeleteEntryClick}
              />
          </TabsContent>
          <TabsContent value="expenses">
               <EditableFinanceReportTab 
                title="Expenses"
                description="Money spent on facilitation and other costs."
                entries={expenses}
                loading={financeEntriesLoading}
                onEdit={handleEditEntryClick}
                onDelete={handleDeleteEntryClick}
              />
          </TabsContent>
          <TabsContent value="unearned">
            <FinanceReportTab
              title="Unearned Income"
              description="Total income from upfront fees (registration and processing fees)."
              entries={unearnedIncomeEntries}
              loading={loansLoading}
            />
          </TabsContent>
          <TabsContent value="earned_interest">
            <FinanceReportTab
              title="Earned Interest"
              description="Interest portion of loan payments that have been received."
              entries={earnedInterestEntries}
              loading={loansLoading}
            />
          </TabsContent>
          <TabsContent value="earned_income">
            <FinanceReportTab
              title="Earned Income"
              description="Total income from upfront fees and interest payments received."
              entries={earnedIncomeEntries}
              loading={loansLoading}
            />
          </TabsContent>
           <TabsContent value="payments">
            <FinanceReportTab
              title="All Loan Payments"
              description="A consolidated list of all individual payments made against loans."
              entries={allLoanPayments}
              loading={loansLoading}
            />
          </TabsContent>
          <TabsContent value="loanbook">
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Loan Book</CardTitle>
                      <CardDescription>A complete record of all loans.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleExport} disabled={!loans || loans.length === 0}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Download CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                      {loansLoading && (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {!loansLoading && (!loans || loans.length === 0) && (
                        <Alert>
                            <AlertTitle>No Loans Found</AlertTitle>
                            <AlertDescription>There are no loans in the system yet. Add a loan to see it here.</AlertDescription>
                        </Alert>
                      )}
                      {!loansLoading && loans && loans.length > 0 && (
                        <div className="relative max-h-[60vh] overflow-y-auto">
                          <Table>
                              <TableHeader className="sticky top-0 bg-card">
                                  <TableRow>
                                      <TableHead>Client Name</TableHead>
                                      <TableHead>Phone</TableHead>
                                      <TableHead>Loan No.</TableHead>
                                      <TableHead>Date</TableHead>
                                      <TableHead className="text-right">Principal</TableHead>
                                      <TableHead className="text-right">Interest Rate (%)</TableHead>
                                      <TableHead className="text-right">Reg. Fee</TableHead>
                                      <TableHead className="text-right">Proc. Fee</TableHead>
                                      <TableHead className="text-right">Take Home</TableHead>
                                      <TableHead className="text-right">Car Track</TableHead>
                                      <TableHead className="text-right">Charging Cost</TableHead>
                                      <TableHead className="text-center">Instalments</TableHead>
                                      <TableHead className="text-right">Instalment Amt</TableHead>
                                      <TableHead className="text-right">To Pay</TableHead>
                                      <TableHead className="text-right">Paid</TableHead>
                                      <TableHead className="text-right">Balance</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {loans.map((loan) => {
                                      const takeHome = loan.principalAmount - (loan.registrationFee || 0) - (loan.processingFee || 0) - (loan.carTrackInstallationFee || 0) - (loan.chargingCost || 0);
                                      const balance = loan.totalRepayableAmount - loan.totalPaid;
                                      return (
                                          <TableRow key={loan.id}>
                                              <TableCell className="font-medium">{loan.customerName}</TableCell>
                                              <TableCell>{loan.customerPhone}</TableCell>
                                              <TableCell>{loan.loanNumber}</TableCell>
                                              <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'dd/MM/yyyy')}</TableCell>
                                              <TableCell className="text-right">{loan.principalAmount.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.interestRate || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.registrationFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.processingFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-medium">{takeHome.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.carTrackInstallationFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.chargingCost || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-center">{loan.numberOfInstalments}</TableCell>
                                              <TableCell className="text-right">{loan.instalmentAmount.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{loan.totalRepayableAmount.toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-green-600">{loan.totalPaid.toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-bold">{balance.toLocaleString()}</TableCell>
                                              <TableCell>
                                                  <Badge variant={loan.status === 'paid' ? 'default' : loan.status === 'due' ? 'destructive' : 'secondary'}>
                                                      {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                                  </Badge>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                  <Button variant="ghost" size="sm" onClick={() => handleEditLoanClick(loan)}>
                                                      <PenSquare className="h-4 w-4" />
                                                  </Button>
                                              </TableCell>
                                          </TableRow>
                                      )
                                  })}
                              </TableBody>
                          </Table>
                        </div>
                      )}
                  </CardContent>
              </Card>
          </TabsContent>
      </Tabs>

      {/* Edit Finance Entry Dialog */}
      <Dialog open={editEntryOpen} onOpenChange={setEditEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Finance Entry</DialogTitle>
            <DialogDescription>Update the details of this transaction.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditEntrySubmit)} className="space-y-4">
                  <FormField control={editForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>Entry Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="receipt">Receipt</SelectItem><SelectItem value="payout">Payout</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select><FormMessage/></FormItem>)} />
                  {(editFinanceEntryType === 'receipt' || editFinanceEntryType === 'payout') && (
                      <FormField control={editForm.control} name="loanId" render={({ field }) => (<FormItem><FormLabel>For Loan</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={loansLoading || editFinanceEntryType === 'receipt'}><FormControl><SelectTrigger><SelectValue placeholder={loansLoading ? "Loading loans..." : "Select a loan"} /></SelectTrigger></FormControl><SelectContent>{loans?.filter(l => l.status !== 'paid').map(loan => (<SelectItem key={loan.id} value={loan.id}>{`#${loan.loanNumber} - ${loan.customerName}`}</SelectItem>))}</SelectContent></Select><FormMessage/></FormItem>)} />
                  )}
                  <FormField control={editForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field}/></FormControl><FormMessage/></FormItem>)} />
                  <FormField control={editForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} disabled={editFinanceEntryType === 'receipt'} /></FormControl><FormMessage/></FormItem>)} />
                  {(editFinanceEntryType === 'payout' || editFinanceEntryType === 'expense') && (
                      <FormField control={editForm.control} name="transactionCost" render={({ field }) => (<FormItem><FormLabel>Transaction Cost</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)} />
                  )}
                  <FormField control={editForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field}/></FormControl><FormMessage/></FormItem>)} />
                  <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                      <Button type="submit" disabled={isUpdatingEntry}>{isUpdatingEntry && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Changes</Button>
                  </DialogFooter>
              </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Finance Entry Confirmation */}
      <AlertDialog open={deleteEntryOpen} onOpenChange={setDeleteEntryOpen}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the entry.
                    {entryToDelete?.type === 'receipt' && entryToDelete.loanId && " The associated loan's balance will be automatically adjusted."}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setEntryToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteEntry} disabled={isDeletingEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeletingEntry && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!loanToEdit} onOpenChange={(isOpen) => !isOpen && setLoanToEdit(null)}>
        <DialogContent className="sm:max-w-4xl">
            {loanToEdit && (
                <>
                    <DialogHeader>
                        <DialogTitle>Manage Loan #{loanToEdit.loanNumber}</DialogTitle>
                        <DialogDescription>
                        For {loanToEdit.customerName}. Current balance: Ksh {(loanToEdit.totalRepayableAmount - loanToEdit.totalPaid).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="payment" className="mt-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="payment">Record Payment & Comments</TabsTrigger>
                            <TabsTrigger value="edit">Edit Loan Details</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="payment">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle>Record a New Payment</CardTitle></CardHeader>
                                        <CardContent>
                                            <Form {...paymentForm}>
                                                <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4" id="payment-form">
                                                    <FormField control={paymentForm.control} name="paymentAmount" render={({ field }) => (<FormItem><FormLabel>Payment Amount (Ksh)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={paymentForm.control} name="paymentDate" render={({ field }) => (<FormItem><FormLabel>Payment Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={paymentForm.control} name="comments" render={({ field }) => (<FormItem><FormLabel>Loan Comments</FormLabel><FormControl><Textarea placeholder="Add any comments about the loan (e.g., rollover request)..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                                                </form>
                                            </Form>
                                        </CardContent>
                                    </Card>
                                </div>
                                <div>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Payment History</CardTitle>
                                            <CardDescription>All payments recorded for this loan.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ScrollArea className="h-72">
                                                {(!loanToEdit.payments || loanToEdit.payments.length === 0) ? (
                                                <Alert>
                                                    <AlertTitle>No Payments Yet</AlertTitle>
                                                    <AlertDescription>No payments have been recorded for this loan.</AlertDescription>
                                                </Alert>
                                                ) : (
                                                <Table>
                                                    <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                    </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                    {loanToEdit.payments.sort((a,b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()).map((payment) => (
                                                        <TableRow key={payment.paymentId}>
                                                          <TableCell>{format(new Date((payment.date as any).seconds * 1000), 'PPP')}</TableCell>
                                                          <TableCell className="text-right">{payment.amount.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    </TableBody>
                                                </Table>
                                                )}
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                            <DialogFooter className="mt-4">
                                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                <Button type="submit" form="payment-form" disabled={isUpdating}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Payment</Button>
                            </DialogFooter>
                        </TabsContent>

                        <TabsContent value="edit">
                            <Form {...editLoanForm}>
                                <form onSubmit={editLoanForm.handleSubmit(onLoanEditSubmit)} id="edit-loan-form" className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto p-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={editLoanForm.control} name="disbursementDate" render={({ field }) => (<FormItem><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={editLoanForm.control} name="principalAmount" render={({ field }) => (<FormItem><FormLabel>Principal Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={editLoanForm.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Monthly Interest Rate (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={editLoanForm.control} name="registrationFee" render={({ field }) => (<FormItem><FormLabel>Registration Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={editLoanForm.control} name="processingFee" render={({ field }) => (<FormItem><FormLabel>Processing Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={editLoanForm.control} name="carTrackInstallationFee" render={({ field }) => (<FormItem><FormLabel>Car Track Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={editLoanForm.control} name="chargingCost" render={({ field }) => (<FormItem><FormLabel>Charging Cost</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={editLoanForm.control} name="numberOfInstalments" render={({ field }) => (<FormItem><FormLabel>No. of Instalments</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={editLoanForm.control} name="paymentFrequency" render={({ field }) => (<FormItem><FormLabel>Payment Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                        <FormField control={editLoanForm.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="due">Due</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select><FormMessage/></FormItem>)} />
                                    </div>
                                    <Card className="mt-4">
                                        <CardHeader><CardTitle className="text-lg">Recalculated Totals</CardTitle></CardHeader>
                                        <CardContent>
                                             <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">New Instalment Amount:</span>
                                                <span className="font-bold text-lg">Ksh {recalculatedValues.instalmentAmount}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-muted-foreground">New Total Repayable:</span>
                                                <span className="font-bold text-lg">Ksh {recalculatedValues.totalRepayableAmount}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </form>
                            </Form>
                            <DialogFooter className="mt-4">
                                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                <Button type="submit" form="edit-loan-form" disabled={isEditingLoan}>{isEditingLoan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
                            </DialogFooter>
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
