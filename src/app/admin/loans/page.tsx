'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Search, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
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
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { calculateAmortization } from '@/lib/utils';
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
  loanType: z.string().optional(),
  assignedStaffId: z.string().min(1, 'Please assign a staff member.'),
  customerType: z.enum(['existing', 'new']),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
  alternativeNumber: z.string().optional(),
  idNumber: z.string().min(1, "ID number is required."),
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

const approvalSchema = z.object({
    disbursementDate: z.string().min(1, 'Disbursement date is required.'),
    principalAmount: z.coerce.number().min(1, 'Principal amount is required.'),
    interestRate: z.coerce.number().min(0, 'Interest rate is required.'),
    processingFee: z.coerce.number().min(0, 'Processing fee is required.'),
    registrationFee: z.coerce.number().optional(),
    carTrackInstallationFee: z.coerce.number().optional(),
    chargingCost: z.coerce.number().optional(),
    numberOfInstalments: z.coerce.number().int().min(1, 'Number of instalments is required.'),
    paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
    idNumber: z.string().min(1, "ID number is required."),
    alternativeNumber: z.string().optional(),
    assignedStaffId: z.string().min(1, 'Please assign a staff member.'),
});


interface Customer {
  id: string;
  name: string;
  phone: string;
  idNumber?: string;
}

interface Staff {
    id: string;
    uid: string;
    name: string;
    role: string;
}

interface Loan {
    id: string;
    customerId: string;
    loanNumber: string;
    customerName: string;
    customerPhone: string;
    alternativeNumber?: string;
    idNumber?: string;
    assignedStaffId?: string;
    assignedStaffName?: string;
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
}


