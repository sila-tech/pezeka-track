
'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { User, BarChart2, Calendar as CalendarIcon, HandCoins, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { DateRange } from 'react-day-picker';
import { startOfMonth, endOfMonth, isWithinInterval, startOfToday, endOfToday, startOfWeek, endOfWeek, format } from 'date-fns';
import { DatePickerWithRange } from './editable-finance-report-tab';

interface Payment {
    paymentId: string;
    amount: number;
    date: { seconds: number; nanoseconds: number } | Date;
}

interface Loan {
  id: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  principalAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  status: string;
  disbursementDate: { seconds: number; nanoseconds: number } | Date;
  payments?: Payment[];
}

interface Staff {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: string;
}

interface StaffPortfoliosTabProps {
  loans: Loan[] | null;
  staffList: Staff[] | null;
}

export function StaffPortfoliosTab({ loans, staffList }: StaffPortfoliosTabProps) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const staffPerformance = useMemo(() => {
    if (!staffList || !loans) return [];

    const fromDate = date?.from;
    const toDate = date?.to || date?.from;
    
    const interval = fromDate ? { 
        start: new Date(fromDate).setHours(0, 0, 0, 0), 
        end: new Date(toDate!).setHours(23, 59, 59, 999) 
    } : null;

    // Filter out applications and rejected for performance metrics
    const disbursedLoans = loans.filter(l => l.status !== 'application' && l.status !== 'rejected');

    return staffList.map(staff => {
      const staffLoans = disbursedLoans.filter(l => l.assignedStaffId === (staff.id));
      
      let periodDisbursed = 0;
      let periodCollected = 0;
      
      staffLoans.forEach(loan => {
          const dDate = loan.disbursementDate instanceof Date 
              ? loan.disbursementDate 
              : new Date((loan.disbursementDate as any).seconds * 1000);

          // If no interval, show all-time
          if (!interval || isWithinInterval(dDate, interval)) {
              periodDisbursed += Number(loan.principalAmount) || 0;
          }

          // Check payments in interval
          (loan.payments || []).forEach(payment => {
              const pDate = payment.date instanceof Date 
                  ? payment.date 
                  : new Date((payment.date as any).seconds * 1000);

              if (!interval || isWithinInterval(pDate, interval)) {
                  periodCollected += Number(payment.amount) || 0;
              }
          });
      });
      
      const totalRepayable = staffLoans.reduce((acc, l) => acc + (Number(l.totalRepayableAmount) || 0), 0);
      const totalCollectedAllTime = staffLoans.reduce((acc, l) => acc + (Number(l.totalPaid) || 0), 0);
      const efficiency = totalRepayable > 0 ? (totalCollectedAllTime / totalRepayable) * 100 : 0;
      const activeCount = staffLoans.filter(l => l.status !== 'paid').length;

      return {
        id: staff.id,
        uid: staff.id,
        name: staff.name || staff.email,
        activeCount,
        periodDisbursed,
        periodCollected,
        efficiency
      };
    }).sort((a, b) => b.periodDisbursed - a.periodDisbursed);
  }, [loans, staffList, date]);

  const totals = useMemo(() => {
      return staffPerformance.reduce((acc, s) => {
          acc.disbursed += s.periodDisbursed;
          acc.collected += s.periodCollected;
          return acc;
      }, { disbursed: 0, collected: 0 });
  }, [staffPerformance]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setDatePreset('all')}>All Time</Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset('today')}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset('weekly')}>This Week</Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset('monthly')}>This Month</Button>
          </div>
          <DatePickerWithRange date={date} setDate={setDate} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
          <Card>
              <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <HandCoins className="h-3 w-3" /> Period Team Disbursement
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">Ksh {totals.disbursed.toLocaleString()}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Total capital advanced in selected period</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-green-600" /> Period Team Collection
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-green-600">Ksh {totals.collected.toLocaleString()}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Total payments received in selected period</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <Wallet className="h-3 w-3" /> Avg. Collection Efficiency
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">
                      {staffPerformance.length > 0 ? (staffPerformance.reduce((acc, s) => acc + s.efficiency, 0) / staffPerformance.length).toFixed(1) : 0}%
                  </div>
                  <Progress value={staffPerformance.length > 0 ? (staffPerformance.reduce((acc, s) => acc + s.efficiency, 0) / staffPerformance.length) : 0} className="mt-2" />
              </CardContent>
          </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Performance Ledger</CardTitle>
          <CardDescription>
            Performance metrics for the period: {date?.from ? format(date.from, 'PP') : 'All Time'} - {date?.to ? format(date.to, 'PP') : (date?.from ? format(date.from, 'PP') : 'All Time')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[250px]">Staff Member</TableHead>
                  <TableHead className="text-center">Active Loans</TableHead>
                  <TableHead className="text-right">Period Disbursed</TableHead>
                  <TableHead className="text-right">Period Collected</TableHead>
                  <TableHead className="w-[150px]">All-Time Efficiency</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffPerformance.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {staff.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant="outline">{staff.activeCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      Ksh {staff.periodDisbursed.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-bold">
                      Ksh {staff.periodCollected.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span>{staff.efficiency.toFixed(1)}%</span>
                        </div>
                        <Progress value={staff.efficiency} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/finance/staff/${staff.uid}`}>
                                <BarChart2 className="mr-2 h-4 w-4" />
                                Details
                            </Link>
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                  <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2} className="text-right">Team Totals</TableCell>
                      <TableCell className="text-right text-primary">Ksh {totals.disbursed.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600">Ksh {totals.collected.toLocaleString()}</TableCell>
                      <TableCell colSpan={2} />
                  </TableRow>
              </TableFooter>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
