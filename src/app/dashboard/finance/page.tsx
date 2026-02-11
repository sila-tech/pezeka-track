'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns";
import { FileDown, Loader2, PlusCircle } from "lucide-react";

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
import { addFinanceEntry } from '@/lib/firestore';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToCsv } from '@/lib/excel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const financeEntrySchema = z.object({
  type: z.enum(['expense', 'payout', 'receipt'], { required_error: 'Please select an entry type.' }),
  date: z.string().min(1, 'A date is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  description: z.string().optional(),
});

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
}


export default function FinancePage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { data: loans, loading: loansLoading } = useCollection<Loan>('loans');


  const form = useForm<z.infer<typeof financeEntrySchema>>({
    resolver: zodResolver(financeEntrySchema),
    defaultValues: {
        description: "",
        amount: undefined,
        date: "",
    }
  });

  function onSubmit(values: z.infer<typeof financeEntrySchema>) {
    setIsSubmitting(true);
    addFinanceEntry(firestore, { ...values, date: new Date(values.date) });
    toast({
      title: 'Finance Entry Added',
      description: `A new ${values.type} entry of Ksh ${values.amount.toLocaleString()} has been added.`,
    });
    form.reset();
    setOpen(false);
    setIsSubmitting(false);
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
        };
      });
      exportToCsv(dataForExport, 'loan_book');
    }
  };

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
              <TabsTrigger value="receipts">Daily Receipts</TabsTrigger>
              <TabsTrigger value="payouts">Daily Payouts</TabsTrigger>
              <TabsTrigger value="expenses">Daily Expenses</TabsTrigger>
              <TabsTrigger value="loanbook">Loan Book</TabsTrigger>
          </TabsList>
          <TabsContent value="receipts">
              <Card>
                  <CardHeader>
                      <CardTitle>Daily Receipts</CardTitle>
                      <CardDescription>Amount received from customers.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <p>Receipts table will go here.</p>
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="payouts">
              <Card>
                  <CardHeader>
                      <CardTitle>Daily Payouts</CardTitle>
                      <CardDescription>Amount disbursed to customers, including costs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <p>Payouts table will go here.</p>
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="expenses">
              <Card>
                  <CardHeader>
                      <CardTitle>Daily Expenses</CardTitle>
                      <CardDescription>Money spent on facilitation and other costs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <p>Expenses table will go here.</p>
                  </CardContent>
              </Card>
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
                                            <TableCell className="text-right">{loan.registrationFee.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{loan.processingFee.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-medium">{takeHome.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{loan.carTrackInstallationFee.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{loan.chargingCost.toLocaleString()}</TableCell>
                                            <TableCell className="text-center">{loan.numberOfInstalments}</TableCell>
                                            <TableCell className="text-right">{loan.instalmentAmount.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{loan.totalRepayableAmount.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-green-600">{loan.totalPaid.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold">{balance.toLocaleString()}</TableCell>
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
    </div>
  );
}
