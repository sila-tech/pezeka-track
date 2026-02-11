'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { addLoan, addCustomer } from '@/lib/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { calculateAmortization } from '@/lib/utils';


const loanSchema = z.object({
  loanNumber: z.string().min(1, 'Loan number is required.'),
  customerId: z.string().optional(),
  disbursementDate: z.string().min(1, 'Disbursement date is required.'),
  principalAmount: z.coerce.number().min(1, 'Principal amount is required.'),
  interestRate: z.coerce.number().min(0, 'Interest rate must be a positive number.'),
  registrationFee: z.coerce.number().optional(),
  processingFee: z.coerce.number().optional(),
  carTrackInstallationFee: z.coerce.number().optional(),
  chargingCost: z.coerce.number().optional(),
  numberOfInstalments: z.coerce.number().int().min(1, 'Number of instalments is required.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  status: z.enum(['due', 'paid', 'active']),
  customerType: z.enum(['existing', 'new']),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.customerType === 'existing' && !data.customerId) {
    ctx.addIssue({ code: 'custom', message: 'Please select a customer.', path: ['customerId'] });
  }
  if (data.customerType === 'new') {
    if (!data.newCustomerName) {
      ctx.addIssue({ code: 'custom', message: 'New customer name is required.', path: ['newCustomerName'] });
    }
    if (!data.newCustomerPhone) {
      ctx.addIssue({ code: 'custom', message: 'New customer phone is required.', path: ['newCustomerPhone'] });
    }
  }
});


interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Loan {
    id: string;
    loanNumber: string;
    customerName: string;
    disbursementDate: { seconds: number, nanoseconds: number };
    principalAmount: number;
    status: 'due' | 'paid' | 'active';
    totalRepayableAmount: number;
    totalPaid: number;
}


