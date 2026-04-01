'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { User, BarChart2, Calendar as CalendarIcon, HandCoins, TrendingUp, Wallet, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { DateRange } from 'react-day-picker';
import { startOfMonth, endOfMonth, isWithinInterval, startOfToday, endOfToday, startOfWeek, endOfWeek, format, addDays, addWeeks, addMonths, differenceInDays, differenceInMonths } from 'date-fns';
import { DatePickerWithRange } from './editable-finance-report-tab';

interface Payment {
    paymentId: string;
    amount: number;
    date: { seconds: number; nanoseconds: number } | Date;
}

interface Loan {
  id: string;
  loanNumber: string;
  customerName: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  principalAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  instalmentAmount: number;
  status: string;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  disbursementDate: { seconds: number; nanoseconds: number } | Date;
  firstPaymentDate?: { seconds: number; nanoseconds: number } | Date;
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

  const processedData = useMemo(() => {
    if (!staffList || !loans) return { performance: [], collectionLog: [], timelines: {} as any };

    const fromDate = date?.from;
    const toDate = date?.to || date?.from;
    const today = startOfToday();
    
    const interval = fromDate ? { 
        start: new Date(fromDate).setHours(0, 0, 0, 0), 
        end: new Date(toDate!).setHours(23, 59, 59, 999) 
    } : null;

    const collectionLog: any[] = [];
    const timelines: Record<string, string> = {};

    const performance = staffList.map(staff => {
      const staffLoans = loans.filter(l => l.assignedStaffId === (staff.id) && l.status !== 'application' && l.status !== 'rejected');
      
      let periodDisbursed = 0;
      let periodCollected = 0;
      
      staffLoans.forEach(loan => {
          // Calculate Timeline for display
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

          // Period stats
          const dDate = loan.disbursementDate instanceof Date 
              ? loan.disbursementDate 
              : new Date((loan.disbursementDate as any).seconds * 1000);

          if (!interval || isWithinInterval(dDate, interval)) {
              periodDisbursed += Number(loan.principalAmount) || 0;
          }

          (loan.payments || []).forEach(payment => {
              const pDate = payment.date instanceof Date 
                  ? payment.date 
                  : new Date((payment.date as any).seconds * 1000);

              if (!interval || isWithinInterval(pDate, interval)) {
                  periodCollected += Number(payment.amount) || 0;
                  collectionLog.push({
                      id: payment.paymentId,
                      date: pDate,
                      customer: loan.customerName,
                      amount: payment.amount,
                      staff: staff.name || staff.email,
                      loanId: loan.id
                  });
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

    return { 
        performance, 
        collectionLog: collectionLog.sort((a, b) => b.date.getTime() - a.date.getTime()),
        timelines
    };
  }, [loans, staffList, date]);

  const totals = useMemo(() => {
      return processedData.performance.reduce((acc, s) => {
          acc.disbursed += s.periodDisbursed;
          acc.collected += s.periodCollected;
          return acc;
      }, { disbursed: 0, collected: 0 });
  }, [processedData.performance]);

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
                  <p className="text-[10px] text-muted-foreground mt-1">Total capital advanced in period</p>
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
                  <p className="text-[10px] text-muted-foreground mt-1">Total payments received in period</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <Wallet className="h-3 w-3" /> Avg. Team Efficiency
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">
                      {processedData.performance.length > 0 ? (processedData.performance.reduce((acc, s) => acc + s.efficiency, 0) / processedData.performance.length).toFixed(1) : 0}%
                  </div>
                  <Progress value={processedData.performance.length > 0 ? (processedData.performance.reduce((acc, s) => acc + s.efficiency, 0) / processedData.performance.length) : 0} className="mt-2" />
              </CardContent>
          </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Performance Ledger</CardTitle>
          <CardDescription>
            Metrics for: {date?.from ? format(date.from, 'PP') : 'All Time'} - {date?.to ? format(date.to, 'PP') : (date?.from ? format(date.from, 'PP') : 'All Time')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[40vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[200px]">Staff Member</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Period Disbursed</TableHead>
                  <TableHead className="text-right">Period Collected</TableHead>
                  <TableHead className="w-[120px]">Efficiency</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedData.performance.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{staff.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant="outline">{staff.activeCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      Ksh {staff.periodDisbursed.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-bold text-xs">
                      Ksh {staff.periodCollected.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[9px]">
                          <span>{staff.efficiency.toFixed(1)}%</span>
                        </div>
                        <Progress value={staff.efficiency} className="h-1" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/finance/staff/${staff.uid}`}>
                                <BarChart2 className="h-4 w-4" />
                            </Link>
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                  <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2} className="text-right">Team Totals</TableCell>
                      <TableCell className="text-right text-primary text-xs">Ksh {totals.disbursed.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600 text-xs">Ksh {totals.collected.toLocaleString()}</TableCell>
                      <TableCell colSpan={2} />
                  </TableRow>
              </TableFooter>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
          <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-primary" />
                  Team Collection Breakdown
              </CardTitle>
              <CardDescription>Where the money came from during this period.</CardDescription>
          </CardHeader>
          <CardContent>
              <ScrollArea className="h-[40vh]">
                  <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Staff Responsible</TableHead>
                              <TableHead>Customer (Source)</TableHead>
                              <TableHead className="text-right">Amount Received</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {processedData.collectionLog.length === 0 ? (
                              <TableRow>
                                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                                      No collections recorded in this period.
                                  </TableCell>
                              </TableRow>
                          ) : (
                              processedData.collectionLog.map((log, i) => (
                                  <TableRow key={log.id || i}>
                                      <TableCell className="text-xs">{format(log.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                      <TableCell className="text-xs font-medium">{log.staff}</TableCell>
                                      <TableCell className="text-xs">{log.customer}</TableCell>
                                      <TableCell className="text-right font-bold text-green-600 text-xs">
                                          Ksh {log.amount.toLocaleString()}
                                      </TableCell>
                                  </TableRow>
                              ))
                          )}
                      </TableBody>
                      {processedData.collectionLog.length > 0 && (
                          <TableFooter>
                              <TableRow className="bg-muted/50 font-bold">
                                  <TableCell colSpan={3} className="text-right">Total Collection</TableCell>
                                  <TableCell className="text-right text-green-600">Ksh {totals.collected.toLocaleString()}</TableCell>
                              </TableRow>
                          </TableFooter>
                      )}
                  </Table>
              </ScrollArea>
          </CardContent>
      </Card>
    </div>
  );
}
