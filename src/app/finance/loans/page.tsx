"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Loan, type Customer } from "@/lib/types";
import { PlusCircle, FileDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

export default function LoansPage() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const loansQuery = useMemoFirebase(() => collection(firestore, "loans"), [firestore]);
  const { data: loans, isLoading: loansLoading } = useCollection<Loan>(loansQuery);
  
  const customersQuery = useMemoFirebase(() => collection(firestore, "customers"), [firestore]);
  const { data: customers, isLoading: customersLoading } = useCollection<Customer>(customersQuery);

  const handleAddLoan = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    
    const customerId = formData.get("customer") as string;
    const amount = Number(formData.get("amount"));
    const repaymentSchedule = formData.get("schedule") as Loan['repaymentSchedule'];

    if(!customerId || !amount || !repaymentSchedule) {
        toast({
            variant: "destructive",
            title: "Missing fields",
            description: "Please fill out all fields to disburse a loan."
        });
        return;
    }

    const newLoanId = `LOAN-${String((loans?.length ?? 0) + 1).padStart(3, '0')}`;
    const newLoan: Loan = {
      id: newLoanId,
      customerId,
      amount,
      repaymentSchedule,
      disbursementDate: new Date().toISOString(),
      status: 'active',
      dueDate: new Date(new Date().setDate(new Date().getDate() + (repaymentSchedule === 'daily' ? 1 : repaymentSchedule === 'weekly' ? 7 : 30))).toISOString(),
      principal: amount,
      interest: amount * 0.1, // Assuming 10% interest for now
    };

    const loanDocRef = doc(firestore, 'loans', newLoanId);
    setDoc(loanDocRef, newLoan);

    setOpen(false);
    toast({
      title: "Loan Added",
      description: "A new loan record has been successfully created.",
    });
  };

  const allLoansWithCustomer = loans?.map(loan => ({
    ...loan,
    customer: customers?.find(c => c.id === loan.customerId)
  })) || [];

  const isLoading = loansLoading || customersLoading;

  if(isLoading) {
    return <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">Loading...</main>;
  }

  return (
    <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">All Loans</h2>
        <div className="flex gap-2">
            <Button variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                Export to Excel
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Loan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Loan</DialogTitle>
                  <DialogDescription>
                    Fill in the details below to disburse a new loan.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddLoan} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer</Label>
                    <Select name="customer" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (KES)</Label>
                    <Input id="amount" name="amount" type="number" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule">Repayment Schedule</Label>
                    <Select name="schedule" required>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a schedule" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Disburse Loan</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </div>
      </div>
      <Card>
        <CardContent className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Disbursed</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allLoansWithCustomer.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell>
                    <div className="font-medium">{loan.customer?.name}</div>
                    <div className="text-sm text-muted-foreground">{loan.customer?.phone}</div>
                  </TableCell>
                  <TableCell>KES {loan.amount.toLocaleString()}</TableCell>
                  <TableCell>{format(new Date(loan.disbursementDate), "PPP")}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{loan.repaymentSchedule}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={loan.status === 'overdue' ? 'destructive' : loan.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {loan.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/finance/customers/${loan.customerId}`}>
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
