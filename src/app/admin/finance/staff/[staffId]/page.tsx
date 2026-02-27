'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useCollection, useDoc, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, Calendar as CalendarIcon, TrendingUp, Wallet, HandCoins } from 'lucide-react';
import { format, startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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
    status: string;
    disbursementDate: { seconds: number; nanoseconds: number } | Date;
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
            allTimePortfolio: [] 
        };

        const staffLoans = loans.filter(l => l.assignedStaffId === staffId);
        const fromDate = date.from;
        const toDate = date.to || date.from;
        
        // Normalize range to full days
        const interval = { 
            start: new Date(fromDate).setHours(0, 0, 0, 0), 
            end: new Date(toDate).setHours(23, 59, 59, 999) 
        };

        let periodDisbursements = 0;
        let periodCollections = 0;
        const periodLoanEntries: any[] = [];

        staffLoans.forEach(loan => {
            const dDate = loan.disbursementDate instanceof Date 
                ? loan.disbursementDate 
                : new Date((loan.disbursementDate as any).seconds * 1000);

            // Track disbursements in period
            if (isWithinInterval(dDate, interval)) {
                periodDisbursements += Number(loan.principalAmount) || 0;
                periodLoanEntries.push({ ...loan, type: 'disbursement', date: dDate });
            }

            // Track collections in period
            (loan.payments || []).forEach(payment => {
                const pDate = payment.date instanceof Date 
                    ? payment.date 
                    : new Date((payment.date as any).seconds * 1000);

                if (isWithinInterval(pDate, interval)) {
                    periodCollections += Number(payment.amount) || 0;
                }
            });
        });

        return { 
            periodDisbursements, 
            periodCollections, 
            periodLoans: periodLoanEntries,
            allTimePortfolio: staffLoans 
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
                        <p className="text-[10px] text-muted-foreground mt-1">Total payments processed in selected window</p>
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
                        <CardTitle>Period Activity</CardTitle>
                        <CardDescription>Loans disbursed between {date?.from ? format(date.from, 'PP') : 'Start'} and {date?.to ? format(date.to, 'PP') : 'End'}</CardDescription>
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
                                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No disbursements in this period.</TableCell></TableRow>
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
                        <CardTitle>Portfolio Inventory</CardTitle>
                        <CardDescription>Full list of all loans currently assigned to this staff member.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
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
                                                <Badge variant="outline" className="text-[9px] uppercase">{loan.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
