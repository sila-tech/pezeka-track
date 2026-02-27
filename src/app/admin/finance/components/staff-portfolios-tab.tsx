'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { User, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Loan {
  id: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  principalAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  status: string;
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
  const staffPerformance = useMemo(() => {
    if (!staffList || !loans) return [];

    return staffList.map(staff => {
      const staffLoans = loans.filter(l => l.assignedStaffId === (staff.uid || staff.id));
      
      const totalDisbursed = staffLoans.reduce((acc, l) => acc + (Number(l.principalAmount) || 0), 0);
      const totalCollected = staffLoans.reduce((acc, l) => acc + (Number(l.totalPaid) || 0), 0);
      const totalRepayable = staffLoans.reduce((acc, l) => acc + (Number(l.totalRepayableAmount) || 0), 0);
      
      const efficiency = totalRepayable > 0 ? (totalCollected / totalRepayable) * 100 : 0;
      const activeCount = staffLoans.filter(l => l.status !== 'paid' && l.status !== 'rejected' && l.status !== 'application').length;

      return {
        id: staff.id,
        uid: staff.uid || staff.id,
        name: staff.name || staff.email,
        activeCount,
        totalDisbursed,
        totalCollected,
        efficiency
      };
    }).sort((a, b) => b.totalDisbursed - a.totalDisbursed);
  }, [loans, staffList]);

  const totals = useMemo(() => {
      return staffPerformance.reduce((acc, s) => {
          acc.disbursed += s.totalDisbursed;
          acc.collected += s.totalCollected;
          return acc;
      }, { disbursed: 0, collected: 0 });
  }, [staffPerformance]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Global Collection Rate</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">
                      {totals.disbursed > 0 ? ((totals.collected / totals.disbursed) * 100).toFixed(1) : 0}%
                  </div>
                  <Progress value={totals.disbursed > 0 ? (totals.collected / totals.disbursed) * 100 : 0} className="mt-2" />
              </CardContent>
          </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Performance Ledger</CardTitle>
          <CardDescription>
            Cumulative tracking. Click "View Performance" for detailed date-filtered analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[250px]">Staff Member</TableHead>
                  <TableHead className="text-center">Active Loans</TableHead>
                  <TableHead className="text-right">Total Disbursed (Ksh)</TableHead>
                  <TableHead className="text-right">Total Collected (Ksh)</TableHead>
                  <TableHead className="w-[200px]">Collection Efficiency</TableHead>
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
                      {staff.totalDisbursed.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-bold">
                      {staff.totalCollected.toLocaleString()}
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
                                View Performance
                            </Link>
                        </Button>
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
