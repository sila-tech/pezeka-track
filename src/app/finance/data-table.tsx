"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileDown, PlusCircle } from "lucide-react";
import type { FinanceRecord } from "@/lib/types";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, addDocumentNonBlocking } from "@/firebase";
import { collection } from "firebase/firestore";

type DataTableProps = {
  title: string;
  records: FinanceRecord[];
  type: 'expense' | 'payout' | 'receipt';
};

export function FinanceDataTable({ title, records, type }: DataTableProps) {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();

  const handleAddRecord = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const amount = Number(formData.get("amount"));
    const date = formData.get("date") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    
    const newRecordId = `FIN-${String((records?.length ?? 0) + 1).padStart(3, '0')}`;
    const newRecord: Omit<FinanceRecord, 'id'> = {
        amount,
        date: new Date(date).toISOString(),
        description,
        category,
        type
    }
    
    addDocumentNonBlocking(collection(firestore, "financialRecords"), { ...newRecord, id: newRecordId });

    setOpen(false);
  };

  return (
    <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight capitalize">{title}</h2>
        <div className="flex gap-2">
          <Button variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New {type}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New {title}</DialogTitle>
                <DialogDescription>Fill in the details below.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddRecord} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (KES)</Label>
                  <Input id="amount" name="amount" type="number" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" name="date" type="date" required defaultValue={format(new Date(), 'yyyy-MM-dd')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" required />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" name="category" required />
                </div>
                <DialogFooter>
                  <Button type="submit">Save Record</Button>
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
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{format(new Date(record.date), "PPP")}</TableCell>
                  <TableCell className="font-medium">{record.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{record.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right">KES {record.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
