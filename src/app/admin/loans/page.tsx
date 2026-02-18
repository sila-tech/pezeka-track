'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Search, FileDown, MessageSquare, Copy } from 'lucide-react';
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
import { format, addDays, addWeeks, addMonths, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { calculateAmortization } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { exportToCsv } from '@/lib/excel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const loanSchema = z.object({
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
  status: z.enum(['due', 'paid', 'active', 'rollover', 'overdue', 'application']),
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
  idNumber?: string;
}

interface Loan {
    id: string;
    customerId: string;
    loanNumber: string;
    customerName: string;
    customerPhone: string;
    idNumber?: string;
    loanType?: string;
    disbursementDate: { seconds: number, nanoseconds: number };
    principalAmount: number;
    interestRate?: number;
    status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application';
    totalRepayableAmount: number;
    totalPaid: number;
    instalmentAmount: number;
    paymentFrequency: 'daily' | 'weekly' | 'monthly';
    numberOfInstalments: number;
}


export default function LoansPage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messageLoan, setMessageLoan] = useState<Loan | null>(null);

  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isAuthorized = user ? (
    user.email === 'simon@pezeka.com' ||
    user.email?.endsWith('@finance.pezeka.com') ||
    user.email?.endsWith('@staff.pezeka.com')
  ) : false;

  const { data: customers, loading: customersLoading } = useCollection<Customer>(isAuthorized ? 'customers' : null);
  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);

  const filteredLoans = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => {
        const statusMatch = statusFilter === 'all' || loan.status === statusFilter;
        const searchMatch = searchTerm === '' ||
            loan.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.customerPhone.includes(searchTerm);
        return statusMatch && searchMatch;
    });
  }, [loans, searchTerm, statusFilter]);
  
  const applicationLoans = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => {
        const isApplication = loan.status === 'application';
        if (!isApplication) return false;

        const searchMatch = searchTerm === '' ||
            loan.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.customerPhone.includes(searchTerm);
        return searchMatch;
    });
  }, [loans, searchTerm]);


  const form = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
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
    const { instalmentAmount, totalRepayableAmount } = calculateAmortization(principalAmount || 0, interestRate || 0, numberOfInstalments || 0, paymentFrequency);
    
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
      
      delete (loanData as any).customerType;
      delete (loanData as any).newCustomerName;
      delete (loanData as any).newCustomerPhone;
      
      const { newLoanNumber } = await addLoan(firestore, loanData);

      toast({
        title: 'Loan Added',
        description: `Loan #${newLoanNumber} has been added successfully.`,
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

  const handleRowClick = (loan: Loan) => {
    const customer = customers?.find(c => c.id === loan.customerId);
    if (customer) {
        setSelectedCustomer(customer);
    } else {
        toast({
            variant: "destructive",
            title: "Customer not found",
            description: `Could not find the customer details for loan #${loan.loanNumber}`
        });
    }
  };

  const customerLoans = useMemo(() => {
    if (!selectedCustomer || !loans) return [];
    return loans.filter(loan => loan.customerId === selectedCustomer.id);
  }, [selectedCustomer, loans]);

  const handleDownloadReport = () => {
    if (!selectedCustomer) return;

    const customerData = [{
      'Customer Name': selectedCustomer.name,
      'Phone': selectedCustomer.phone,
      'ID Number': selectedCustomer.idNumber || 'N/A'
    },
    {}, // empty row for spacing
    {
      'Loan Number': 'Loan Number',
      'Principal': 'Principal',
      'Total Repayable': 'Total Repayable',
      'Total Paid': 'Total Paid',
      'Balance': 'Balance',
      'Status': 'Status',
    },
    ...customerLoans.map(loan => {
        const balance = loan.totalRepayableAmount - loan.totalPaid;
        return {
            'Loan Number': loan.loanNumber,
            'Principal': loan.principalAmount,
            'Total Repayable': loan.totalRepayableAmount,
            'Total Paid': loan.totalPaid,
            'Balance': balance,
            'Status': loan.status,
        }
    })
    ];

    exportToCsv(customerData, `${selectedCustomer.name.replace(/ /g, '_')}_breakdown`);
  };

  const getLoanDueDate = (loan: Loan) => {
    const disbursementDate = new Date(loan.disbursementDate.seconds * 1000);
    try {
        switch (loan.paymentFrequency) {
            case 'daily': return addDays(disbursementDate, loan.numberOfInstalments);
            case 'weekly': return addWeeks(disbursementDate, loan.numberOfInstalments);
            case 'monthly': return addMonths(disbursementDate, loan.numberOfInstalments);
            default: return null;
        }
    } catch(e) {
        return null;
    }
  };
  
  const generatedMessage = useMemo(() => {
      if (!messageLoan || !selectedCustomer) return "";
      const balance = messageLoan.totalRepayableAmount - messageLoan.totalPaid;
      const dueDate = getLoanDueDate(messageLoan);
      
      const dueDateText = dueDate
        ? isToday(dueDate)
          ? `\nYour loan is due today.`
          : `\nDue Date: ${format(dueDate, 'PPP')}`
        : '';

      return `Dear ${selectedCustomer.name},\n\nThis is a friendly reminder regarding your loan with Pezeka Credit.\n\nLoan Number: ${messageLoan.loanNumber}\nOutstanding Balance: Ksh ${balance.toLocaleString()}\nNext Instalment: Ksh ${messageLoan.instalmentAmount.toLocaleString()}${dueDateText}\n\nPlease use the following details for your payment:\nPaybill: 522522\nAccount: 1347823360\n\nPlease ensure your payment is made on time to avoid daily penalties.\n\nThank you,\nPezeka Credit Ltd.`;
  }, [messageLoan, selectedCustomer]);

  const copyToClipboard = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(generatedMessage);
        toast({ title: "Message Copied!", description: "The message has been copied to your clipboard." });
      }
  };
  
  const isLoading = userLoading || customersLoading || loansLoading;

  return (
    <div>
      <Dialog open={open} onOpenChange={setOpen}>
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
                      name="disbursementDate"
                      render={({ field }) => (
                          <FormItem className="col-span-2">
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
                            <FormLabel>Monthly Interest Rate (%)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g. 1.25" {...field} value={field.value ?? ''} />
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
                              <SelectItem value="overdue">Overdue</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="rollover">Rollover</SelectItem>
                              <SelectItem value="application">Application</SelectItem>
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
                  <Button type="submit" form="add-loan-form" disabled={isSubmitting || customersLoading}>
                      {(isSubmitting || customersLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Loan
                  </Button>
              </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
         <DialogTrigger asChild>
            <Button onClick={() => setOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Loan
            </Button>
          </DialogTrigger>
      </div>
      <Tabs defaultValue="all" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <TabsList>
                <TabsTrigger value="all">All Loans</TabsTrigger>
                <TabsTrigger value="applications" className="relative">
                    New Applications
                    {applicationLoans && applicationLoans.length > 0 && (
                        <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{applicationLoans.length}</Badge>
                    )}
                </TabsTrigger>
            </TabsList>
            <div className="relative">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search loans..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full sm:w-[300px]"
                />
            </div>
        </div>
        <TabsContent value="all">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>Loan Records</CardTitle>
                            <CardDescription>A list of all loans disbursed.</CardDescription>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="due">Due</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="rollover">Rollover</SelectItem>
                                <SelectItem value="application">Application</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                {isLoading && (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}
                {!isLoading && (!filteredLoans || filteredLoans.length === 0) && (
                    <Alert>
                        <AlertTitle>No Loans Found</AlertTitle>
                        <AlertDescription>
                            {searchTerm || statusFilter !== 'all'
                                ? "No loans match your search criteria."
                                : "There are no loans in the system yet. Add one to see it here."
                            }
                        </AlertDescription>
                    </Alert>
                )}
                {!isLoading && filteredLoans && filteredLoans.length > 0 && (
                    <div className="relative max-h-[60vh] overflow-y-auto">
                      <Table>
                          <TableHeader className="sticky top-0 bg-card">
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
                              {filteredLoans.map((loan) => {
                                  const balance = loan.totalRepayableAmount - loan.totalPaid;
                                  return (
                                      <TableRow key={loan.id} className="cursor-pointer" onClick={() => handleRowClick(loan)}>
                                          <TableCell className="font-medium">{loan.loanNumber}</TableCell>
                                          <TableCell>{loan.customerName}</TableCell>
                                          <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'dd/MM/yyyy')}</TableCell>
                                          <TableCell className="text-right">{loan.principalAmount.toLocaleString()}</TableCell>
                                          <TableCell className="text-right">{loan.totalRepayableAmount.toLocaleString()}</TableCell>
                                          <TableCell className="text-right text-green-600">{loan.totalPaid.toLocaleString()}</TableCell>
                                          <TableCell className="text-right font-bold">{balance.toLocaleString()}</TableCell>
                                          <TableCell className="text-center">
                                            <Badge variant={loan.status === 'paid' ? 'default' : (loan.status === 'due' || loan.status === 'overdue' || loan.status === 'application') ? 'destructive' : 'secondary'}>
                                              {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                            </Badge>
                                          </TableCell>
                                      </TableRow>
                                  )
                              })}
                          </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="applications">
            <Card>
                <CardHeader>
                    <CardTitle>New Loan Applications</CardTitle>
                    <CardDescription>Review and process new loan applications from customers.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {!isLoading && (!applicationLoans || applicationLoans.length === 0) && (
                        <Alert>
                            <AlertTitle>No New Applications</AlertTitle>
                            <AlertDescription>
                                {searchTerm
                                    ? "No applications match your search."
                                    : "There are no new loan applications to review."
                                }
                            </AlertDescription>
                        </Alert>
                    )}
                    {!isLoading && applicationLoans && applicationLoans.length > 0 && (
                        <div className="relative max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card">
                                    <TableRow>
                                        <TableHead>Customer Name</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Loan Type</TableHead>
                                        <TableHead>Application Date</TableHead>
                                        <TableHead className="text-right">Amount Requested</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {applicationLoans.map((loan) => (
                                        <TableRow key={loan.id} className="cursor-pointer" onClick={() => handleRowClick(loan)}>
                                            <TableCell className="font-medium">{loan.customerName}</TableCell>
                                            <TableCell>{loan.customerPhone}</TableCell>
                                            <TableCell>{loan.loanType || 'N/A'}</TableCell>
                                            <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-right font-bold">{loan.principalAmount.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* Customer Details Dialog */}
      <Dialog
        open={!!selectedCustomer}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedCustomer(null);
            setMessageLoan(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedCustomer.name}'s Dashboard</DialogTitle>
                <DialogDescription>
                  Phone: {selectedCustomer.phone} | ID: {selectedCustomer.idNumber || 'N/A'}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 max-h-[70vh] overflow-y-auto pr-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Loan History</CardTitle>
                                <CardDescription>All loans associated with this customer.</CardDescription>
                            </div>
                             <Button onClick={handleDownloadReport} variant="outline" size="sm">
                                <FileDown className="mr-2 h-4 w-4" />
                                Download Report
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {customerLoans.length === 0 ? (
                             <Alert>
                                <AlertTitle>No Loans Found</AlertTitle>
                                <AlertDescription>This customer has no loan history.</AlertDescription>
                            </Alert>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Loan No.</TableHead>
                                        <TableHead>Principal</TableHead>
                                        <TableHead>Balance</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customerLoans.map(loan => {
                                        const balance = loan.totalRepayableAmount - loan.totalPaid;
                                        return (
                                            <TableRow key={loan.id}>
                                                <TableCell>{loan.loanNumber}</TableCell>
                                                <TableCell>{loan.principalAmount.toLocaleString()}</TableCell>
                                                <TableCell className="font-bold">{balance.toLocaleString()}</TableCell>
                                                <TableCell>
                                                  <Badge variant={loan.status === 'paid' ? 'default' : (loan.status === 'due' || loan.status === 'overdue' || loan.status === 'application') ? 'destructive' : 'secondary'}>
                                                    {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => setMessageLoan(loan)}>
                                                        <MessageSquare className="mr-2 h-4 w-4" />
                                                        Message
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedCustomer(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Message Dialog */}
       <Dialog open={!!messageLoan} onOpenChange={(isOpen) => !isOpen && setMessageLoan(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Compose Customer Message</DialogTitle>
                <DialogDescription>A message has been generated for this loan. You can copy it to your clipboard.</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
                <Textarea value={generatedMessage} rows={10} readOnly className="bg-muted/50" />
            </div>
            <DialogFooter>
                 <Button variant="ghost" onClick={() => setMessageLoan(null)}>Cancel</Button>
                 <Button onClick={copyToClipboard}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Message
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
