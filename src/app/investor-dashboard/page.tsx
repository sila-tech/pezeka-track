'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, PiggyBank } from 'lucide-react';
import { format, differenceInMonths, startOfMonth } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Investment {
    id: string;
    investorId: string;
    investorName: string;
    principal: number;
    monthlyInterestRate: number;
    startDate: { seconds: number; nanoseconds: number };
    status: 'active' | 'withdrawn';
}

interface MonthlyAccrual {
    date: Date;
    amount: number;
}

export default function InvestorDashboardPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const investmentsQuery = useMemo(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'investments'), where('investorId', '==', user.uid));
    }, [user, firestore]);

    const { data: investments, loading: investmentsLoading } = useCollection<Investment>(investmentsQuery);

    const { totalPrincipal, totalInterest, allAccruals } = useMemo(() => {
        if (!investments) {
            return { totalPrincipal: 0, totalInterest: 0, allAccruals: [] };
        }

        let totalPrincipal = 0;
        const allAccruals: MonthlyAccrual[] = [];

        investments.forEach(investment => {
            if (investment.status === 'active') {
                totalPrincipal += investment.principal;
            }

            const start = new Date(investment.startDate.seconds * 1000);
            const now = new Date();
            
            // Calculate the number of full months passed.
            const monthsPassed = differenceInMonths(startOfMonth(now), startOfMonth(start));

            if (monthsPassed > 0) {
                const monthlyInterestAmount = investment.principal * (investment.monthlyInterestRate / 100);
                
                for (let i = 0; i < monthsPassed; i++) {
                    const accrualDate = new Date(start);
                    accrualDate.setMonth(start.getMonth() + i + 1);
                    allAccruals.push({
                        date: accrualDate,
                        amount: monthlyInterestAmount,
                    });
                }
            }
        });

        const totalInterest = allAccruals.reduce((sum, accrual) => sum + accrual.amount, 0);

        allAccruals.sort((a, b) => b.date.getTime() - a.date.getTime());

        return { totalPrincipal, totalInterest, allAccruals };
    }, [investments]);

    const isLoading = userLoading || investmentsLoading;

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Principal Invested</CardTitle>
                        <PiggyBank className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                            <>
                                <div className="text-2xl font-bold">Ksh {totalPrincipal.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">Total amount currently active.</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cumulative Interest Earned</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                         {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                            <>
                                <div className="text-2xl font-bold">Ksh {totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <p className="text-xs text-muted-foreground">Total interest accumulated over time.</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Monthly Interest Accruals</CardTitle>
                    <CardDescription>A breakdown of interest earned each month across all your investments.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : allAccruals.length > 0 ? (
                        <div className="max-h-[50vh] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Month</TableHead>
                                        <TableHead className="text-right">Interest Earned (Ksh)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allAccruals.map((accrual, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{format(accrual.date, 'MMMM yyyy')}</TableCell>
                                            <TableCell className="text-right font-medium">{accrual.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                         <Alert>
                            <AlertTitle>No Interest Accrued Yet</AlertTitle>
                            <AlertDescription>
                                You have no investments that have accrued interest for a full month yet.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
