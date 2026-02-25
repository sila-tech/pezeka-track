'use client';

import { useMemo, useState } from 'react';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileText, Bell, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { requestWithdrawal, requestDeposit } from '@/lib/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { exportToCsv } from '@/lib/excel';


const withdrawalSchema = z.object({
  amount: z.coerce.number().positive("Withdrawal amount must be a positive number."),
});

const depositSchema = z.object({
  amount: z.coerce.number().positive("Deposit amount must be a positive number."),
});


interface InterestEntry {
  entryId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
  description?: string;
}

interface Withdrawal {
  withdrawalId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
  status: 'pending' | 'processed' | 'rejected';
}

interface Deposit {
  depositId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
}


interface Investor {
  id: string;
  uid: string;
  name: string;
  email: string;
  totalInvestment: number;
  currentBalance: number;
  interestRate?: number;
  createdAt: { seconds: number; nanoseconds: number };
  interestEntries?: InterestEntry[];
  withdrawals?: Withdrawal[];
  deposits?: Deposit[];
}

export default function InvestorPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  
  const { data: portfolio, loading: portfolioLoading } = useDoc<Investor>(user ? `investors/${user.uid}` : null);
  
  const withdrawalForm = useForm<z.infer<typeof withdrawalSchema>>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: { amount: undefined },
  });

  const depositForm = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: undefined },
  });

  const roi = useMemo(() => {
    if (!portfolio || !portfolio.totalInvestment) return 0;
    return ((portfolio.currentBalance - portfolio.totalInvestment) / portfolio.totalInvestment) * 100;
  }, [portfolio]);

  async function onWithdrawalSubmit(values: z.infer<typeof withdrawalSchema>) {
    if (!user) return;
    if (values.amount > (portfolio?.currentBalance ?? 0)) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: "Your withdrawal request exceeds your current balance.",
      });
      return;
    }
    setIsSubmittingWithdrawal(true);
    try {
      await requestWithdrawal(firestore, user.uid, values.amount);
      toast({
        title: "Withdrawal Request Submitted",
        description: "Your request has been sent for processing.",
      });
      withdrawalForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: error.message || "Could not submit withdrawal request.",
      });
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  }

  async function onDepositSubmit(values: z.infer<typeof depositSchema>) {
    if (!user) return;
    setIsSubmittingDeposit(true);
    try {
      await requestDeposit(firestore, user.uid, values.amount);
      toast({
        title: "Deposit Noted",
        description: "Your deposit notification has been sent. It will be approved once payment is confirmed.",
      });

      const phoneNumber = "254757664047";
      const message = `Hello! I have just deposited Ksh ${values.amount.toLocaleString()} into my Pezeka Credit portfolio. My investor account is associated with the email ${user.email}. Please verify.`;
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, '_blank');

      depositForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: error.message || "Could not submit deposit notification.",
      });
    } finally {
      setIsSubmittingDeposit(false);
    }
  }

  const handleDownloadStatement = () => {
    if (!portfolio) return;
    const statementData = [];

    // Initial Investment
    if (portfolio.createdAt) {
        statementData.push({
            Date: format(new Date(portfolio.createdAt.seconds * 1000), 'PPP'),
            Description: 'Initial Investment',
            Amount: portfolio.totalInvestment,
            Type: 'Credit'
        });
    }

    // Deposit Entries
    (portfolio.deposits || []).filter(d => d.status === 'approved').forEach(entry => {
        statementData.push({
            Date: format(new Date((entry.date as any).seconds * 1000), 'PPP'),
            Description: 'Deposit',
            Amount: entry.amount,
            Type: 'Credit'
        });
    });

    // Interest Entries
    (portfolio.interestEntries || []).forEach(entry => {
        statementData.push({
            Date: format(new Date((entry.date as any).seconds * 1000), 'PPP'),
            Description: entry.description || 'Monthly Interest',
            Amount: entry.amount,
            Type: 'Credit'
        });
    });

    // Withdrawal Entries
    (portfolio.withdrawals || []).filter(w => w.status === 'processed').forEach(w => {
        statementData.push({
            Date: format(new Date((w.date as any).seconds * 1000), 'PPP'),
            Description: `Withdrawal`,
            Amount: w.amount,
            Type: 'Debit'
        });
    });

    // Sort by date
    statementData.sort((a,b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());

    exportToCsv(statementData, `${portfolio.name.replace(/ /g, '_')}_statement`);
  };
  
  const isLoading = userLoading || portfolioLoading;

  return (
    <div className="py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">
            Welcome, {portfolio?.name || user?.email}!
        </h1>
        <Button onClick={handleDownloadStatement} disabled={!portfolio}>
            <Download className="mr-2 h-4 w-4" />
            Download Statement
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-12">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !portfolio && (
        <Alert variant="destructive">
            <AlertTitle>Portfolio Not Found</AlertTitle>
            <AlertDescription>We could not find an investment portfolio associated with your account. Please contact support for assistance.</AlertDescription>
        </Alert>
      )}

      {!isLoading && portfolio && (
        <>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Invested Amount</CardTitle>
                        <span className="text-muted-foreground">Ksh</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{portfolio.totalInvestment.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Portfolio Value</CardTitle>
                         <span className="text-muted-foreground">Ksh</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{portfolio.currentBalance.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Return on Investment (ROI)</CardTitle>
                        <span className="text-muted-foreground">%</span>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-destructive'}`}>{roi.toFixed(2)}%</div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Add Funds to Portfolio</CardTitle>
                        <CardDescription>Deposit funds using the details below and then notify us of your deposit.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="text-sm p-4 bg-muted rounded-lg">
                                <h4 className="font-semibold mb-2">Payment Details</h4>
                                <p><strong>M-Pesa PayBill:</strong> 522522</p>
                                <p><strong>Account Number:</strong> 1347823360</p>
                                <p className="mt-2 text-xs text-muted-foreground">Use your registered email or phone number in the payment reference if possible.</p>
                            </div>
                            <Form {...depositForm}>
                                <form onSubmit={depositForm.handleSubmit(onDepositSubmit)} className="space-y-4">
                                    <FormField control={depositForm.control} name="amount" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount Deposited (Ksh)</FormLabel>
                                            <FormControl><Input type="number" placeholder="e.g., 20000" {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <Button type="submit" className="w-full" disabled={isSubmittingDeposit}>
                                        {isSubmittingDeposit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        I Have Deposited
                                    </Button>
                                </form>
                            </Form>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Deposit History</CardTitle>
                        <CardDescription>A log of your deposit notifications.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-60">
                         {(!portfolio.deposits || portfolio.deposits.length === 0) ? (
                            <Alert>
                                <Bell className="h-4 w-4" />
                                <AlertTitle>No deposit notifications yet</AlertTitle>
                                <AlertDescription>
                                    Your deposit notifications will appear here.
                                </AlertDescription>
                            </Alert>
                         ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[...portfolio.deposits].sort((a,b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()).map(d => (
                                        <TableRow key={d.depositId}>
                                            <TableCell>{format(new Date((d.date as any).seconds * 1000), 'PPP')}</TableCell>
                                            <TableCell>{d.amount.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge variant={d.status === 'pending' ? 'secondary' : d.status === 'approved' ? 'default' : 'destructive'}>
                                                    {d.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
            <div className="mt-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Request a Withdrawal</CardTitle>
                        <CardDescription>Request to withdraw funds from your portfolio. Requests will be processed by an administrator.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-6 md:grid-cols-2">
                             <Form {...withdrawalForm}>
                                <form onSubmit={withdrawalForm.handleSubmit(onWithdrawalSubmit)} className="space-y-4">
                                    <FormField control={withdrawalForm.control} name="amount" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount to Withdraw (Ksh)</FormLabel>
                                            <FormControl><Input type="number" placeholder="e.g., 10000" {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <Button type="submit" className="w-full" disabled={isSubmittingWithdrawal}>
                                        {isSubmittingWithdrawal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Submit Withdrawal Request
                                    </Button>
                                </form>
                            </Form>
                             <ScrollArea className="h-60 border rounded-lg">
                             {(!portfolio.withdrawals || portfolio.withdrawals.length === 0) ? (
                                <div className="p-4">
                                    <Alert>
                                        <Bell className="h-4 w-4" />
                                        <AlertTitle>No withdrawals yet</AlertTitle>
                                        <AlertDescription>
                                            Your withdrawal history will appear here.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                             ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...portfolio.withdrawals].sort((a,b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()).map(w => (
                                            <TableRow key={w.withdrawalId}>
                                                <TableCell>{format(new Date((w.date as any).seconds * 1000), 'PPP')}</TableCell>
                                                <TableCell>{w.amount.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <Badge variant={w.status === 'pending' ? 'secondary' : w.status === 'processed' ? 'default' : 'destructive'}>
                                                        {w.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             )}
                            </ScrollArea>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
      )}
    </div>
  );
}
