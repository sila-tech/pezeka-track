'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Search, User, Eye, Plus, AlertCircle, ShieldCheck, MessageSquare, Pencil, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
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
import { 
  addLoan, 
  addCustomer, 
  updateLoan, 
  approveLoanApplication, 
  addPenaltyToLoan, 
  addFollowUpNoteToLoan, 
  rolloverLoan 
} from '@/lib/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, addDays, addWeeks, addMonths, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { calculateAmortization, calculateInterestForOneInstalment } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { arrayUnion, increment, doc, collection } from 'firebase/firestore';


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

const editTermsSchema = z.object({
    interestRate: z.coerce.number().min(0, 'Interest rate must be a positive number.'),
    principalAmount: z.coerce.number().min(1, 'Principal amount is required.'),
    numberOfInstalments: z.coerce.number().int().min(1),
    paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
});

const paymentSchema = z.object({
    paymentAmount: z.coerce.number().min(0.01, 'Payment amount must be greater than 0.'),
    paymentDate: z.string().min(1, 'Payment date is required.'),
});

const penaltySchema = z.object({
    penaltyAmount: z.coerce.number().min(0.01, 'Penalty amount must be greater than 0.'),
    penaltyDate: z.string().min(1, 'Penalty date is required.'),
    penaltyDescription: z.string().min(1, 'A description for the penalty is required.'),
});