export default function LoansPage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [applicationToManage, setApplicationToManage] = useState<Loan | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isSuperAdmin = user?.email === 'simon@pezeka.com';
  const isFinance = user?.role === 'finance';
  const isStaff = user?.role === 'staff';
  
  const isAuthorized = isSuperAdmin || isFinance || isStaff;
  const canAdd = isSuperAdmin || isFinance;

  const { data: customers, loading: customersLoading } = useCollection<Customer>(isAuthorized ? 'customers' : null);
  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: staffList, loading: staffLoading } = useCollection<Staff>(isAuthorized ? 'users' : null);

  const filteredLoans = useMemo(() => {
    if (!loans) return [];
    // Only show loans that aren't pending applications or rejected in the "All Loans" tab
    return loans.filter(loan => {
        if (loan.status === 'application' || loan.status === 'rejected') return false;
        
        const statusMatch = statusFilter === 'all' || loan.status === statusFilter;
        const searchMatch = searchTerm === '' ||
            loan.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.customerPhone.includes(searchTerm) ||
            loan.idNumber?.includes(searchTerm) ||
            loan.assignedStaffName?.toLowerCase().includes(searchTerm.toLowerCase());
        return statusMatch && searchMatch;
    });
  }, [loans, searchTerm, statusFilter]);
  
  const applicationLoans = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => loan.status === 'application').sort((a, b) => b.disbursementDate.seconds - a.disbursementDate.seconds);
  }, [loans]);


  const form = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      customerId: '',
      principalAmount: 0,
      interestRate: 0,
      registrationFee: 0,
      processingFee: 0,
      carTrackInstallationFee: 0,
      chargingCost: 0,
      numberOfInstalments: 1,
      paymentFrequency: 'monthly',
      status: 'active',
      customerType: 'existing',
      loanType: 'Quick Pesa',
      newCustomerName: '',
      newCustomerPhone: '',
      alternativeNumber: '',
      idNumber: '',
      assignedStaffId: '',
      disbursementDate: format(new Date(), 'yyyy-MM-dd')
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
        const newCustomerData = { name: values.newCustomerName!, phone: values.newCustomerPhone!, idNumber: values.idNumber };
        const newCustomerDocRef = await addCustomer(firestore, newCustomerData);
        customerId = newCustomerDocRef.id;
        customerName = newCustomerData.name;
        customerPhone = newCustomerData.phone;
      } else {
        const selectedCustomer = customers?.find(c => c.id === customerId);
        if (!selectedCustomer) throw new Error("Selected customer not found.");
        customerName = selectedCustomer.name;
        customerPhone = selectedCustomer.phone;
      }
      
      const assignedStaff = staffList?.find(s => s.uid === values.assignedStaffId);
      
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
        alternativeNumber: values.alternativeNumber || "",
        idNumber: values.idNumber,
        assignedStaffId: values.assignedStaffId,
        assignedStaffName: assignedStaff?.name || "Unknown",
        disbursementDate: new Date(values.disbursementDate),
        totalRepayableAmount,
        instalmentAmount,
        totalPaid: 0,
      };
      
      delete (loanData as any).customerType;
      delete (loanData as any).newCustomerName;
      delete (loanData as any).newCustomerPhone;
      
      await addLoan(firestore, loanData);

      toast({ title: 'Loan Added', description: `Loan has been disbursed successfully.` });
      form.reset();
      setOpen(false);

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  const approvalForm = useForm<z.infer<typeof approvalSchema>>({
      resolver: zodResolver(approvalSchema),
      defaultValues: {
        disbursementDate: format(new Date(), 'yyyy-MM-dd'),
        principalAmount: 0,
        interestRate: 0,
        processingFee: 0,
        registrationFee: 0,
        carTrackInstallationFee: 0,
        chargingCost: 0,
        numberOfInstalments: 1,
        paymentFrequency: 'monthly',
        idNumber: '',
        alternativeNumber: '',
        assignedStaffId: '',
      }
  });

  const handleManageApplication = (loan: Loan) => {
      setApplicationToManage(loan);
      approvalForm.reset({
          disbursementDate: format(new Date(), 'yyyy-MM-dd'),
          principalAmount: loan.principalAmount,
          interestRate: loan.interestRate || 0,
          processingFee: loan.processingFee || 0,
          registrationFee: loan.registrationFee || 0,
          carTrackInstallationFee: loan.carTrackInstallationFee || 0,
          chargingCost: loan.chargingCost || 0,
          numberOfInstalments: loan.numberOfInstalments || 1,
          paymentFrequency: loan.paymentFrequency || 'monthly',
          idNumber: loan.idNumber || "",
          alternativeNumber: loan.alternativeNumber || "",
          assignedStaffId: loan.assignedStaffId || "",
      });
  };

  const onApproveSubmit = async (values: z.infer<typeof approvalSchema>) => {
    if (!applicationToManage) return;
    setIsUpdatingStatus(true);
    try {
        const assignedStaff = staffList?.find(s => s.uid === values.assignedStaffId);
        const updateData = {
            ...values,
            assignedStaffId: values.assignedStaffId,
            assignedStaffName: assignedStaff?.name || "Unknown",
            disbursementDate: new Date(values.disbursementDate),
        };
        await approveLoanApplication(firestore, applicationToManage, updateData);
        toast({ title: 'Application Approved' });
        setApplicationToManage(null);
    } catch (error: any) {
        toast({ variant: "destructive", title: "Approval Failed", description: error.message });
    } finally {
        setIsUpdatingStatus(false);
    }
  };

  const handleReject = async () => {
      if (!applicationToManage) return;
      setIsUpdatingStatus(true);
      try {
          await updateLoan(firestore, applicationToManage.id, { status: 'rejected' });
          toast({ title: 'Application Rejected' });
          setApplicationToManage(null);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
      } finally {
          setIsUpdatingStatus(false);
      }
  };
  
  if (!isAuthorized && !userLoading) {
      return (
          <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
              <h2 className="text-xl font-semibold">Access Restricted</h2>
          </div>
      );
  }

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
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="existing" /></FormControl><FormLabel className="font-normal">Existing</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="new" /></FormControl><FormLabel className="font-normal">New</FormLabel></FormItem>
                          </RadioGroup>
                        </FormItem>
                      )}
                    />
                    {customerType === 'existing' ? (
                      <FormField control={form.control} name="customerId" render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Customer</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                      )} />
                    ) : (
                      <>
                        <FormField control={form.control} name="newCustomerName" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                        <FormField control={form.control} name="newCustomerPhone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                      </>
                    )}
                    <FormField control={form.control} name="idNumber" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>ID Number</FormLabel><FormControl><Input placeholder="Customer ID number" {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)} />
                    <FormField control={form.control} name="alternativeNumber" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Alternative Number</FormLabel><FormControl><Input placeholder="Secondary contact" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                    
                    <FormField control={form.control} name="assignedStaffId" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Assign Staff Follow-up</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name} ({s.role})</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="loanType" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Loan Product</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="Quick Pesa">Quick Pesa</SelectItem>
                              <SelectItem value="Individual & Business Loan">Individual & Business Loan</SelectItem>
                              <SelectItem value="Salary Advance Loan">Salary Advance Loan</SelectItem>
                              <SelectItem value="Logbook Loan">Logbook Loan</SelectItem>
                              <SelectItem value="Staff Loan">Staff Loan</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="disbursementDate" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                    <FormField control={form.control} name="principalAmount" render={({ field }) => (<FormItem><FormLabel>Principal</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                    <FormField control={form.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Interest %</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                    <FormField control={form.control} name="numberOfInstalments" render={({ field }) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                    <FormField control={form.control} name="paymentFrequency" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <div className="col-span-2 space-y-2 rounded-md bg-muted p-4">
                      <div className="flex justify-between"><span className="text-sm">Instalment</span><span className="font-bold">Ksh {calculatedValues.instalmentAmount}</span></div>
                      <div className="flex justify-between"><span className="text-sm">Total</span><span className="font-bold">Ksh {calculatedValues.totalRepayableAmount}</span></div>
                    </div>
                  </form>
                </ScrollArea>
                <DialogFooter className="mt-4">
                  <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                  <Button type="submit" form="add-loan-form" disabled={isSubmitting}>Disburse</Button>
                </DialogFooter>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
            <TabsTrigger value="all">Active Debt ({filteredLoans.length})</TabsTrigger>
            <TabsTrigger value="applications">Pending Applications ({applicationLoans.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Portfolio Ledger</CardTitle>
                    <div className="relative"><Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-[250px]" /></div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh]">
                      <Table>
                          <TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Customer</TableHead><TableHead>Staff Assigned</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
                          <TableBody>
                              {filteredLoans.map((loan) => (
                                  <TableRow key={loan.id}>
                                      <TableCell className="font-medium">{loan.loanNumber}</TableCell>
                                      <TableCell>
                                          <div>{loan.customerName}</div>
                                          <div className="text-[10px] text-muted-foreground">ID: {loan.idNumber || "N/A"}</div>
                                      </TableCell>
                                      <TableCell>
                                          <div className="flex items-center gap-1">
                                              <User className="h-3 w-3 text-muted-foreground" />
                                              <span className="text-sm">{loan.assignedStaffName || "Unassigned"}</span>
                                          </div>
                                      </TableCell>
                                      <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'dd/MM/yy')}</TableCell>
                                      <TableCell className="text-right font-bold">{(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}</TableCell>
                                      <TableCell className="text-center"><Badge variant={loan.status === 'paid' ? 'default' : (loan.status === 'due' || loan.status === 'overdue') ? 'destructive' : 'secondary'}>{loan.status}</Badge></TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="applications">
            <Card>
                <CardHeader><CardTitle>Review Applications</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {applicationLoans.map((loan) => (
                                <TableRow key={loan.id} className="cursor-pointer" onClick={() => handleManageApplication(loan)}>
                                    <TableCell>
                                        <div>{loan.customerName}</div>
                                        <div className="text-[10px] text-muted-foreground">ID: {loan.idNumber || "N/A"}</div>
                                    </TableCell>
                                    <TableCell>{loan.loanType}</TableCell>
                                    <TableCell className="font-bold">Ksh {loan.principalAmount.toLocaleString()}</TableCell>
                                    <TableCell><Button size="sm">Process</Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!applicationToManage} onOpenChange={(isOpen) => !isOpen && setApplicationToManage(null)}>
        <DialogContent className="sm:max-w-2xl">
            {applicationToManage && (
                <>
                    <DialogHeader><DialogTitle>Process Application #{applicationToManage.loanNumber}</DialogTitle></DialogHeader>
                    <Form {...approvalForm}>
                        <form id="approval-form" onSubmit={approvalForm.handleSubmit(onApproveSubmit)} className="grid grid-cols-2 gap-4 mt-4">
                            <FormField control={approvalForm.control} name="disbursementDate" render={({field}) => (<FormItem className="col-span-2"><FormLabel>Approved Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                            <FormField control={approvalForm.control} name="idNumber" render={({field}) => (<FormItem className="col-span-2"><FormLabel>Verify ID Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)} />
                            <FormField control={approvalForm.control} name="alternativeNumber" render={({field}) => (<FormItem className="col-span-2"><FormLabel>Alternative Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                            
                            <FormField control={approvalForm.control} name="assignedStaffId" render={({ field }) => (
                                <FormItem className="col-span-2">
                                  <FormLabel>Assign Staff for Follow-up</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name} ({s.role})</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={approvalForm.control} name="principalAmount" render={({field}) => (<FormItem><FormLabel>Approved Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                            <FormField control={approvalForm.control} name="interestRate" render={({field}) => (<FormItem><FormLabel>Interest %</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                            <FormField control={approvalForm.control} name="processingFee" render={({field}) => (<FormItem><FormLabel>Proc Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                            <FormField control={approvalForm.control} name="registrationFee" render={({field}) => (<FormItem><FormLabel>Reg Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                            <FormField control={approvalForm.control} name="numberOfInstalments" render={({field}) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                            <FormField control={approvalForm.control} name="paymentFrequency" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Frequency</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                        </form>
                    </Form>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setApplicationToManage(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject}>Reject</Button>
                        <Button type="submit" form="approval-form">Approve & Disburse</Button>
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
