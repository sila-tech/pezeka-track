"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { type FinanceRecord } from "@/lib/types";
import { format, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowDownToDot, ArrowUpFromDot, CircleDollarSign, FileDown } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";

const chartData = [
  { date: "Mon", receipts: 4000, payouts: 2400, expenses: 400 },
  { date: "Tue", receipts: 3000, payouts: 1398, expenses: 221 },
  { date: "Wed", receipts: 2000, payouts: 9800, expenses: 229 },
  { date: "Thu", receipts: 2780, payouts: 3908, expenses: 200 },
  { date: "Fri", receipts: 1890, payouts: 4800, expenses: 218 },
  { date: "Sat", receipts: 2390, payouts: 3800, expenses: 250 },
  { date: "Sun", receipts: 3490, payouts: 4300, expenses: 100 },
];

const chartConfig = {
  receipts: { label: "Receipts", color: "hsl(var(--chart-2))" },
  payouts: { label: "Payouts", color: "hsl(var(--chart-1))" },
  expenses: { label: "Expenses", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

export default function FinanceDashboardPage() {
    const firestore = useFirestore();
    const financeRecordsQuery = useMemoFirebase(() => collection(firestore, "financialRecords"), [firestore]);
    const { data: financeRecords, isLoading } = useCollection<FinanceRecord>(financeRecordsQuery);

    if (isLoading) {
        return <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">Loading...</main>;
    }

    const dailyReceipts = financeRecords?.filter(r => r.type === 'receipt' && isToday(new Date(r.date))).reduce((sum, r) => sum + r.amount, 0) || 0;
    const dailyPayouts = financeRecords?.filter(r => r.type === 'payout' && isToday(new Date(r.date))).reduce((sum, r) => sum + r.amount, 0) || 0;
    const dailyExpenses = financeRecords?.filter(r => r.type === 'expense' && isToday(new Date(r.date))).reduce((sum, r) => sum + r.amount, 0) || 0;

  return (
    <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Finance Dashboard</h2>
        <Button variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          Download Summary
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Receipts</CardTitle>
            <ArrowDownToDot className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {dailyReceipts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total received today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Payouts</CardTitle>
            <ArrowUpFromDot className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {dailyPayouts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total disbursed today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Expenses</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {dailyExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total spent today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Financial Flow</CardTitle>
            <CardDescription>Receipts vs. Payouts & Expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={chartData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="payouts" fill="var(--color-payouts)" radius={4} />
                <Bar dataKey="receipts" fill="var(--color-receipts)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>A log of the most recent financial activities.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financeRecords?.slice(0, 5).map(record => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Badge variant={record.type === 'receipt' ? 'secondary' : record.type === 'payout' ? 'outline' : 'destructive' } className="capitalize">
                        {record.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{record.description}</div>
                      <div className="text-sm text-muted-foreground">{format(new Date(record.date), "PPP")}</div>
                    </TableCell>
                    <TableCell className="text-right">KES {record.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
