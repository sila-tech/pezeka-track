'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useCollection, useDoc, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, Calendar as CalendarIcon, TrendingUp, Wallet, HandCoins, ReceiptText } from 'lucide-react';
import { format, startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, addDays, addWeeks, addMonths, differenceInDays, differenceInMonths } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '../../components/editable-finance-report-tab';

interface Payment {
    paymentId: string;
    amount: number;
    date: { seconds: number; nanoseconds: number } | Date;
}

interface Loan {
    id: string;
    loanNumber: string;
    customerName: string;
    customerPhone: string;
    principalAmount: number;
    totalRepayableAmount: number;
    totalPaid: number;
    instalmentAmount: number;
    status: string;
    paymentFrequency: 'daily' | 'weekly' | 'monthly';
    disbursementDate: { seconds: number; nanoseconds: number } | Date;
    firstPaymentDate?: { seconds: number; nanoseconds: number } | Date;
    assignedStaffId: string;
    payments?: Payment[];
}

interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: string;
}

export default function StaffPerformancePage() {
    const params = useParams();
    const router = useRouter();
    const staffId = params.staffId as string;
    const { user: currentUser, loading: userLoading } = useAppUser();
    
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const isAuthorized = currentUser ? (currentUser.email === 'simon@pezeka.com' || currentUser.role === 'finance') : false;

    const { data: staffProfile, loading: staffLoading } = useDoc<UserProfile>(`users/${staffId}`);
    const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);

    const isLoading = userLoading || staffLoading || loansLoading;

    const performance = useMemo(() => {
        if (!loans || !date?.from) return { 
            periodDisbursements: 0, 
            periodCollections: 0, 
            periodLoans: [],
            periodCollectionsList: [],
            allTimePortfolio: [],
            timelines: {} as Record<string, string>
        };

        const today = startOfToday();
        const disbursedLoans = loans.filter(l => l.status !== 'application' && l.status !== 'rejected');
        const staffLoans = disbursedLoans.filter(l => l.assignedStaffId === staffId);
        
        const fromDate = date.from;
        const toDate = date.to || date.from;
        
        const interval = { 
            start: new Date(fromDate).setHours(0, 0, 0, 0), 
            end: new Date(toDate).setHours(23, 59, 59, 999) 
        };

        let periodDisbursements = 0;
        let periodCollections = 0;
        const periodLoanEntries: any[] = [];
        const periodCollectionsList: any[] = [];
        const timelines: Record<string, string> = {};

        staffLoans.forEach(loan => {
            // Timeline Calculation Logic
            let baseDate: Date;
            if (loan.firstPaymentDate && 'seconds' in loan.firstPaymentDate) {
                baseDate = new Date(loan.firstPaymentDate.seconds * 1000);
            } else if (loan.firstPaymentDate instanceof Date) {
                baseDate = loan.firstPaymentDate;
            } else {
                const dDate = loan.disbursementDate && 'seconds' in loan.disbursementDate 
                    ? new Date(loan.disbursementDate.seconds * 1000) 
                    : (loan.disbursementDate instanceof Date ? loan.disbursementDate : new Date());
                
                if (loan.paymentFrequency === 'daily') baseDate = addDays(dDate, 1);
                else if (loan.paymentFrequency === 'weekly') baseDate = addWeeks(dDate, 1);
                else baseDate = addMonths(dDate, 1);
            }

            const actualPaid = (loan.totalPaid || 0) / (loan.instalmentAmount || 1);
            const nextIdx = Math.floor(actualPaid);
            let nextDue: Date;
            if (loan.paymentFrequency === 'daily') nextDue = addDays(baseDate, nextIdx);
            else if (loan.paymentFrequency === 'weekly') nextDue = addWeeks(baseDate, nextIdx);
            else nextDue = addMonths(baseDate, nextIdx);

            const daysUntil = differenceInDays(nextDue, today);
            
            let cyclesPassed = 0;
            if (loan.paymentFrequency === 'daily') cyclesPassed = differenceInDays(today, baseDate);
            else if (loan.paymentFrequency === 'weekly') cyclesPassed = Math.floor(differenceInDays(today, baseDate) / 7);
            else if (loan.paymentFrequency === 'monthly') cyclesPassed = differenceInMonths(today, baseDate);

            const arrears = Math.max(0, cyclesPassed - actualPaid);

            if (loan.status === 'paid') timelines[loan.id] = "PAID";
            else if (arrears > 0 && daysUntil < 0) timelines[loan.id] = `LATE ${Math.ceil(arrears)}${loan.paymentFrequency[0]}`;
            else if (daysUntil === 0) timelines[loan.id] = "DUE TODAY";
            else timelines[loan.id] = `DUE IN ${daysUntil}D`;

            // Stats
            const dDate = loan.disbursementDate instanceof Date 
                ? loan.disbursementDate 
                : new Date((loan.disbursementDate as any).seconds * 1000);

            if (isWithinInterval(dDate, interval)) {
                periodDisbursements += Number(loan.principalAmount) || 0;
                periodLoanEntries.push({ ...loan, type: 'disbursement', date: dDate });
            }

            (loan.payments || []).forEach(payment => {
                const pDate = payment.date instanceof Date 
                    ? payment.date 
                    : new Date((payment.date as any).seconds * 1000);

                if (isWithinInterval(pDate, interval)) {
                    periodCollections += Number(payment.amount) || 0;
                    periodCollectionsList.push({
                        id: payment.paymentId,
                        date: pDate,
                        customer: loan.customerName,
                        amount: payment.amount,
                        loanNumber: loan.loanNumber
                    });
                }
            });
        });

        return { 
            periodDisbursements, 
            periodCollections, 
            periodLoans: periodLoanEntries.sort((a,b) => b.date.getTime() - a.date.getTime()),
            periodCollectionsList: periodCollectionsList.sort((a,b) => b.date.getTime() - a.date.getTime()),
            allTimePortfolio: staffLoans,
            timelines
        };
    }, [loans, staffId, date]);

    const setDatePreset = (preset: 'today' | 'weekly' | 'monthly' | 'all') => {
        const today = new Date();
        if (preset === 'all') {
            setDate(undefined);
        } else if (preset === 'today') {
            setDate({ from: startOfToday(), to: endOfToday() });
        } else if (preset === 'weekly') {
            setDate({ from: startOfWeek(today), to: endOfWeek(today) });
        } else if (preset === 'monthly') {
            setDate({ from: startOfMonth(today), to: endOfMonth(today) });
        }
    }

    if (!isAuthorized && !userLoading) {
        return <div className="p-12 text-center">Access Denied</div>;
    }

    if (isLoading) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Button variant="ghost" onClick={() => router.back()} className="-ml-2 mb-2">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Finance
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {staffProfile?.name || "Staff Performance"}
                    </h1>
                    <p className="text-muted-foreground">Detailed metrics and portfolio review for {staffProfile?.email}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDatePreset('today')}>Today</Button>
                        <Button variant="outline" size="sm" onClick={() => setDatePreset('weekly')}>This Week</Button>
                        <Button variant="outline" size="sm" onClick={() => setDatePreset('monthly')}>This Month</Button>
                    </div>
                    <DatePickerWithRange date={date} setDate={setDate} />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                            <HandCoins className="h-3 w-3" /> Period Disbursements
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Ksh {performance.periodDisbursements.toLocaleString()}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Capital advanced in selected window</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="h-3 w-3 text-green-600" /> Period Collections
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">Ksh {performance.periodCollections.toLocaleString()}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Total payments processed in window</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                            <Wallet className="h-3 w-3" /> Portfolio Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            Ksh {performance.allTimePortfolio.reduce((acc, l) => acc + (l.totalRepayableAmount - l.totalPaid), 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Total outstanding across {performance.allTimePortfolio.length} active loans</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Period Disbursements</CardTitle>
                        <CardDescription>Loans disbursed in this period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {performance.periodLoans.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">No disbursements in this period.</TableCell></TableRow>
                                    ) : (
                                        performance.periodLoans.map((loan, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-xs">{format(loan.date, 'dd/MM/yy')}</TableCell>
                                                <TableCell className="font-medium text-xs">{loan.customerName}</TableCell>
                                                <TableCell className="text-right font-bold text-xs">Ksh {loan.principalAmount.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ReceiptText className="h-5 w-5 text-green-600" />
                            Period Collections
                        </CardTitle>
                        <CardDescription>Detailed payment sources for this period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {performance.periodCollectionsList.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">No collections in this period.</TableCell></TableRow>
                                    ) : (
                                        performance.periodCollectionsList.map((pay, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-[10px]">{format(pay.date, 'dd/MM/yy HH:mm')}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-xs">{pay.customer}</div>
                                                    <div className="text-[9px] text-muted-foreground">Loan #{pay.loanNumber}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-xs text-green-600">
                                                    Ksh {pay.amount.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                                {performance.periodCollectionsList.length > 0 && (
                                    <TableFooter>
                                        <TableRow className="font-bold bg-muted/50">
                                            <TableCell colSpan={2} className="text-right">Total</TableCell>
                                            <TableCell className="text-right text-green-600">Ksh {performance.periodCollections.toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                )}
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Portfolio Inventory</CardTitle>
                    <CardDescription>Full list of all active loans currently assigned to this staff member.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="text-center">Timeline</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {performance.allTimePortfolio.map((loan) => (
                                    <TableRow key={loan.id}>
                                        <TableCell>
                                            <div className="font-medium text-xs">{loan.customerName}</div>
                                            <div className="text-[10px] text-muted-foreground">#{loan.loanNumber}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-xs tabular-nums">
                                            Ksh {(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={performance.timelines[loan.id]?.startsWith('LATE') ? 'destructive' : 'outline'} className="text-[9px] uppercase font-black">
                                                {performance.timelines[loan.id]}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