export default function LoansPage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const { data: customers, loading: customersLoading } = useCollection<Customer>('customers');
  const { data: loans, loading: loansLoading } = useCollection<Loan>('loans');


  const form = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      loanNumber: '',
      customerId: '',
      principalAmount: undefined,
      interestRate: undefined,
      registrationFee: 0,
      processingFee: 0,
      carTrackInstallationFee: 0,
      chargingCost: 0,
      numberOfInstalments: undefined,
      paymentFrequency: 'monthly',
      status: 'active',
      customerType: 'existing',
      newCustomerName: '',
      newCustomerPhone: '',
    },
  });

  const { watch } = form;
  const principalAmount = watch('principalAmount');
  const interestRate = watch('interestRate');
  const numberOfInstalments = watch('numberOfInstalments');
  const paymentFrequency = watch('paymentFrequency');
  const customerType = watch('customerType');

  const calculatedValues = useMemo(() => {
    const { instalmentAmount, totalRepayableAmount } = calculateAmortization(principalAmount, interestRate, numberOfInstalments, paymentFrequency);
    
    return {
        instalmentAmount: instalmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalRepayableAmount: totalRepayableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
  }, [principalAmount, interestRate, numberOfInstalments, paymentFrequency]);


  async function onSubmit(values: z.infer<typeof loanSchema>) {
    setIsSubmitting(true);
    try {
      let customerId = values.customerId;
      let customerName = '';
      let customerPhone = '';

      if (values.customerType === 'new') {
        const newCustomerData = { name: values.newCustomerName!, phone: values.newCustomerPhone! };
        const newCustomerDocRef = await addCustomer(firestore, newCustomerData);
        customerId = newCustomerDocRef.id;
        customerName = newCustomerData.name;
        customerPhone = newCustomerData.phone;
        toast({
            title: 'Customer Added',
            description: `${customerName} has been added successfully.`,
        });
      } else {
        const selectedCustomer = customers?.find(c => c.id === customerId);
        if (!selectedCustomer) {
            throw new Error("Selected customer not found.");
        }
        customerName = selectedCustomer.name;
        customerPhone = selectedCustomer.phone;
      }
      
      const { instalmentAmount, totalRepayableAmount } = calculateAmortization(
        values.principalAmount,
        values.interestRate,
        values.numberOfInstalments,
        values.paymentFrequency
      );

      const loanData = {
        ...values,
        customerId: customerId!,
        customerName,
        customerPhone,
        disbursementDate: new Date(values.disbursementDate),
        totalRepayableAmount,
        instalmentAmount,
        totalPaid: 0,
        registrationFee: values.registrationFee || 0,
        processingFee: values.processingFee || 0,
        carTrackInstallationFee: values.carTrackInstallationFee || 0,
        chargingCost: values.chargingCost || 0,
      };
      
      await addLoan(firestore, loanData);

      toast({
        title: 'Loan Added',
        description: `Loan #${values.loanNumber} has been added successfully.`,
      });
      form.reset();
      setOpen(false);

    } catch (e: any) {
        toast({
            variant: 'destructive',
            title: 'Error creating loan',
            description: e.message || 'An unexpected error occurred.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Loan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add a New Loan</DialogTitle>
              <DialogDescription>
                Fill in the details below to create a new loan record.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <div className="max-h-[65vh] overflow-y-auto pr-4">
                    <form id="add-loan-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="customerType"
                            render={({ field }) => (
                            <FormItem className="col-span-2">
                                <FormLabel>Customer Type</FormLabel>
                                <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex space-x-4"
                                >
                                    <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                        <RadioGroupItem value="existing" id="existing" />
                                    </FormControl>
                                    <FormLabel htmlFor="existing">Existing Customer</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                        <RadioGroupItem value="new" id="new" />
                                    </FormControl>
                                    <FormLabel htmlFor="new">New Customer</FormLabel>
                                    </FormItem>
                                </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        {customerType === 'existing' ? (
                        <FormField
                            control={form.control}
                            name="customerId"
                            render={({ field }) => (
                            <FormItem className="col-span-2">
                                <FormLabel>Customer</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={customersLoading}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder={customersLoading ? "Loading customers..." : "Select a customer"} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {customers && customers.map(customer => (
                                    <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        ) : (
                        <>
                            <FormField
                            control={form.control}
                            name="newCustomerName"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>New Customer Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="John Doe" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="newCustomerPhone"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>New Customer Phone</FormLabel>
                                <FormControl>
                                    <Input placeholder="0712345678" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </>
                        )}


                        <FormField
                        control={form.control}
                        name="loanNumber"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Loan Number</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., LN001" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="disbursementDate"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Disbursement Date</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="principalAmount"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Principal Amount</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g. 50000" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                          control={form.control}
                          name="interestRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Annual Interest Rate (%)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g. 15" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                        control={form.control}
                        name="registrationFee"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Registration Fee (Optional)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="0" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="processingFee"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Processing Fee (Optional)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="0" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="carTrackInstallationFee"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Car Track Fee (Optional)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="0" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="chargingCost"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Charging Cost (Optional)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="0" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="numberOfInstalments"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>No. of Instalments</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g. 12" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="paymentFrequency"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Payment Frequency</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <div className="col-span-2 space-y-2 rounded-md bg-muted p-4">
                            <div className="flex justify-between">
                                <span className="text-sm font-medium">Calculated Instalment Amount</span>
                                <span className="text-sm font-bold">Ksh {calculatedValues.instalmentAmount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm font-medium">Total Repayable Amount</span>
                                <span className="text-sm font-bold">Ksh {calculatedValues.totalRepayableAmount}</span>
                            </div>
                        </div>

                        <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem className="col-span-2">
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="due">Due</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </form>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" form="add-loan-form" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Loan
                    </Button>
                </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Loan Records</CardTitle>
          <CardDescription>A list of all loans disbursed.</CardDescription>
        </CardHeader>
        <CardContent>
        {loansLoading && (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )}
        {!loansLoading && (!loans || loans.length === 0) && (
            <Alert>
                <AlertTitle>No Loans Found</AlertTitle>
                <AlertDescription>There are no loans in the system yet. Add one to see it here.</AlertDescription>
            </Alert>
        )}
        {!loansLoading && loans && loans.length > 0 && (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Loan No.</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Amount to Pay</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loans.map((loan) => {
                        const balance = loan.totalRepayableAmount - loan.totalPaid;
                        return (
                            <TableRow key={loan.id}>
                                <TableCell className="font-medium">{loan.loanNumber}</TableCell>
                                <TableCell>{loan.customerName}</TableCell>
                                <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="text-right">{loan.principalAmount.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{loan.totalRepayableAmount.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-green-600">{loan.totalPaid.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-bold">{balance.toLocaleString()}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={loan.status === 'paid' ? 'default' : loan.status === 'due' ? 'destructive' : 'secondary'}>
                                    {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                  </Badge>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
