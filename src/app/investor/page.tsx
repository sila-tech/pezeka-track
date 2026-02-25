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
import { requestWithdrawal } from '@/lib/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { exportToCsv } from '@/lib/excel';


const withdrawalSchema = z.object({
  amount: z.coerce.number().positive("Withdrawal amount must be a positive number."),
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
}

export default function InvestorPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: portfolio, loading: portfolioLoading } = useDoc<Investor>(user ? `investors/${user.uid}` : null);
  
  const form = useForm<z.infer<typeof withdrawalSchema>>({
    resolver: zodResolver(withdrawalSchema),
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
    setIsSubmitting(true);
    try {
      await requestWithdrawal(firestore, user.uid, values.amount);
      toast({
        title: "Withdrawal Request Submitted",
        description: "Your request has been sent for processing.",
      });
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: error.message || "Could not submit withdrawal request.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleDownloadStatement = () => {
    if (!portfolio) return;
    const statementData = [];

    // Initial Investment
    statementData.push({
        Date: format(new Date(portfolio.createdAt.seconds * 1000), 'PPP'),
        Description: 'Initial Investment',
        Amount: portfolio.totalInvestment,
        Type: 'Credit'
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
    (portfolio.withdrawals || []).forEach(w => {
        statementData.push({
            Date: format(new Date((w.date as any).seconds * 1000), 'PPP'),
            Description: `Withdrawal (${w.status})`,
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
                        <CardTitle>Request a Withdrawal</CardTitle>
                        <CardDescription>Request to withdraw funds from your portfolio. Requests will be processed by an administrator.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onWithdrawalSubmit)} className="space-y-4">
                                <FormField control={form.control} name="amount" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount to Withdraw (Ksh)</FormLabel>
                                        <FormControl><Input type="number" placeholder="e.g., 10000" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit Withdrawal Request
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Withdrawal History</CardTitle>
                        <CardDescription>A log of your past and pending withdrawal requests.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-60">
                         {(!portfolio.withdrawals || portfolio.withdrawals.length === 0) ? (
                            <Alert>
                                <Bell className="h-4 w-4" />
                                <AlertTitle>No withdrawals yet</AlertTitle>
                                <AlertDescription>
                                    You have not made any withdrawal requests.
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
                    </CardContent>
                </Card>
            </div>
        </>
      )}
    </div>
  );
}
