
'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
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
import { addLoan, addCustomer, updateLoan, approveLoanApplication } from '@/lib/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, addDays, addWeeks, addMonths, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { calculateAmortization } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { exportToCsv } from '@/lib/excel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';


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
    status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
    totalRepayableAmount: number;
    totalPaid: number;
    instalmentAmount: number;
    paymentFrequency: 'daily' | 'weekly' | 'monthly';
    numberOfInstalments: number;
    registrationFee: number;
    processingFee: number;
    carTrackInstallationFee: number;
    chargingCost: number;
    disbursementRecorded?: boolean;
}


export default function LoansPage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messageLoan, setMessageLoan] = useState<Loan | null>(null);
  const [applicationToManage, setApplicationToManage] = useState<Loan | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isSuperAdmin = user?.email === 'simon@pezeka.com';
  const isFinance = user?.role === 'finance';
  const isStaff = user?.role === 'staff';

  const canAdd = isSuperAdmin || isFinance || isStaff;
  const canManageApplications = isSuperAdmin || isFinance;

  const isAuthorized = user ? (user.email === 'simon@pezeka.com' || user.role === 'staff' || user.role === 'finance') : false;

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
        description: `Loan #${newLoanNumber} has been added successfully. Finance entries for disbursement and upfront fees have been recorded.`,
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

  const handleUpdateStatus = async (loan: Loan, newStatus: 'active' | 'rejected') => {
    setIsUpdatingStatus(true);
    try {
        if (newStatus === 'active') {
            await approveLoanApplication(firestore, loan);
        } else {
            await updateLoan(firestore, loan.id, { status: newStatus });
        }
        
        toast({
            title: `Application ${newStatus === 'active' ? 'Approved' : 'Rejected'}`,
            description: `Loan application #${loan.loanNumber} has been updated. ${newStatus === 'active' ? 'Disbursement recorded.' : ''}`,
        });
        setApplicationToManage(null);
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message || "Could not update the loan status.",
        });
    } finally {
        setIsUpdatingStatus(false);
    }
  }
  
  const isLoading = userLoading || customersLoading || loansLoading;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
        {canAdd && (
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
                <ScrollArea className="max-h-[65vh] pr-4">
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
                </ScrollArea>

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
        )}
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
                                <SelectItem value="rejected">Rejected</SelectItem>
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
                                : "There are no loans in the system yet. Add a loan to see it here."
                            }
                        </AlertDescription>
                    </Alert>
                )}
                {!isLoading && filteredLoans && filteredLoans.length > 0 && (
                    <ScrollArea className="h-[60vh]">
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
                                            <Badge variant={loan.status === 'paid' ? 'default' : (loan.status === 'due' || loan.status === 'overdue' || loan.status === 'application' || loan.status === 'rejected') ? 'destructive' : 'secondary'}>
                                              {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                            </Badge>
                                          </TableCell>
                                      </TableRow>
                                  )
                              })}
                          </TableBody>
                      </Table>
                    </ScrollArea>
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
                        <ScrollArea className="h-[60vh]">
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
                                        <TableRow key={loan.id} className="cursor-pointer" onClick={() => setApplicationToManage(loan)}>
                                            <TableCell className="font-medium">{loan.customerName}</TableCell>
                                            <TableCell>{loan.customerPhone}</TableCell>
                                            <TableCell>{loan.loanType || 'N/A'}</TableCell>
                                            <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-right font-bold">{loan.principalAmount.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* Manage Application Dialog */}
      <Dialog open={!!applicationToManage} onOpenChange={(isOpen) => !isOpen && setApplicationToManage(null)}>
        <DialogContent className="sm:max-w-2xl">
            {applicationToManage && (
                <>
                    <DialogHeader>
                        <DialogTitle>Manage Application #{applicationToManage.loanNumber}</DialogTitle>
                        <DialogDescription>
                            Review and approve or reject this loan application from {applicationToManage.customerName}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><div className="text-sm text-muted-foreground">Applicant Name</div><div className="font-semibold">{applicationToManage.customerName}</div></div>
                            <div><div className="text-sm text-muted-foreground">Applicant Phone</div><div className="font-semibold">{applicationToManage.customerPhone}</div></div>
                            <div><div className="text-sm text-muted-foreground">National ID</div><div className="font-semibold">{applicationToManage.idNumber || 'N/A'}</div></div>
                            <div><div className="text-sm text-muted-foreground">Application Date</div><div className="font-semibold">{format(new Date(applicationToManage.disbursementDate.seconds * 1000), 'PPP')}</div></div>
                            <div><div className="text-sm text-muted-foreground">Loan Type</div><div className="font-semibold">{applicationToManage.loanType || 'N/A'}</div></div>
                            <div><div className="text-sm text-muted-foreground">Amount Requested</div><div className="font-bold text-lg">Ksh {applicationToManage.principalAmount.toLocaleString()}</div></div>
                        </div>
                    </div>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setApplicationToManage(null)} disabled={isUpdatingStatus}>Cancel</Button>
                        {canManageApplications && (
                            <>
                                <Button variant="destructive" onClick={() => handleUpdateStatus(applicationToManage, 'rejected')} disabled={isUpdatingStatus}>
                                    {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Reject
                                </Button>
                                <Button onClick={() => handleUpdateStatus(applicationToManage, 'active')} disabled={isUpdatingStatus}>
                                    {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Approve & Disburse
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
