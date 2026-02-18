'use client';

import { useMemo } from 'react';
import { useUser, useCollection } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bell, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { addDays, addWeeks, addMonths, differenceInDays, format, startOfToday } from 'date-fns';

interface DueLoan {
  id: string;
  loanNumber: string;
  customerName: string;
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application';
  disbursementDate: { seconds: number; nanoseconds: number };
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  numberOfInstalments: number;
  totalRepayableAmount: number;
  totalPaid: number;
}

export default function Dashboard() {
  const { user, loading: userLoading } = useUser();
  
  const isAuthorized = user ? (
    user.email === 'simon@pezeka.com' ||
    user.email?.endsWith('@finance.pezeka.com') ||
    user.email?.endsWith('@staff.pezeka.com')
  ) : false;

  const { data: loans, loading: loansLoading } = useCollection<DueLoan>(isAuthorized ? 'loans' : null);

  const dueLoans = useMemo(() => {
    if (!loans) return [];

    const today = startOfToday();
    
    return loans
      .filter(loan => loan.status !== 'paid' && loan.status !== 'rollover' && loan.status !== 'application')
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
  
  const isLoading = userLoading || loansLoading;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-4">
        Welcome, {user?.email?.split('@')[0] || 'Simon'}!
      </h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                Total Revenue
                </CardTitle>
                <span className="text-muted-foreground">Ksh</span>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">Ksh 0.00</div>
                <p className="text-xs text-muted-foreground">
                +0% from last month
                </p>
            </CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                Loans Disbursed
                </CardTitle>
                <span className="text-muted-foreground">#</span>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">0</div>
                 <p className="text-xs text-muted-foreground">
                +0% from last month
                </p>
            </CardContent>
        </Card>
      </div>
      <div className="mt-6">
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
      </div>
    </div>
  );
}
