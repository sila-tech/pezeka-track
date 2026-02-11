"use client";

import { type Loan, type Customer } from "@/lib/types";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileDown, PlusCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useDoc, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();

  const customerRef = useMemoFirebase(() => doc(firestore, "customers", params.id), [firestore, params.id]);
  const { data: customer, isLoading: customerLoading } = useDoc<Customer>(customerRef);

  const loansQuery = useMemoFirebase(() => query(collection(firestore, "loans"), where("customerId", "==", params.id)), [firestore, params.id]);
  const { data: customerLoans, isLoading: loansLoading } = useCollection<Loan>(loansQuery);

  const isLoading = customerLoading || loansLoading;
  
  if (isLoading) {
    return <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">Loading...</main>
  }
  
  if (!customer) {
    notFound();
  }

  return (
    <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/finance/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Customer Details</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="items-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={customer.avatarUrl} alt={customer.name} data-ai-hint="person face" />
              <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <CardTitle>{customer.name}</CardTitle>
            <CardDescription>{customer.email}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone:</span>
              <span>{customer.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Joined:</span>
              <span>{new Date(customer.joinDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={customer.status === 'Overdue' ? 'destructive' : customer.status === 'Active Loan' ? 'default' : 'secondary'}>
                {customer.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Loan History</CardTitle>
              <CardDescription>A summary of all loans taken by {customer.name}.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                Download Statement
              </Button>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Loan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Disbursed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerLoans?.map(loan => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{loan.id}</TableCell>
                    <TableCell>KES {loan.amount.toLocaleString()}</TableCell>
                    <TableCell>{format(new Date(loan.disbursementDate), "PPP")}</TableCell>
                    <TableCell>
                      <Badge variant={loan.status === 'overdue' ? 'destructive' : loan.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                        {loan.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(customerLoans?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">
                      No loans found for this customer.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
