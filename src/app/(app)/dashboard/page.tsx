import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { customers, loans } from "@/lib/data";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const dueLoans = loans
    .filter(loan => loan.status === 'active' || loan.status === 'overdue')
    .map(loan => ({
      ...loan,
      customer: customers.find(c => c.id === loan.customerId),
    }))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <HandCoins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loans.filter(l => l.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">Total value of active loans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">All registered customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loans Overdue</CardTitle>
            <Bell className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{loans.filter(l => l.status === 'overdue').length}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming & Overdue Payments</CardTitle>
          <CardDescription>
            List of customers with payments that are due soon or are already overdue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount Due</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dueLoans.slice(0, 5).map(loan => (
                <TableRow key={loan.id}>
                  <TableCell>
                    <div className="font-medium">{loan.customer?.name}</div>
                    <div className="text-sm text-muted-foreground">{loan.customer?.phone}</div>
                  </TableCell>
                  <TableCell>{format(new Date(loan.dueDate), "PPP")}</TableCell>
                  <TableCell>KES {loan.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{loan.repaymentSchedule}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={loan.status === 'overdue' ? 'destructive' : 'default'} className="capitalize">{loan.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/customers/${loan.customerId}`}>
                        View <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
