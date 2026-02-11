'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, PlusCircle } from "lucide-react";

import { useFirestore } from '@/firebase';
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { addFinanceEntry } from '@/lib/firestore';
import { Textarea } from '@/components/ui/textarea';


const financeEntrySchema = z.object({
  type: z.enum(['expense', 'payout', 'receipt'], { required_error: 'Please select an entry type.' }),
  date: z.date({
    required_error: "A date is required.",
  }),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  description: z.string().optional(),
});


export default function FinancePage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof financeEntrySchema>>({
    resolver: zodResolver(financeEntrySchema),
    defaultValues: {
        description: ""
    }
  });

  function onSubmit(values: z.infer<typeof financeEntrySchema>) {
    setIsSubmitting(true);
    addFinanceEntry(firestore, values);
    toast({
      title: 'Finance Entry Added',
      description: `A new ${values.type} entry of ${values.amount} has been added.`,
    });
    form.reset();
    setOpen(false);
    setIsSubmitting(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Entry
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a New Finance Entry</DialogTitle>
                    <DialogDescription>
                        Fill in the details below to record a financial transaction.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Entry Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an entry type" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="receipt">Receipt</SelectItem>
                                    <SelectItem value="payout">Payout</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>Date</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        >
                                        {field.value ? (
                                            format(field.value, "PPP")
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) =>
                                            date > new Date() || date < new Date("1900-01-01")
                                        }
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Amount</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="0.00" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Describe the transaction..." {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="ghost">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Entry
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>
      <Tabs defaultValue="receipts">
          <TabsList>
              <TabsTrigger value="receipts">Daily Receipts</TabsTrigger>
              <TabsTrigger value="payouts">Daily Payouts</TabsTrigger>
              <TabsTrigger value="expenses">Daily Expenses</TabsTrigger>
          </TabsList>
          <TabsContent value="receipts">
              <Card>
                  <CardHeader>
                      <CardTitle>Daily Receipts</CardTitle>
                      <CardDescription>Amount received from customers.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <p>Receipts table will go here.</p>
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="payouts">
              <Card>
                  <CardHeader>
                      <CardTitle>Daily Payouts</CardTitle>
                      <CardDescription>Amount disbursed to customers, including costs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <p>Payouts table will go here.</p>
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="expenses">
              <Card>
                  <CardHeader>
                      <CardTitle>Daily Expenses</CardTitle>
                      <CardDescription>Money spent on facilitation and other costs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <p>Expenses table will go here.</p>
                  </CardContent>
              </Card>
          </TabsContent>
      </Tabs>
    </div>
  );
}
