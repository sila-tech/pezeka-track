'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns";
import { FileDown, Loader2, PlusCircle, PenSquare } from "lucide-react";
import { arrayUnion } from 'firebase/firestore';

import { useCollection, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { addFinanceEntry, updateLoan } from '@/lib/firestore';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToCsv } from '@/lib/excel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FinanceReportTab } from './components/finance-report-tab';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';


const financeEntrySchema = z.object({
  type: z.enum(['expense', 'payout', 'receipt'], { required_error: 'Please select an entry type.' }),
  date: z.string().min(1, 'A date is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  description: z.string().optional(),
});

const paymentSchema = z.object({
    paymentAmount: z.coerce.number().min(0.01, 'Payment amount must be greater than 0.'),
    paymentDate: z.string().min(1, 'Payment date is required.'),
    comments: z.string().optional(),
});

const editLoanSchema = z.object({
  disbursementDate: z.string().min(1, 'Disbursement date is required.'),
  principalAmount: z.coerce.number().min(1, 'Principal amount is required.'),
  registrationFee: z.coerce.number().optional(),
  processingFee: z.coerce.number().optional(),
  carTrackInstallationFee: z.coerce.number().optional(),
  chargingCost: z.coerce.number().optional(),
  numberOfInstalments: z.coerce.number().int().min(1, 'Number of instalments is required.'),
  instalmentAmount: z.coerce.number().min(1, 'Instalment amount is required.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  status: z.enum(['due', 'paid', 'active']),
});


interface Payment {
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
  type: 'expense' | 'payout' | 'receipt';
  date: { seconds: number; nanoseconds: number };
  amount: number;
  description: string;
}


export default function FinancePage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingLoan, setIsEditingLoan] = useState(false);

  const firestore = useFirestore();
  const { toast } = useToast();
  const { data: loans, loading: loansLoading } = useCollection<Loan>('loans');
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<FinanceEntry>('financeEntries');


  const form = useForm<z.infer<typeof financeEntrySchema>>({
    resolver: zodResolver(financeEntrySchema),
    defaultValues: {
        description: "",
        amount: undefined,
        date: "",
    }
  });

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
  const watchedInstalments = watch('numberOfInstalments');
  const watchedInstalmentAmount = watch('instalmentAmount');

  const totalRepayableDisplay = useMemo(() => {
      return (watchedInstalments || 0) * (watchedInstalmentAmount || 0);
  }, [watchedInstalments, watchedInstalmentAmount]);

  async function onSubmit(values: z.infer<typeof financeEntrySchema>) {
    setIsSubmitting(true);
    try {
      await addFinanceEntry(firestore, { ...values, date: new Date(values.date) });
      toast({
        title: 'Finance Entry Added',
        description: `A new ${values.type} entry of Ksh ${values.amount.toLocaleString()} has been added.`,
      });
      form.reset();
      setOpen(false);
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Could not add finance entry. Please try again.",
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
        registrationFee: loan.registrationFee || 0,
        processingFee: loan.processingFee || 0,
        carTrackInstallationFee: loan.carTrackInstallationFee || 0,
        chargingCost: loan.chargingCost || 0,
        numberOfInstalments: loan.numberOfInstalments,
        instalmentAmount: loan.instalmentAmount,
        paymentFrequency: loan.paymentFrequency,
        status: loan.status,
    });
  }

  async function onPaymentSubmit(values: z.infer<typeof paymentSchema>) {
    if (!loanToEdit) return;
    setIsUpdating(true);
    try {
        const currentTotalPaid = loanToEdit.totalPaid || 0;
        const newTotalPaid = currentTotalPaid + values.paymentAmount;
        
        const newPayment = {
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

    const totalRepayableAmount = values.numberOfInstalments * values.instalmentAmount;
    
    const updateData = {
        ...values,
        disbursementDate: new Date(values.disbursementDate),
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


  const receipts = useMemo(() => financeEntries?.filter(e => e.type === 'receipt') ?? null, [financeEntries]);
  const payouts = useMemo(() => financeEntries?.filter(e => e.type === 'payout') ?? null, [financeEntries]);
  const expenses = useMemo(() => financeEntries?.filter(e => e.type === 'expense') ?? null, [financeEntries]);

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
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
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
                        <FormField
                            control={form.control}
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
                            control={form.control}
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
                        <FormField
                            control={form.control}
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
          <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="loanbook">Loan Book</TabsTrigger>
          </TabsList>
          <TabsContent value="receipts">
              <FinanceReportTab 
                title="Receipts"
                description="Amount received from customers."
                entries={receipts}
                loading={financeEntriesLoading}
              />
          </TabsContent>
          <TabsContent value="payouts">
              <FinanceReportTab 
                title="Payouts"
                description="Amount disbursed to customers, including costs."
                entries={payouts}
                loading={financeEntriesLoading}
              />
          </TabsContent>
          <TabsContent value="expenses">
               <FinanceReportTab 
                title="Expenses"
                description="Money spent on facilitation and other costs."
                entries={expenses}
                loading={financeEntriesLoading}
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
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Client Name</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Loan No.</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Principal</TableHead>
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
                      )}
                  </CardContent>
              </Card>
          </TabsContent>
      </Tabs>

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
                                                    <FormField
                                                        control={paymentForm.control}
                                                        name="paymentAmount"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                            <FormLabel>Payment Amount (Ksh)</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} />
                                                            </FormControl>
                                                            <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={paymentForm.control}
                                                        name="paymentDate"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                            <FormLabel>Payment Date</FormLabel>
                                                            <FormControl>
                                                                <Input type="date" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={paymentForm.control}
                                                        name="comments"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Loan Comments</FormLabel>
                                                                <FormControl>
                                                                    <Textarea placeholder="Add any comments about the loan (e.g., rollover request)..." {...field} rows={4} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
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
                                                    {loanToEdit.payments.sort((a,b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()).map((payment, index) => (
                                                        <TableRow key={index}>
                                                        <TableCell>{format(new Date(payment.date.seconds * 1000), 'PPP')}</TableCell>
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
                                <DialogClose asChild>
                                <Button type="button" variant="ghost">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" form="payment-form" disabled={isUpdating}>
                                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Payment
                                </Button>
                            </DialogFooter>
                        </TabsContent>

                        <TabsContent value="edit">
                            <Form {...editLoanForm}>
                                <form onSubmit={editLoanForm.handleSubmit(onLoanEditSubmit)} id="edit-loan-form" className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto p-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={editLoanForm.control} name="disbursementDate" render={({ field }) => (
                                            <FormItem><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={editLoanForm.control} name="principalAmount" render={({ field }) => (
                                            <FormItem><FormLabel>Principal Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={editLoanForm.control} name="registrationFee" render={({ field }) => (
                                            <FormItem><FormLabel>Registration Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={editLoanForm.control} name="processingFee" render={({ field }) => (
                                            <FormItem><FormLabel>Processing Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={editLoanForm.control} name="carTrackInstallationFee" render={({ field }) => (
                                            <FormItem><FormLabel>Car Track Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={editLoanForm.control} name="chargingCost" render={({ field }) => (
                                            <FormItem><FormLabel>Charging Cost</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={editLoanForm.control} name="numberOfInstalments" render={({ field }) => (
                                            <FormItem><FormLabel>No. of Instalments</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={editLoanForm.control} name="instalmentAmount" render={({ field }) => (
                                            <FormItem><FormLabel>Instalment Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={editLoanForm.control} name="paymentFrequency" render={({ field }) => (
                                            <FormItem><FormLabel>Payment Frequency</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                    <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                                                </Select><FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={editLoanForm.control} name="status" render={({ field }) => (
                                            <FormItem><FormLabel>Status</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                    <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="due">Due</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
                                                </Select><FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                    <Card className="mt-4">
                                        <CardHeader><CardTitle className="text-lg">Recalculated Totals</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">New Total Repayable Amount:</span>
                                                <span className="font-bold text-lg">Ksh {totalRepayableDisplay.toLocaleString()}</span>
                                            </div>
                                             <div className="flex justify-between items-center mt-1">
                                                <span className="text-xs text-muted-foreground">Original:</span>
                                                <span className="text-xs text-muted-foreground">Ksh {loanToEdit.totalRepayableAmount.toLocaleString()}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </form>
                            </Form>
                            <DialogFooter className="mt-4">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" form="edit-loan-form" disabled={isEditingLoan}>
                                    {isEditingLoan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );

    