const followUpNoteSchema = z.object({
    content: z.string().min(5, "Note must be at least 5 characters long."),
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
    email?: string;
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
    disbursementDate: { seconds: number, nanoseconds: number } | Date;
    principalAmount: number;
    interestRate?: number;
    status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
    totalRepayableAmount: number;
    totalPaid: number;
    totalPenalties?: number;
    instalmentAmount: number;
    paymentFrequency: 'daily' | 'weekly' | 'monthly';
    numberOfInstalments: number;
    registrationFee: number;
    processingFee: number;
    carTrackInstallationFee: number;
    chargingCost: number;
    comments?: string;
    payments?: { paymentId: string; date: any; amount: number; }[];
    penalties?: { penaltyId: string; date: any; amount: number; description: string; }[];
    followUpNotes?: { noteId: string; date: any; staffName: string; staffId: string; content: string; }[];
}


export default function LoansPage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [applicationToManage, setApplicationToManage] = useState<Loan | null>(null);
  const [viewingApplication, setViewingApplication] = useState<Loan | null>(null);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingPenalty, setIsAddingPenalty] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isEditingTerms, setIsEditingTerms] = useState(false);

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isSuperAdmin = user?.email === 'simon@pezeka.com';
  const isFinance = user?.role === 'finance';
  const isStaff = user?.role === 'staff';
  
  const isAuthorized = isSuperAdmin || isFinance || isStaff;
  const canAdd = isAuthorized;

  const { data: customers, loading: customersLoading } = useCollection<Customer>(isAuthorized ? 'customers' : null);
  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: staffList, loading: staffLoading } = useCollection<Staff>(isAuthorized ? 'users' : null);

  const filteredLoans = useMemo(() => {
    if (!loans) return [];
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
    return loans.filter(loan => loan.status === 'application').sort((a, b) => (b.disbursementDate as any).seconds - (a.disbursementDate as any).seconds);
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

  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: format(new Date(), 'yyyy-MM-dd'), paymentAmount: 0 }
  });

  const penaltyForm = useForm<z.infer<typeof penaltySchema>>({
    resolver: zodResolver(penaltySchema),
    defaultValues: { penaltyDate: format(new Date(), 'yyyy-MM-dd'), penaltyAmount: 0, penaltyDescription: '' }
  });

  const noteForm = useForm<z.infer<typeof followUpNoteSchema>>({
      resolver: zodResolver(followUpNoteSchema),
      defaultValues: { content: '' },
  });

  const editTermsForm = useForm<z.infer<typeof editTermsSchema>>({
      resolver: zodResolver(editTermsSchema),
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
      
      const assignedStaff = staffList?.find(s => (s.uid || s.id) === values.assignedStaffId);
      
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
        assignedStaffName: assignedStaff?.name || assignedStaff?.email || "Unknown",
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
        const assignedStaff = staffList?.find(s => (s.uid || s.id) === values.assignedStaffId);
        const updateData = {
            ...values,
            assignedStaffId: values.assignedStaffId,
            assignedStaffName: assignedStaff?.name || assignedStaff?.email || "Unknown",
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

  async function onRecordPayment(values: z.infer<typeof paymentSchema>) {
    if (!loanToEdit) return;
    setIsUpdating(true);
    try {
        const paymentId = doc(collection(firestore, 'payments')).id;
        await updateLoan(firestore, loanToEdit.id, { 
          totalPaid: increment(values.paymentAmount), 
          payments: arrayUnion({ paymentId, amount: values.paymentAmount, date: new Date(values.paymentDate) }) 
        });
        toast({ title: 'Payment Recorded' });
        paymentForm.reset();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); } finally { setIsUpdating(false); }
  }

  async function onAddPenalty(values: z.infer<typeof penaltySchema>) {
    if (!loanToEdit) return;
    setIsAddingPenalty(true);
    try {
        await addPenaltyToLoan(firestore, loanToEdit.id, { amount: values.penaltyAmount, date: new Date(values.penaltyDate), description: values.penaltyDescription });
        toast({ title: 'Penalty Added' });
        penaltyForm.reset();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); } finally { setIsAddingPenalty(false); }
  }

  async function onAddNoteSubmit(values: z.infer<typeof followUpNoteSchema>) {
      if (!loanToEdit || !user) return;
      setIsAddingNote(true);
      try {
          await addFollowUpNoteToLoan(firestore, loanToEdit.id, { content: values.content, staffName: user.name || user.email?.split('@')[0] || "Staff", staffId: user.uid });
          toast({ title: "Note Added" });
          noteForm.reset();
      } catch (e: any) { toast({ variant: 'destructive', title: 'Action Failed', description: e.message }); } finally { setIsAddingNote(false); }
  }

  const handleEditTerms = (loan: Loan) => {
      editTermsForm.reset({
          interestRate: loan.interestRate || 0,
          principalAmount: loan.principalAmount,
          numberOfInstalments: loan.numberOfInstalments,
          paymentFrequency: loan.paymentFrequency,
      });
      setIsEditingTerms(true);
  };

  async function onEditTermsSubmit(values: z.infer<typeof editTermsSchema>) {
      if (!loanToEdit) return;
      setIsUpdating(true);
      try {
          const { instalmentAmount, totalRepayableAmount } = calculateAmortization(
              values.principalAmount,
              values.interestRate,
              values.numberOfInstalments,
              values.paymentFrequency
          );
          
          const updateData = {
              ...values,
              instalmentAmount,
              totalRepayableAmount: totalRepayableAmount + (loanToEdit.totalPenalties || 0),
          };

          await updateLoan(firestore, loanToEdit.id, updateData);
          toast({ title: 'Loan Terms Updated' });
          setLoanToEdit({ ...loanToEdit, ...updateData });
          setIsEditingTerms(false);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
      } finally {
          setIsUpdating(false);
      }
  }

  const handleStaffReassignment = async (staffId: string) => {
      if (!loanToEdit) return;
      let updateData: any = {};
      if (staffId === 'unassigned') updateData = { assignedStaffId: "", assignedStaffName: "" };
      else {
          const staffMember = staffList?.find((s: any) => (s.id) === staffId);
          if (!staffMember) return;
          updateData = { assignedStaffId: staffId, assignedStaffName: staffMember.name || staffMember.email };
      }
      try {
          await updateLoan(firestore, loanToEdit.id, updateData);
          toast({ title: 'Staff Re-assigned' });
          setLoanToEdit({ ...loanToEdit, ...updateData });
      } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); }
  };

  const penaltyCalculation = useMemo(() => {
      if (!loanToEdit) return { dailyRate: 0, daysLate: 0, suggested: 0 };
      const oneInstInterest = calculateInterestForOneInstalment(loanToEdit.principalAmount, loanToEdit.interestRate || 0, loanToEdit.numberOfInstalments, loanToEdit.paymentFrequency);
      const daysInFreq = loanToEdit.paymentFrequency === 'monthly' ? 30 : (loanToEdit.paymentFrequency === 'weekly' ? 7 : 1);
      const dailyRate = oneInstInterest / daysInFreq;
      
      let dDate: Date;
      if (loanToEdit.disbursementDate instanceof Date) dDate = loanToEdit.disbursementDate;
      else dDate = new Date((loanToEdit.disbursementDate as any).seconds * 1000);

      let finalDueDate: Date;
      if (loanToEdit.paymentFrequency === 'monthly') finalDueDate = addMonths(dDate, loanToEdit.numberOfInstalments);
      else if (loanToEdit.paymentFrequency === 'weekly') finalDueDate = addWeeks(dDate, loanToEdit.numberOfInstalments);
      else finalDueDate = addDays(dDate, loanToEdit.numberOfInstalments);
      
      const daysLate = differenceInDays(new Date(), finalDueDate);
      const validDaysLate = daysLate > 0 ? daysLate : 0;
      return { dailyRate, daysLate: validDaysLate, suggested: Math.round(validDaysLate * dailyRate) };
  }, [loanToEdit]);

  const authorizeSuggestedPenalty = () => {
      if (!penaltyCalculation.suggested) return;
      penaltyForm.setValue('penaltyAmount', penaltyCalculation.suggested);
      penaltyForm.setValue('penaltyDate', format(new Date(), 'yyyy-MM-dd'));
      penaltyForm.setValue('penaltyDescription', `Late Payment Penalty: ${penaltyCalculation.daysLate} days overdue.`);
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
                <DialogDescription>Input specific terms to disburse a new credit facility.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <ScrollArea className="max-h-[65vh] pr-4">
                  <form id="add-loan-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4 py-2">
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
                              {staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email} ({s.role})</SelectItem>)}
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
                    <FormField control={form.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Interest %</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
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
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle>Portfolio Ledger</CardTitle>
                    <div className="relative"><Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-[250px]" /></div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh]">
                      <Table>
                          <TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Customer</TableHead><TableHead>Staff Assigned</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
                          <TableBody>
                              {filteredLoans.map((loan) => (
                                  <TableRow key={loan.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setLoanToEdit(loan)}>
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
                                      <TableCell>{format(new Date((loan.disbursementDate as any).seconds * 1000), 'dd/MM/yy')}</TableCell>
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
                        <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {applicationLoans.map((loan) => (
                                <TableRow key={loan.id}>
                                    <TableCell>
                                        <div>{loan.customerName}</div>
                                        <div className="text-[10px] text-muted-foreground">ID: {loan.idNumber || "N/A"}</div>
                                    </TableCell>
                                    <TableCell>{loan.loanType}</TableCell>
                                    <TableCell className="font-bold">Ksh {loan.principalAmount.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => setViewingApplication(loan)}>
                                                <Eye className="h-4 w-4 mr-1" /> View
                                            </Button>
                                            <Button size="sm" onClick={() => handleManageApplication(loan)}>Process</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* View Application Dialog */}
      <Dialog open={!!viewingApplication} onOpenChange={(isOpen) => !isOpen && setViewingApplication(null)}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Application Details</DialogTitle>
                  <DialogDescription>Full summary of the customer's self-submitted application.</DialogDescription>
              </DialogHeader>
              {viewingApplication && (
                  <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-muted-foreground">Customer:</div>
                          <div className="font-medium">{viewingApplication.customerName}</div>
                          <div className="text-muted-foreground">Primary Phone:</div>
                          <div className="font-medium">{viewingApplication.customerPhone}</div>
                          <div className="text-muted-foreground">Alt. Phone:</div>
                          <div className="font-medium">{viewingApplication.alternativeNumber || 'None'}</div>
                          <div className="text-muted-foreground">National ID:</div>
                          <div className="font-medium">{viewingApplication.idNumber || 'N/A'}</div>
                          <div className="text-muted-foreground">Loan Product:</div>
                          <div className="font-medium">{viewingApplication.loanType}</div>
                          <div className="text-muted-foreground">Requested Amount:</div>
                          <div className="font-bold text-primary">Ksh {viewingApplication.principalAmount.toLocaleString()}</div>
                          <div className="text-muted-foreground">Submitted On:</div>
                          <div className="font-medium">{format(new Date((viewingApplication.disbursementDate as any).seconds * 1000), 'PPP')}</div>
                      </div>
                      {viewingApplication.comments && (
                          <div className="pt-4 border-t">
                              <h4 className="text-xs font-bold uppercase text-muted-foreground mb-1">Customer Comments:</h4>
                              <p className="text-sm italic">"{viewingApplication.comments}"</p>
                          </div>
                      )}
                  </div>
              )}
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                  <Button onClick={() => {
                      const app = viewingApplication;
                      setViewingApplication(null);
                      if (app) handleManageApplication(app);
                  }}>Process Application</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Process/Approve Dialog */}
      <Dialog open={!!applicationToManage} onOpenChange={(isOpen) => !isOpen && setApplicationToManage(null)}>
        <DialogContent className="sm:max-w-2xl">
            {applicationToManage && (
                <>
                    <DialogHeader>
                        <DialogTitle>Process Application #{applicationToManage.loanNumber}</DialogTitle>
                        <DialogDescription>Finalize terms and assign a follow-up staff member before disbursement.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[65vh] pr-4">
                        <Form {...approvalForm}>
                            <form id="approval-form" onSubmit={approvalForm.handleSubmit(onApproveSubmit)} className="grid grid-cols-2 gap-4 mt-4 py-2">
                                <FormField control={approvalForm.control} name="disbursementDate" render={({field}) => (<FormItem className="col-span-2"><FormLabel>Approved Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                                <FormField control={approvalForm.control} name="idNumber" render={({field}) => (<FormItem className="col-span-2"><FormLabel>Verify ID Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)} />
                                <FormField control={approvalForm.control} name="alternativeNumber" render={({field}) => (<FormItem className="col-span-2"><FormLabel>Alternative Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                                
                                <FormField control={approvalForm.control} name="assignedStaffId" render={({ field }) => (
                                    <FormItem className="col-span-2">
                                      <FormLabel>Assign Staff for Follow-up</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                          {staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email} ({s.role})</SelectItem>)}
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
                    </ScrollArea>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setApplicationToManage(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject}>Reject</Button>
                        <Button type="submit" form="approval-form" disabled={isUpdatingStatus}>
                            {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Approve & Disburse
                        </Button>
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>

      {/* Management Dialog for Existing Loans */}
      <Dialog open={!!loanToEdit} onOpenChange={(isOpen) => !isOpen && setLoanToEdit(null)}>
          <DialogContent className="sm:max-w-5xl">
              {loanToEdit && (
                  <>
                    <DialogHeader>
                        <DialogTitle>Manage Loan #{loanToEdit.loanNumber}</DialogTitle>
                        <DialogDescription>Review interactions, record payments, and track the recovery history.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[75vh]">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
                            <div className="space-y-4 md:col-span-1">
                                <Card>
                                    <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
                                        <CardTitle className="text-sm">Loan Summary</CardTitle>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditTerms(loanToEdit)}><Pencil className="h-3 w-3" /></Button>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        <div className="flex justify-between"><span>Customer:</span><span className="font-medium">{loanToEdit.customerName}</span></div>
                                        <div className="flex justify-between"><span>Rate:</span><span className="font-medium">{loanToEdit.interestRate}%</span></div>
                                        <div className="space-y-1.5 pt-2 border-t">
                                            <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">Follow-up Reassignment:</span>
                                            <Select value={loanToEdit.assignedStaffId || "unassigned"} onValueChange={handleStaffReassignment}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assign Staff" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                                    {staffList?.map((s: any) => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex justify-between border-t pt-2"><span>Principal:</span><span className="font-medium">Ksh {loanToEdit.principalAmount.toLocaleString()}</span></div>
                                        <div className="flex justify-between"><span>Remaining:</span><span className="font-bold text-destructive">Ksh {(loanToEdit.totalRepayableAmount - loanToEdit.totalPaid).toLocaleString()}</span></div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="py-3"><CardTitle className="text-sm">Collection Actions</CardTitle></CardHeader>
                                    <CardContent className="space-y-2">
                                        <Button variant="outline" className="w-full text-xs" onClick={() => rolloverLoan(firestore, loanToEdit, new Date()).then(() => { toast({ title: 'Loan Rolled Over' }); setLoanToEdit(null); })}>Perform Rollover</Button>
                                        <Button variant="secondary" className="w-full text-xs" onClick={() => updateLoan(firestore, loanToEdit.id, { status: 'paid' }).then(() => { toast({ title: 'Marked as Paid' }); setLoanToEdit(null); })}>Mark as Fully Paid</Button>
                                    </CardContent>
                                </Card>
                            </div>
                            
                            <div className="md:col-span-2 space-y-6">
                                <Tabs defaultValue="payments">
                                    <TabsList className="grid grid-cols-3 w-full">
                                        <TabsTrigger value="payments">Payments</TabsTrigger>
                                        <TabsTrigger value="followups">Follow-ups</TabsTrigger>
                                        <TabsTrigger value="penalties">Penalties</TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="payments">
                                        <Form {...paymentForm}>
                                            <form onSubmit={paymentForm.handleSubmit(onRecordPayment)} className="space-y-4 mb-4">
                                                <div className="flex gap-2">
                                                    <FormField control={paymentForm.control} name="paymentAmount" render={({field}) => (<Input type="number" placeholder="Amt" {...field} value={field.value ?? ''}/>)} />
                                                    <FormField control={paymentForm.control} name="paymentDate" render={({field}) => (<Input type="date" {...field} value={field.value ?? ''}/>)} />
                                                    <Button type="submit" disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin h-4 w-4"/> : 'Pay'}</Button>
                                                </div>
                                            </form>
                                        </Form>
                                        <ScrollArea className="h-64 border rounded-md">
                                            <Table>
                                                <TableBody>
                                                    {loanToEdit.payments?.map((p, i) => (
                                                        <TableRow key={p.paymentId || i}>
                                                            <TableCell className="text-xs">{format(new Date((p.date as any).seconds * 1000), 'dd/MM/yy HH:mm')}</TableCell>
                                                            <TableCell className="text-right font-medium">Ksh {p.amount.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </TabsContent>

                                    <TabsContent value="followups">
                                        <Form {...noteForm}>
                                            <form onSubmit={noteForm.handleSubmit(onAddNoteSubmit)} className="space-y-3 mb-4">
                                                <FormField control={noteForm.control} name="content" render={({field}) => (<FormItem><FormControl><Textarea placeholder="Add interaction note..." className="h-20" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)}/>
                                                <Button type="submit" className="w-full" size="sm" disabled={isAddingNote}>{isAddingNote ? <Loader2 className="animate-spin h-4 w-4"/> : <Plus className="h-4 w-4 mr-2" />}Add Interaction Note</Button>
                                            </form>
                                        </Form>
                                        <ScrollArea className="h-64 border rounded-md p-3">
                                            <div className="space-y-3">
                                                {(!loanToEdit.followUpNotes || loanToEdit.followUpNotes.length === 0) ? (<p className="text-xs text-muted-foreground text-center py-8">No interaction history recorded.</p>) : (
                                                    [...loanToEdit.followUpNotes].reverse().map((note, index) => (
                                                        <div key={note.noteId || index} className="bg-muted p-2 rounded border text-[11px]">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-bold flex items-center gap-1"><User className="h-2 w-2" /> {note.staffName}</span>
                                                                <span className="text-[9px] text-muted-foreground">{format(new Date((note.date as any).seconds * 1000), 'dd/MM/yy HH:mm')}</span>
                                                            </div>
                                                            <p className="italic">"{note.content}"</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>

                                    <TabsContent value="penalties">
                                        {penaltyCalculation.daysLate > 0 && (
                                            <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-4 space-y-2">
                                                <div className="flex items-center gap-2 text-orange-800 font-bold text-xs uppercase tracking-wider"><AlertCircle className="h-4 w-4" />Overdue Penalty Detected</div>
                                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                    <div>Days Overdue: <span className="font-bold">{penaltyCalculation.daysLate}</span></div>
                                                    <div className="col-span-2 pt-1 border-t border-orange-100">Total Suggested Penalty: <span className="text-sm font-bold text-destructive">Ksh {penaltyCalculation.suggested.toLocaleString()}</span></div>
                                                </div>
                                                <Button size="sm" variant="secondary" className="w-full h-8 text-[11px]" onClick={authorizeSuggestedPenalty}><ShieldCheck className="h-3 w-3 mr-2" />Authorize & Fill Form</Button>
                                            </div>
                                        )}
                                        <Form {...penaltyForm}>
                                            <form onSubmit={penaltyForm.handleSubmit(onAddPenalty)} className="space-y-2 mb-4">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <FormField control={penaltyForm.control} name="penaltyAmount" render={({field}) => (<Input type="number" placeholder="Amt" {...field} value={field.value ?? ''}/>)} />
                                                    <FormField control={penaltyForm.control} name="penaltyDate" render={({field}) => (<Input type="date" {...field} value={field.value ?? ''}/>)} />
                                                </div>
                                                <FormField control={penaltyForm.control} name="penaltyDescription" render={({field}) => (<Input placeholder="Reason" {...field} value={field.value ?? ''}/>)} />
                                                <Button type="submit" variant="destructive" className="w-full" disabled={isAddingPenalty}>{isAddingPenalty ? <Loader2 className="animate-spin h-4 w-4"/> : 'Record Penalty'}</Button>
                                            </form>
                                        </Form>
                                        <ScrollArea className="h-64 border rounded-md">
                                            <Table>
                                                <TableBody>
                                                    {loanToEdit.penalties?.map((p, i) => (
                                                        <TableRow key={p.penaltyId || i}>
                                                            <TableCell><div className="text-[10px]">{format(new Date((p.date as any).seconds * 1000), 'dd/MM/yy')}</div><div className="font-medium text-xs">{p.description}</div></TableCell>
                                                            <TableCell className="text-right text-destructive font-bold text-xs">Ksh {p.amount.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>

      {/* Edit Terms Dialog */}
      <Dialog open={isEditingTerms} onOpenChange={setIsEditingTerms}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Update Loan Terms</DialogTitle>
                  <DialogDescription>Changing interest rate or principal will trigger an automatic recalculation of instalments.</DialogDescription>
              </DialogHeader>
              <Form {...editTermsForm}>
                  <form onSubmit={editTermsForm.handleSubmit(onEditTermsSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={editTermsForm.control} name="principalAmount" render={({field}) => (<FormItem><FormLabel>Principal</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                          <FormField control={editTermsForm.control} name="interestRate" render={({field}) => (<FormItem><FormLabel>Interest Rate (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field}/></FormControl></FormItem>)}/>
                          <FormField control={editTermsForm.control} name="numberOfInstalments" render={({field}) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                          <FormField control={editTermsForm.control} name="paymentFrequency" render={({field}) => (
                              <FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></FormItem>
                          )}/>
                      </div>
                      <Button type="submit" className="w-full" disabled={isUpdating}>
                          {isUpdating && <Loader2 className="mr-2 animate-spin" />} Save & Recalculate
                      </Button>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>
    </div>
  );
}
