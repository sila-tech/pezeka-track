'use client';

import { useMemo } from 'react';
import { useAppUser, useCollection } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bell, Loader2, TrendingUp, HandCoins } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { addDays, addWeeks, addMonths, differenceInDays, format, startOfToday } from 'date-fns';

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
}

export default function Dashboard() {
  const { user, loading: userLoading } = useAppUser();
  
  const isAuthorized = user ? (user.email === 'simon@pezeka.com' || user.role === 'staff' || user.role === 'finance') : false;
  const isFinanceUser = user ? (user.email === 'simon@pezeka.com' || user.role === 'finance') : false;

  const { data: loans, loading: loansLoading } = useCollection<DashboardLoan>(isAuthorized ? 'loans' : null);

  const stats = useMemo(() => {
    if (!loans) return { realizedRevenue: 0, disbursedCount: 0 };
    
    let realizedRevenue = 0;
    let disbursedCount = 0;
    
    loans.forEach(loan => {
        // Exclude applications and rejections from counts
        if (loan.status !== 'application' && loan.status !== 'rejected') {
            disbursedCount++;
            
            // Revenue includes upfront fees (collected at disbursement)
            const upfrontFees = (Number(loan.registrationFee) || 0) + 
                               (Number(loan.processingFee) || 0) + 
                               (Number(loan.carTrackInstallationFee) || 0) + 
                               (Number(loan.chargingCost) || 0);
            
            realizedRevenue += upfrontFees;

            // Interest revenue realized from payments made
            // Simplified: If TotalPaid > Principal, the excess is interest.
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
                case 'daily':
                    endDate = addDays(disbursementDate, loan.numberOfInstalments);
                    break;
                case 'weekly':
                    endDate = addWeeks(disbursementDate, loan.numberOfInstalments);
                    break;
                case 'monthly':
                    endDate = addMonths(disbursementDate, loan.numberOfInstalments);
                    break;
                default:
                   endDate = new Date('invalid');
            }
        } catch(e) {
            endDate = new Date('invalid');
        }
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
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-4">
        Welcome, {user?.name || user?.email?.split('@')[0] || 'Admin'}!
      </h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         {isFinanceUser && (
           <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                  Total Realized Revenue
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">Ksh {(stats?.realizedRevenue || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                  Fees and interest collected
                  </p>
              </CardContent>
          </Card>
         )}
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                Loans Disbursed
                </CardTitle>
                <HandCoins className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats?.disbursedCount || 0}</div>
                 <p className="text-xs text-muted-foreground">
                Total historical count
                </p>
            </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>Due Loans</CardTitle>
                <CardDescription>Members with payments that are overdue or due within 7 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {!isLoading && dueLoans.length === 0 && (
                <Alert>
                    <Bell className="h-4 w-4" />
                    <AlertTitle>No Due Loans</AlertTitle>
                    <AlertDescription>
                        All customer accounts are up to date.
                    </AlertDescription>
                </Alert>
              )}
              {!isLoading && dueLoans.length > 0 && (
                 <Table>
                    <TableHeader>
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
                                    <TableCell className="font-medium">{loan.customerName}</TableCell>
                                    <TableCell>{loan.loanNumber}</TableCell>
                                    <TableCell>{format(loan.endDate, 'PPP')}</TableCell>
                                    <TableCell className="text-right font-bold">{balance.toLocaleString()}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={statusVariant}>
                                        {statusLabel}
                                      </Badge>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
              )}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>New Loan Applications</CardTitle>
                <CardDescription>Customers who have recently applied for a loan.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}
                {!isLoading && newApplications.length === 0 && (
                    <Alert>
                        <Bell className="h-4 w-4" />
                        <AlertTitle>No New Applications</AlertTitle>
                        <AlertDescription>
                            There are currently no new loan applications to review.
                        </AlertDescription>
                    </Alert>
                )}
                {!isLoading && newApplications.length > 0 && (
                    <div className="max-h-[300px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Loan Type</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {newApplications.map((loan) => (
                                    <TableRow key={loan.id}>
                                        <TableCell className="font-medium">{loan.customerName}</TableCell>
                                        <TableCell>{loan.loanType || 'N/A'}</TableCell>
                                        <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'PPP')}</TableCell>
                                        <TableCell className="text-right font-bold">{loan.principalAmount.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
