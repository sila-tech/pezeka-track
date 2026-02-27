'use client';

import { useMemo, useState } from 'react';
import { useAppUser, useCollection, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bell, Loader2, TrendingUp, HandCoins, UserCheck, Send, FileText } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { addDays, addWeeks, addMonths, differenceInDays, format, startOfToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { addLoan } from '@/lib/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DashboardLoan {
  id: string;
  loanNumber: string;
  customerName: string;
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
  disbursementDate: { seconds: number; nanoseconds: number };
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  numberOfInstalments: number;
  totalRepayableAmount: number;
  totalPaid: number;
  principalAmount: number;
  registrationFee?: number;
  processingFee?: number;
  carTrackInstallationFee?: number;
  chargingCost?: number;
  loanType?: string;
  idNumber?: string;
}

const staffLoanSchema = z.object({
  amount: z.coerce.number().min(1000, "Minimum application is Ksh 1,000"),
  reason: z.string().min(10, "Please provide a brief reason for the loan request."),
});

export default function Dashboard() {
  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isStaffLoanOpen, setIsStaffLoanOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthorized = user ? (user.email === 'simon@pezeka.com' || user.role === 'staff' || user.role === 'finance') : false;
  const isFinanceUser = user ? (user.email === 'simon@pezeka.com' || user.role === 'finance') : false;
  const isStaffMember = user?.role === 'staff' || user?.role === 'finance';

  const { data: loans, loading: loansLoading } = useCollection<DashboardLoan>(isAuthorized ? 'loans' : null);

  const staffLoanForm = useForm<z.infer<typeof staffLoanSchema>>({
    resolver: zodResolver(staffLoanSchema),
    defaultValues: { amount: undefined, reason: '' },
  });

  async function onStaffLoanSubmit(values: z.infer<typeof staffLoanSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const loanData = {
        customerId: user.uid,
        customerName: user.name || user.email?.split('@')[0],
        customerPhone: "Internal Staff",
        disbursementDate: new Date(),
        principalAmount: values.amount,
        interestRate: 0, 
        registrationFee: 0,
        processingFee: 0,
        carTrackInstallationFee: 0,
        chargingCost: 0,
        numberOfInstalments: 1,
        paymentFrequency: 'monthly' as const,
        status: 'application' as const,
        loanType: 'Staff Loan',
        instalmentAmount: values.amount,
        totalRepayableAmount: values.amount,
        totalPaid: 0,
        idNumber: "STAFF-ID",
        alternativeNumber: "",
        comments: `Staff Loan Application: ${values.reason}`,
      };

      await addLoan(firestore, loanData);
      toast({
        title: "Application Submitted",
        description: "Your staff loan application has been sent to Finance for review.",
      });
      staffLoanForm.reset();
      setIsStaffLoanOpen(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Application Failed",
        description: e.message || "Could not submit application.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const stats = useMemo(() => {
    if (!loans) return { realizedRevenue: 0, disbursedCount: 0 };
    
    let realizedRevenue = 0;
    let disbursedCount = 0;
    
    loans.forEach(loan => {
        if (loan.status !== 'application' && loan.status !== 'rejected') {
            disbursedCount++;
            const upfrontFees = (Number(loan.registrationFee) || 0) + 
                               (Number(loan.processingFee) || 0) + 
                               (Number(loan.carTrackInstallationFee) || 0) + 
                               (Number(loan.chargingCost) || 0);
            
            realizedRevenue += upfrontFees;
            if (loan.totalPaid > loan.principalAmount) {
                realizedRevenue += (loan.totalPaid - loan.principalAmount);
            }
        }
    });
    
    return { realizedRevenue, disbursedCount };
  }, [loans]);

  const dueLoans = useMemo(() => {
    if (!loans) return [];
    const today = startOfToday();
    
    return loans
      .filter(loan => loan.status !== 'paid' && loan.status !== 'rollover' && loan.status !== 'application' && loan.status !== 'rejected')
      .map(loan => {
        const disbursementDate = new Date(loan.disbursementDate.seconds * 1000);
        let endDate: Date;
        try {
            switch (loan.paymentFrequency) {
                case 'daily': endDate = addDays(disbursementDate, loan.numberOfInstalments); break;
                case 'weekly': endDate = addWeeks(disbursementDate, loan.numberOfInstalments); break;
                case 'monthly': endDate = addMonths(disbursementDate, loan.numberOfInstalments); break;
                default: endDate = new Date('invalid');
            }
        } catch(e) { endDate = new Date('invalid'); }
        return { ...loan, endDate };
      })
      .filter(loan => {
        if (!loan.endDate || loan.endDate.toString() === 'Invalid Date') return false;
        const daysUntilDue = differenceInDays(loan.endDate, today);
        return daysUntilDue <= 7;
      });
  }, [loans]);

  const newApplications = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => loan.status === 'application').sort((a, b) => b.disbursementDate.seconds - a.disbursementDate.seconds);
  }, [loans]);
  
  const isLoading = userLoading || loansLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {user?.name || user?.email?.split('@')[0] || 'Admin'}!
        </h1>
        {isStaffMember && (
          <Dialog open={isStaffLoanOpen} onOpenChange={setIsStaffLoanOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <UserCheck className="mr-2 h-4 w-4" />
                Apply for Staff Loan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Staff Loan Application</DialogTitle>
                <DialogDescription>
                  Apply for an interest-free staff loan. Applications are reviewed by the Finance team.
                </DialogDescription>
              </DialogHeader>
              <Form {...staffLoanForm}>
                <form onSubmit={staffLoanForm.handleSubmit(onStaffLoanSubmit)} className="space-y-4 py-2">
                  <FormField
                    control={staffLoanForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Requested Amount (Ksh)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 5000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={staffLoanForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason for Request</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Briefly describe why you need this loan..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit Internal Application
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         {isFinanceUser && (
           <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Realized Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">Ksh {(stats?.realizedRevenue || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Fees and interest collected</p>
              </CardContent>
          </Card>
         )}
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loans Disbursed</CardTitle>
                <HandCoins className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats?.disbursedCount || 0}</div>
                 <p className="text-xs text-muted-foreground">Total historical count</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col h-[500px]">
            <CardHeader>
                <CardTitle>Due Loans</CardTitle>
                <CardDescription>Members with payments that are overdue or due within 7 days.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center p-8 h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : dueLoans.length === 0 ? (
                <Alert>
                    <Bell className="h-4 w-4" />
                    <AlertTitle>No Due Loans</AlertTitle>
                    <AlertDescription>All customer accounts are up to date.</AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-full">
                 <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Loan No.</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dueLoans.map((loan) => {
                            const balance = loan.totalRepayableAmount - loan.totalPaid;
                            const daysDue = differenceInDays(loan.endDate, startOfToday());
                            
                            let statusLabel = '';
                            let statusVariant: "destructive" | "secondary" | "default" = 'secondary';

                            if (loan.status === 'due' || loan.status === 'overdue' || daysDue < 0) {
                                statusLabel = `Overdue by ${Math.abs(daysDue)} day(s)`;
                                statusVariant = 'destructive';
                            } else if (daysDue === 0) {
                                statusLabel = 'Due Today';
                                statusVariant = 'destructive';
                            } else {
                                statusLabel = `Due in ${daysDue} day(s)`;
                            }

                            return (
                                <TableRow key={loan.id}>
                                    <TableCell className="font-medium">
                                      <div>{loan.customerName}</div>
                                      <div className="text-[10px] text-muted-foreground">ID: {loan.idNumber || "N/A"}</div>
                                    </TableCell>
                                    <TableCell>{loan.loanNumber}</TableCell>
                                    <TableCell className="whitespace-nowrap">{format(loan.endDate, 'MMM dd, yyyy')}</TableCell>
                                    <TableCell className="text-right font-bold tabular-nums">{balance.toLocaleString()}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                </ScrollArea>
              )}
            </CardContent>
        </Card>
        <Card className="flex flex-col h-[500px]">
            <CardHeader>
                <CardTitle>New Loan Applications</CardTitle>
                <CardDescription>Recently applied loans, including internal staff applications.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center p-8 h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : newApplications.length === 0 ? (
                    <Alert>
                        <Bell className="h-4 w-4" />
                        <AlertTitle>No New Applications</AlertTitle>
                        <AlertDescription>There are currently no new loan applications to review.</AlertDescription>
                    </Alert>
                ) : (
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {newApplications.map((loan) => (
                                    <TableRow key={loan.id}>
                                        <TableCell className="font-medium">
                                          <div>{loan.customerName}</div>
                                          <div className="text-[10px] text-muted-foreground">ID: {loan.idNumber || "N/A"}</div>
                                        </TableCell>
                                        <TableCell>
                                          {loan.loanType === 'Staff Loan' ? <Badge variant="outline">Staff Loan</Badge> : (loan.loanType || 'N/A')}
                                        </TableCell>
                                        <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell className="text-right font-bold tabular-nums">Ksh {loan.principalAmount.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}