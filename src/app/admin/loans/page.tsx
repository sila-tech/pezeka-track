
'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Search, User, Eye, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { getDoc } from 'firebase/firestore';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  addLoan, 
  addCustomer, 
  updateLoan, 
  approveLoanApplication, 
  addPenaltyToLoan, 
  rolloverLoan,
  deleteLoan,
  recordLoanPayment,
  type Loan
} from '@/lib/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, addDays, addWeeks, addMonths, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { calculateAmortization, calculateInterestForOneInstalment } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const DAYS_OF_WEEK = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const loanSchema = z.object({
  customerId: z.string().optional(),
  disbursementDate: z.string().min(1, 'Disbursement date is required.'),
  firstPaymentDate: z.string().min(1, 'First payment date is required.'),
  preferredPaymentDay: z.string().optional(),
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
    if (!data.newCustomerName) ctx.addIssue({ code: 'custom', message: 'New customer name is required.', path: ['newCustomerName'] });
    if (!data.newCustomerPhone) ctx.addIssue({ code: 'custom', message: 'New customer phone is required.', path: ['newCustomerPhone'] });
  }
});

const approvalSchema = z.object({
    disbursementDate: z.string().min(1, 'Disbursement date is required.'),
    firstPaymentDate: z.string().min(1, 'First payment date is required.'),
    preferredPaymentDay: z.string().optional(),
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
    preferredPaymentDay: z.string().optional(),
    assignedStaffId: z.string().min(1, 'Please assign a staff member.'),
    disbursementDate: z.string().min(1, 'Disbursement date is required.'),
    firstPaymentDate: z.string().min(1, 'First payment date is required.'),
    totalRepayableAmount: z.coerce.number().min(0, 'Amount to pay is required'),
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

interface Customer {
  id: string;
  name: string;
  phone: string;
  idNumber?: string;
  accountNumber?: string;
}

interface Staff {
    id: string;
    uid: string;
    name: string;
    role: string;
    email?: string;
}


export default function LoansPage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [applicationToManage, setApplicationToManage] = useState<Loan | null>(null);
  const [viewingApplication, setViewingApplication] = useState<Loan | null>(null);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingPenalty, setIsAddingPenalty] = useState(false);
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isSuperAdmin = user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
  const userRole = user?.role?.toLowerCase();
  const isFinance = userRole === 'finance';
  const isStaff = userRole === 'staff';
  
  const isAuthorized = isSuperAdmin || isFinance || isStaff;
  const canEdit = isSuperAdmin || isFinance; 

  const { data: customers, loading: customersLoading } = useCollection<Customer>(isAuthorized ? 'customers' : null);
  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: staffList, loading: staffLoading } = useCollection<Staff>(isAuthorized ? 'users' : null);

  const filteredLoans = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => {
        if (loan.status === 'application' || loan.status === 'rejected' || loan.status === 'rollover') return false;
        
        const statusMatch = statusFilter === 'all' || loan.status === statusFilter;
        const searchMatch = searchTerm === '' ||
            loan.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.customerPhone.includes(searchTerm) ||
            loan.idNumber?.includes(searchTerm) ||
            loan.accountNumber?.includes(searchTerm);
        return statusMatch && searchMatch;
    });
  }, [loans, searchTerm, statusFilter]);
  
  const applicationLoans = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => loan.status === 'application').sort((a, b) => {
        const d1 = a.disbursementDate?.seconds ? a.disbursementDate.seconds : (a.disbursementDate ? new Date(a.disbursementDate).getTime() / 1000 : 0);
        const d2 = b.disbursementDate?.seconds ? b.disbursementDate.seconds : (b.disbursementDate ? new Date(b.disbursementDate).getTime() / 1000 : 0);
        return d2 - d1;
    });
  }, [loans]);


  const form = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      customerId: '', principalAmount: 0, interestRate: 0, registrationFee: 0, processingFee: 0, carTrackInstallationFee: 0, chargingCost: 0, numberOfInstalments: 1, paymentFrequency: 'monthly', preferredPaymentDay: '', status: 'active', customerType: 'existing', loanType: 'Quick Pesa', newCustomerName: '', newCustomerPhone: '', alternativeNumber: '', idNumber: '', assignedStaffId: '', disbursementDate: format(new Date(), 'yyyy-MM-dd'), firstPaymentDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd')
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

  const editTermsForm = useForm<z.infer<typeof editTermsSchema>>({
      resolver: zodResolver(editTermsSchema),
  });

  const { watch } = form;
  const principalAmountWatch = watch('principalAmount');
  const interestRateWatch = watch('interestRate');
  const numberOfInstalmentsWatch = watch('numberOfInstalments');
  const paymentFrequencyWatch = watch('paymentFrequency');
  const customerTypeWatch = watch('customerType');

  const calculatedValues = useMemo(() => {
    const { instalmentAmount, totalRepayableAmount } = calculateAmortization(principalAmountWatch || 0, interestRateWatch || 0, numberOfInstalmentsWatch || 0, paymentFrequencyWatch);
    return {
        instalmentAmount: instalmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        totalRepayableAmount: totalRepayableAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
    };
  }, [principalAmountWatch, interestRateWatch, numberOfInstalmentsWatch, paymentFrequencyWatch]);


  async function onSubmit(values: z.infer<typeof loanSchema>) {
    if (!canEdit) return;
    setIsSubmitting(true);
    try {
      let customerId = values.customerId;
      let customerName = '';
      let customerPhone = '';
      let accountNumber = '';

      if (values.customerType === 'new') {
        const newCustomerData = { name: values.newCustomerName!, phone: values.newCustomerPhone!, idNumber: values.idNumber };
        const newCustomerDocRef = await addCustomer(firestore, newCustomerData);
        const newSnap = await getDoc(newCustomerDocRef);
        customerId = newCustomerDocRef.id;
        customerName = newCustomerData.name;
        customerPhone = newCustomerData.phone;
        accountNumber = newSnap.data()?.accountNumber || '';
      } else {
        const selectedCustomer = customers?.find(c => c.id === customerId);
        if (!selectedCustomer) throw new Error("Selected customer not found.");
        customerName = selectedCustomer.name;
        customerPhone = selectedCustomer.phone;
        accountNumber = selectedCustomer.accountNumber || '';
      }
      
      const assignedStaff = staffList?.find(s => (s.uid || s.id) === values.assignedStaffId);
      const { instalmentAmount, totalRepayableAmount } = calculateAmortization(values.principalAmount, values.interestRate, values.numberOfInstalments, values.paymentFrequency);

      const loanData = {
        ...values, 
        customerId: customerId!, 
        customerName, 
        customerPhone, 
        accountNumber, 
        alternativeNumber: values.alternativeNumber || "", 
        idNumber: values.idNumber, 
        assignedStaffId: values.assignedStaffId, 
        assignedStaffName: assignedStaff?.name || assignedStaff?.email || "Unknown", 
        disbursementDate: new Date(values.disbursementDate), 
        firstPaymentDate: new Date(values.firstPaymentDate),
        totalRepayableAmount, 
        instalmentAmount, 
        totalPaid: 0,
      };
      
      delete (loanData as any).customerType;
      delete (loanData as any).newCustomerName;
      delete (loanData as any).newCustomerPhone;
      
      await addLoan(firestore, loanData);
      toast({ title: 'Loan Added' });
      form.reset();
      setOpen(false);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); } finally { setIsSubmitting(false); }
  }

  const approvalForm = useForm<z.infer<typeof approvalSchema>>({
      resolver: zodResolver(approvalSchema),
      defaultValues: { disbursementDate: format(new Date(), 'yyyy-MM-dd'), firstPaymentDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd'), preferredPaymentDay: '', principalAmount: 0, interestRate: 0, processingFee: 0, registrationFee: 0, carTrackInstallationFee: 0, chargingCost: 0, numberOfInstalments: 1, paymentFrequency: 'monthly', idNumber: '', alternativeNumber: '', assignedStaffId: '', }
  });

  const handleManageApplication = (loan: Loan) => {
      setApplicationToManage(loan);
      approvalForm.reset({
          disbursementDate: format(new Date(), 'yyyy-MM-dd'), 
          firstPaymentDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
          preferredPaymentDay: loan.preferredPaymentDay || '',
          principalAmount: loan.principalAmount || 0, 
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
    if (!applicationToManage || !canEdit) return;
    setIsUpdatingStatus(true);
    try {
        const assignedStaff = staffList?.find(s => (s.uid || s.id) === values.assignedStaffId);
        const updateData = { 
            ...values, 
            assignedStaffId: values.assignedStaffId, 
            assignedStaffName: assignedStaff?.name || assignedStaff?.email || "Unknown", 
            disbursementDate: new Date(values.disbursementDate),
            firstPaymentDate: new Date(values.firstPaymentDate)
        };
        await approveLoanApplication(firestore, applicationToManage, updateData);
        toast({ title: 'Application Approved' });
        setApplicationToManage(null);
    } catch (error: any) { toast({ variant: "destructive", title: "Approval Failed", description: error.message }); } finally { setIsUpdatingStatus(false); }
  };

  const handleReject = async () => {
      if (!applicationToManage || !canEdit) return;
      setIsUpdatingStatus(true);
      try {
          await updateLoan(firestore, applicationToManage.id, { status: 'rejected' });
          toast({ title: 'Application Rejected' });
          setApplicationToManage(null);
      } catch (e: any) { toast({ variant: 'destructive', title: 'Action Failed', description: e.message }); } finally { setIsUpdatingStatus(false); }
  };

  async function onRecordPayment(values: z.infer<typeof paymentSchema>) {
    if (!loanToEdit || !canEdit) return;
    setIsUpdating(true);
    try {
        await recordLoanPayment(firestore, loanToEdit.id, { 
            amount: values.paymentAmount, 
            date: new Date(values.paymentDate),
            recordedBy: user?.name || user?.email || 'Admin'
        });
        toast({ title: 'Payment Recorded', description: 'Notification sent to customer.' });
        paymentForm.reset();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); } finally { setIsUpdating(false); }
  }

  async function onAddPenalty(values: z.infer<typeof penaltySchema>) {
    if (!loanToEdit || !canEdit) return;
    setIsAddingPenalty(true);
    try {
        await addPenaltyToLoan(firestore, loanToEdit.id, { amount: values.penaltyAmount, date: new Date(values.penaltyDate), description: values.penaltyDescription });
        toast({ title: 'Penalty Added' });
        penaltyForm.reset();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); } finally { setIsAddingPenalty(false); }
  }

  const handleEditTerms = (loan: Loan) => {
      if (!canEdit) return;
      const dDate = loan.disbursementDate?.seconds 
          ? new Date(loan.disbursementDate.seconds * 1000) 
          : (loan.disbursementDate ? new Date(loan.disbursementDate as any) : new Date());
      
      const fDate = loan.firstPaymentDate?.seconds
          ? new Date(loan.firstPaymentDate.seconds * 1000)
          : (loan.firstPaymentDate ? new Date(loan.firstPaymentDate as any) : addMonths(dDate, 1));

      editTermsForm.reset({
          interestRate: loan.interestRate || 0,
          principalAmount: loan.principalAmount || 0,
          numberOfInstalments: loan.numberOfInstalments || 1,
          paymentFrequency: loan.paymentFrequency || 'monthly',
          preferredPaymentDay: loan.preferredPaymentDay || '',
          assignedStaffId: loan.assignedStaffId || '',
          disbursementDate: isNaN(dDate.getTime()) ? format(new Date(), 'yyyy-MM-dd') : format(dDate, 'yyyy-MM-dd'),
          firstPaymentDate: isNaN(fDate.getTime()) ? format(addMonths(new Date(), 1), 'yyyy-MM-dd') : format(fDate, 'yyyy-MM-dd'),
          totalRepayableAmount: loan.totalRepayableAmount || 0,
      });
      setIsEditingTerms(true);
  };

  async function onEditTermsSubmit(values: z.infer<typeof editTermsSchema>) {
      if (!loanToEdit || !canEdit) return;
      setIsUpdating(true);
      try {
          const assignedStaff = staffList?.find(s => (s.uid || s.id) === values.assignedStaffId);
          const instalmentAmount = values.numberOfInstalments > 0 ? values.totalRepayableAmount / values.numberOfInstalments : 0;

          const updateData = {
              ...values,
              disbursementDate: new Date(values.disbursementDate),
              firstPaymentDate: new Date(values.firstPaymentDate),
              assignedStaffName: assignedStaff?.name || assignedStaff?.email || "Unknown",
              instalmentAmount,
              totalRepayableAmount: values.totalRepayableAmount,
          };
          await updateLoan(firestore, loanToEdit.id, updateData);
          toast({ title: 'Terms Updated' });
          setLoanToEdit({ ...loanToEdit, ...updateData });
          setIsEditingTerms(false);
      } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); } finally { setIsUpdating(false); }
  }

  const handleConfirmDelete = async () => {
    if (!loanToDelete || !canEdit) return;
    
    setIsDeleting(true);
    try {
      await deleteLoan(firestore, loanToDelete.id);
      toast({ title: 'Loan Deleted', description: `Loan #${loanToDelete.loanNumber} has been permanently removed.` });
      
      if (loanToEdit?.id === loanToDelete.id) {
          setLoanToEdit(null);
      }
      
      setLoanToDelete(null);
      setDeleteConfirmOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const penaltyCalculation = useMemo(() => {
      if (!loanToEdit) return { dailyRate: 0, daysLate: 0, suggested: 0 };
      const oneInstInterest = calculateInterestForOneInstalment(loanToEdit.principalAmount || 0, loanToEdit.interestRate || 0, loanToEdit.numberOfInstalments || 1, loanToEdit.paymentFrequency || 'monthly');
      const daysInFreq = loanToEdit.paymentFrequency === 'monthly' ? 30 : (loanToEdit.paymentFrequency === 'weekly' ? 7 : 1);
      const dailyRate = oneInstInterest / daysInFreq;
      
      let dDate = loanToEdit.firstPaymentDate?.seconds 
        ? new Date(loanToEdit.firstPaymentDate.seconds * 1000) 
        : (loanToEdit.firstPaymentDate ? new Date(loanToEdit.firstPaymentDate as any) : new Date());
      
      if (isNaN(dDate.getTime())) return { dailyRate: 0, daysLate: 0, suggested: 0 };

      let finalDueDate: Date;
      if (loanToEdit.paymentFrequency === 'monthly') finalDueDate = addMonths(dDate, (loanToEdit.numberOfInstalments || 1) - 1);
      else if (loanToEdit.paymentFrequency === 'weekly') finalDueDate = addWeeks(dDate, (loanToEdit.numberOfInstalments || 1) - 1);
      else finalDueDate = addDays(dDate, (loanToEdit.numberOfInstalments || 1) - 1);
      
      const daysLate = differenceInDays(new Date(), finalDueDate);
      return { dailyRate, daysLate: daysLate > 0 ? daysLate : 0, suggested: Math.round((daysLate > 0 ? daysLate : 0) * dailyRate) };
  }, [loanToEdit]);

  const authorizeSuggestedPenalty = () => {
      if (!penaltyCalculation.suggested || !canEdit) return;
      penaltyForm.setValue('penaltyAmount', penaltyCalculation.suggested);
      penaltyForm.setValue('penaltyDate', format(new Date(), 'yyyy-MM-dd'));
      penaltyForm.setValue('penaltyDescription', `Late Payment Penalty: ${penaltyCalculation.daysLate} days overdue.`);
  };
  
  if (!isAuthorized && !userLoading) return <div className="flex h-screen w-full items-center justify-center"><h2>Access Restricted</h2></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" />Add Loan</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-0"><DialogTitle>Add a New Loan</DialogTitle><DialogDescription>Input specific terms to disburse a new credit facility.</DialogDescription></DialogHeader>
              <Form {...form}>
                <ScrollArea className="max-h-[65vh] px-6 py-2">
                  <form id="add-loan-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4 pb-4">
                    <FormField control={form.control} name="customerType" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Customer Type</FormLabel>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="existing" /></FormControl><FormLabel className="font-normal">Existing</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="new" /></FormControl><FormLabel className="font-normal">New</FormLabel></FormItem>
                          </RadioGroup>
                        </FormItem>
                    )} />
                    {customerTypeWatch === 'existing' ? (
                      <FormField control={form.control} name="customerId" render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Customer</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger></FormControl>
                              <SelectContent>{customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.accountNumber})</SelectItem>)}</SelectContent>
                            </Select>
                          </FormItem>
                      )} />
                    ) : (
                      <>
                        <FormField control={form.control} name="newCustomerName" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                        <FormField control={form.control} name="newCustomerPhone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                      </>
                    )}
                    <FormField control={form.control} name="idNumber" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>ID Number</FormLabel><FormControl><Input placeholder="Customer ID" {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)} />
                    <FormField control={form.control} name="assignedStaffId" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Assign Staff Follow-up</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger></FormControl>
                            <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
                          </Select>
                        </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="disbursementDate" render={({ field }) => (<FormItem><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="firstPaymentDate" render={({ field }) => (<FormItem><FormLabel className="text-primary font-bold">First Payment Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} className="border-primary/30" /></FormControl></FormItem>)} />

                    <FormField control={form.control} name="principalAmount" render={({ field }) => (<FormItem><FormLabel>Principal</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                    <FormField control={form.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Interest %</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                    <FormField control={form.control} name="numberOfInstalments" render={({ field }) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                    <FormField control={form.control} name="paymentFrequency" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select frequency"/></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    
                    {watch('paymentFrequency') === 'weekly' && (
                        <FormField control={form.control} name="preferredPaymentDay" render={({ field }) => (
                            <FormItem className="col-span-2">
                                <FormLabel>Preferred Weekly Payment Day</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select day"/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {DAYS_OF_WEEK.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    )}

                    <div className="col-span-2 space-y-2 rounded-md bg-muted p-4">
                      <div className="flex justify-between"><span className="text-sm">Instalment</span><span className="font-bold">Ksh {calculatedValues.instalmentAmount}</span></div>
                      <div className="flex justify-between"><span className="text-sm">Total</span><span className="font-bold">Ksh {calculatedValues.totalRepayableAmount}</span></div>
                    </div>
                  </form>
                </ScrollArea>
                <DialogFooter className="p-6 pt-2">
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
        <TabsContent value="all" className="m-0">
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle>Portfolio Ledger</CardTitle>
                    <div className="relative"><Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search name, phone, ID or Member No..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-[350px]" /></div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh]">
                      <Table>
                          <TableHeader className="sticky top-0 bg-card">
                            <TableRow>
                                <TableHead>No.</TableHead>
                                <TableHead>Member No</TableHead>
                                <TableHead>Customer Identity</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Staff Assigned</TableHead>
                                <TableHead>First Pay</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                              {filteredLoans.map((loan) => {
                                  const fDate = loan.firstPaymentDate?.seconds 
                                    ? new Date(loan.firstPaymentDate.seconds * 1000) 
                                    : (loan.firstPaymentDate ? new Date(loan.firstPaymentDate as any) : null);
                                  
                                  const currentCustomer = customers?.find(c => c.id === loan.customerId);
                                  const displayName = currentCustomer?.name || loan.customerName;

                                  return (
                                    <TableRow key={loan.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setLoanToEdit(loan)}>
                                        <TableCell className="font-mono text-[10px]">{loan.loanNumber}</TableCell>
                                        <TableCell className="font-bold text-xs">{loan.accountNumber || 'N/A'}</TableCell>
                                        <TableCell>
                                            <div className="font-bold text-sm">{displayName}</div>
                                            <div className="text-[10px] text-muted-foreground">National ID: {loan.idNumber || "N/A"}</div>
                                        </TableCell>
                                        <TableCell className="text-xs">{loan.customerPhone}</TableCell>
                                        <TableCell><div className="flex items-center gap-1"><User className="h-3 w-3 text-muted-foreground" /><span className="text-xs">{loan.assignedStaffName || "Unassigned"}</span></div></TableCell>
                                        <TableCell className="text-xs font-medium text-primary">{fDate && !isNaN(fDate.getTime()) ? format(fDate, 'dd/MM/yy') : 'N/A'}</TableCell>
                                        <TableCell className="text-right font-bold tabular-nums">KES {((loan.totalRepayableAmount || 0) - (loan.totalPaid || 0)).toLocaleString()}</TableCell>
                                        <TableCell className="text-center"><Badge variant={loan.status === 'paid' ? 'default' : (loan.status === 'due' || loan.status === 'overdue') ? 'destructive' : 'secondary'} className="text-[10px] uppercase">{loan.status}</Badge></TableCell>
                                    </TableRow>
                                  );
                              })}
                          </TableBody>
                      </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="applications" className="m-0">
            <Card>
                <CardHeader><CardTitle>Review Applications</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member No</TableHead>
                                <TableHead>Customer Identity</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {applicationLoans.map((loan) => {
                                const currentCustomer = customers?.find(c => c.id === loan.customerId);
                                const displayName = currentCustomer?.name || loan.customerName;

                                return (
                                    <TableRow key={loan.id}>
                                        <TableCell className="font-bold text-xs">{loan.accountNumber || 'N/A'}</TableCell>
                                        <TableCell>
                                            <div className="font-bold text-sm">{displayName}</div>
                                            <div className="text-[10px] text-muted-foreground">National ID: {loan.idNumber || "N/A"}</div>
                                        </TableCell>
                                        <TableCell className="text-xs">{loan.customerPhone}</TableCell>
                                        <TableCell className="text-xs">{loan.loanType}</TableCell>
                                        <TableCell className="font-bold text-right tabular-nums">Ksh {(loan.principalAmount || 0).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setViewingApplication(loan)}><Eye className="h-4 w-4 mr-1" /> View</Button>
                                                {canEdit && <Button size="sm" onClick={() => handleManageApplication(loan)}>Process</Button>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewingApplication} onOpenChange={(isOpen) => !isOpen && setViewingApplication(null)}>
          <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-0"><DialogTitle>Application Details</DialogTitle><DialogDescription>Full summary of the customer's self-submitted application.</DialogDescription></DialogHeader>
              {viewingApplication && (
                  <ScrollArea className="max-h-[60vh] p-6">
                      <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                          <div className="text-muted-foreground">Member Number:</div><div className="font-bold">{viewingApplication.accountNumber || 'N/A'}</div>
                          <div className="text-muted-foreground">Customer:</div><div className="font-medium">{viewingApplication.customerName}</div>
                          <div className="text-muted-foreground">Phone Number:</div><div className="font-medium">{viewingApplication.customerPhone}</div>
                          <div className="text-muted-foreground">National ID:</div><div className="font-bold text-primary">{viewingApplication.idNumber || 'N/A'}</div>
                          <div className="text-muted-foreground">Requested Amount:</div><div className="font-bold text-primary">Ksh {(viewingApplication.principalAmount || 0).toLocaleString()}</div>
                          <div className="text-muted-foreground">Loan Product:</div><div className="font-medium">{viewingApplication.loanType}</div>
                          {viewingApplication.paymentFrequency === 'weekly' && (
                              <><div className="text-muted-foreground">Preferred Day:</div><div className="font-bold text-blue-600">{viewingApplication.preferredPaymentDay || 'N/A'}</div></>
                          )}
                      </div>
                  </ScrollArea>
              )}
              <DialogFooter className="p-6 pt-2">
                  <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                  {canEdit && <Button onClick={() => { const app = viewingApplication; setViewingApplication(null); if (app) handleManageApplication(app); }}>Process Application</Button>}
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={!!applicationToManage} onOpenChange={(isOpen) => !isOpen && setApplicationToManage(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
            {applicationToManage && (
                <>
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>Process Application</DialogTitle>
                        <DialogDescription>Finalize terms and assign a follow-up staff member.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[65vh] px-6 py-4">
                        <Form {...approvalForm}>
                            <form id="approval-form" onSubmit={approvalForm.handleSubmit(onApproveSubmit)} className="grid grid-cols-2 gap-4">
                                <FormField control={approvalForm.control} name="disbursementDate" render={({field}) => (<FormItem className="col-span-2"><FormLabel>Approved Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                                <FormField control={approvalForm.control} name="firstPaymentDate" render={({field}) => (<FormItem className="col-span-2"><FormLabel className="text-primary font-bold">First Payment Date (Customer Agreed)</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} className="border-primary/30" /></FormControl></FormItem>)} />
                                <FormField control={approvalForm.control} name="assignedStaffId" render={({ field }) => (
                                    <FormItem className="col-span-2">
                                      <FormLabel>Assign Staff</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select staff"/></SelectTrigger></FormControl>
                                        <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </FormItem>
                                )}/>
                                <FormField control={approvalForm.control} name="principalAmount" render={({field}) => (<FormItem><FormLabel>Approved Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                                <FormField control={approvalForm.control} name="interestRate" render={({field}) => (<FormItem><FormLabel>Interest %</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                                <FormField control={approvalForm.control} name="numberOfInstalments" render={({field}) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)} />
                                <FormField control={approvalForm.control} name="paymentFrequency" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Frequency</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select frequency"/></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                                      </Select>
                                    </FormItem>
                                )}/>
                                {approvalForm.watch('paymentFrequency') === 'weekly' && (
                                    <FormField control={approvalForm.control} name="preferredPaymentDay" render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>Preferred Weekly Payment Day</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select day"/></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {DAYS_OF_WEEK.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                )}
                            </form>
                        </Form>
                    </ScrollArea>
                    <DialogFooter className="p-6 pt-2">
                        <Button variant="outline" onClick={() => setApplicationToManage(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject}>Reject</Button>
                        <Button type="submit" form="approval-form" disabled={isUpdatingStatus}>Approve & Disburse</Button>
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditingTerms} onOpenChange={setIsEditingTerms}>
          <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>Update Loan Terms</DialogTitle>
                <DialogDescription>Modify primary financial terms and repayment schedule.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] px-6 py-4">
                <Form {...editTermsForm}>
                    <form onSubmit={editTermsForm.handleSubmit(onEditTermsSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={editTermsForm.control} name="assignedStaffId" render={({ field }) => (
                                <FormItem className="col-span-2">
                                    <FormLabel>Assign Staff</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger></FormControl>
                                    <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={editTermsForm.control} name="disbursementDate" render={({field}) => (
                                <FormItem>
                                    <FormLabel>Disbursement Date</FormLabel>
                                    <FormControl><Input type="date" {...field} value={field.value ?? ''}/></FormControl>
                                </FormItem>
                            )}/>
                            <FormField control={editTermsForm.control} name="firstPaymentDate" render={({field}) => (
                                <FormItem>
                                    <FormLabel className="text-primary font-bold">First Payment Date</FormLabel>
                                    <FormControl><Input type="date" {...field} value={field.value ?? ''} className="border-primary/30"/></FormControl>
                                </FormItem>
                            )}/>
                            <FormField control={editTermsForm.control} name="principalAmount" render={({field}) => (<FormItem><FormLabel>Principal</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                            <FormField control={editTermsForm.control} name="interestRate" render={({field}) => (<FormItem><FormLabel>Interest %</FormLabel><FormControl><Input type="number" step="0.01" {...field}/></FormControl></FormItem>)}/>
                            <FormField control={editTermsForm.control} name="numberOfInstalments" render={({field}) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                            <FormField control={editTermsForm.control} name="paymentFrequency" render={({ field }) => (
                                <FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select frequency"/></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></FormItem>
                            )}/>
                            {editTermsForm.watch('paymentFrequency') === 'weekly' && (
                                <FormField control={editTermsForm.control} name="preferredPaymentDay" render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>Preferred Weekly Payment Day</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select day"/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {DAYS_OF_WEEK.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            )}
                            <FormField control={editTermsForm.control} name="totalRepayableAmount" render={({field}) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel className="font-bold text-primary">Total Repayable (Amount to Pay)</FormLabel>
                                        <FormControl><Input type="number" {...field} className="border-primary/50 bg-primary/5 font-bold" /></FormControl>
                                        <FormDescription className="text-[10px]">Manual override for corrections. Installments will automatically sync.</FormDescription>
                                    </FormItem>
                                )} />
                        </div>
                        <Button type="submit" className="w-full" disabled={isUpdating}>Save & Update Totals</Button>
                    </form>
                </Form>
              </ScrollArea>
              <DialogFooter className="p-6 pt-2">
                  <DialogClose asChild><Button variant="ghost">Close</Button></DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={!!loanToEdit} onOpenChange={(isOpen) => !isOpen && setLoanToEdit(null)}>
          <DialogContent className="sm:max-w-5xl p-0 overflow-hidden">
              {loanToEdit && (
                  <>
                    <DialogHeader className="p-6 pb-0"><DialogTitle>Manage Loan #{loanToEdit.loanNumber}</DialogTitle><DialogDescription>Review interactions, record payments, and track history.</DialogDescription></DialogHeader>
                    <ScrollArea className="max-h-[75vh]">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
                            <div className="space-y-4 md:col-span-1">
                                <Card>
                                    <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
                                        <CardTitle className="text-sm">Summary</CardTitle>
                                        {canEdit && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditTerms(loanToEdit)}><Pencil className="h-3.5 w-3.5" /></Button>}
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        <div className="flex justify-between"><span>Customer:</span><span className="font-medium">{(customers?.find(c => c.id === loanToEdit.customerId)?.name) || loanToEdit.customerName}</span></div>
                                        <div className="flex justify-between"><span>Member No:</span><span className="font-bold text-primary">{loanToEdit.accountNumber || 'N/A'}</span></div>
                                        <div className="flex justify-between"><span>Phone:</span><span className="font-medium">{loanToEdit.customerPhone}</span></div>
                                        <div className="flex justify-between"><span>Assigned:</span><span className="font-medium">{loanToEdit.assignedStaffName || 'Unassigned'}</span></div>
                                        <div className="flex justify-between"><span>Rate:</span><span className="font-medium">{loanToEdit.interestRate}%</span></div>
                                        {loanToEdit.paymentFrequency === 'weekly' && (
                                            <div className="flex justify-between"><span>Weekly Day:</span><span className="font-bold text-blue-600">{loanToEdit.preferredPaymentDay || 'N/A'}</span></div>
                                        )}
                                        <div className="flex justify-between border-t pt-2"><span>Remaining:</span><span className="font-bold text-destructive">Ksh {((loanToEdit.totalRepayableAmount || 0) - (loanToEdit.totalPaid || 0)).toLocaleString()}</span></div>
                                    </CardContent>
                                </Card>
                                {canEdit && (
                                    <Card>
                                        <CardHeader className="py-3"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            <Button variant="outline" className="w-full text-xs" onClick={() => rolloverLoan(firestore, loanToEdit, new Date()).then(() => { toast({ title: 'Rolled Over' }); setLoanToEdit(null); })}>Rollover</Button>
                                            <Button variant="secondary" className="w-full text-xs" onClick={() => updateLoan(firestore, loanToEdit.id, { status: 'paid' }).then(() => { toast({ title: 'Marked Paid' }); setLoanToEdit(null); })}>Mark Paid</Button>
                                            <Button variant="destructive" className="w-full text-xs mt-4" onClick={() => { setLoanToDelete(loanToEdit); setDeleteConfirmOpen(true); }}>Delete Loan</Button>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                            <div className="md:col-span-2 space-y-6">
                                <Tabs defaultValue="payments">
                                    <TabsList className="grid grid-cols-3 w-full"><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="followups">Follow-ups</TabsTrigger><TabsTrigger value="penalties">Penalties</TabsTrigger></TabsList>
                                    <TabsContent value="payments">
                                        {canEdit && (
                                            <Form {...paymentForm}>
                                                <form onSubmit={paymentForm.handleSubmit(onRecordPayment)} className="space-y-4 mb-4"><div className="flex gap-2"><FormField control={paymentForm.control} name="paymentAmount" render={({field}) => (<Input type="number" placeholder="Amt" {...field} value={field.value ?? ''}/>)} /><FormField control={paymentForm.control} name="paymentDate" render={({field}) => (<Input type="date" {...field} value={field.value ?? ''}/>)} /><Button type="submit" disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin h-4 w-4"/> : 'Pay'}</Button></div></form>
                                            </Form>
                                        )}
                                        <ScrollArea className="h-64 border rounded-md"><Table><TableBody>{loanToEdit.payments?.map((p, i) => {
                                            const payDate = (p.date as any)?.seconds 
                                                ? new Date((p.date as any).seconds * 1000) 
                                                : (p.date instanceof Date ? p.date : new Date());
                                            
                                            return (
                                                <TableRow key={p.paymentId || i}>
                                                    <TableCell className="text-xs">{isNaN(payDate.getTime()) ? 'N/A' : format(payDate, 'dd/MM/yy HH:mm')}</TableCell>
                                                    <TableCell className="text-right font-medium">Ksh {(p.amount || 0).toLocaleString()}</TableCell>
                                                </TableRow>
                                            )
                                        })}</TableBody></Table></ScrollArea>
                                    </TabsContent>
                                    <TabsContent value="followups">
                                        <ScrollArea className="h-[300px]">
                                            <div className="space-y-4">
                                                {loanToEdit.followUpNotes?.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground text-center py-8">No follow-up notes recorded.</p>
                                                ) : (
                                                    loanToEdit.followUpNotes?.map((note, i) => {
                                                        const noteDate = (note.date as any)?.seconds 
                                                            ? new Date((note.date as any).seconds * 1000) 
                                                            : (note.date instanceof Date ? note.date : new Date());
                                                        
                                                        return (
                                                            <div key={note.noteId || i} className="border p-3 rounded-lg bg-muted/30">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="text-xs font-bold">{note.staffName}</span>
                                                                    <span className="text-[10px] text-muted-foreground">{isNaN(noteDate.getTime()) ? 'N/A' : format(noteDate, 'PPP p')}</span>
                                                                </div>
                                                                <p className="text-sm italic">"{note.content}"</p>
                                                            </div>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                    <TabsContent value="penalties">
                                        {canEdit && penaltyCalculation.daysLate > 0 && (
                                            <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-4 space-y-2">
                                                <div className="flex items-center gap-2 text-orange-800 font-bold text-xs uppercase"><AlertCircle className="h-4 w-4" />Overdue</div>
                                                <Button size="sm" variant="secondary" className="w-full" onClick={authorizeSuggestedPenalty}>Apply Penalty (Ksh {penaltyCalculation.suggested})</Button>
                                            </div>
                                        )}
                                        {canEdit ? (
                                            <Form {...penaltyForm}>
                                                <form onSubmit={penaltyForm.handleSubmit(onAddPenalty)} className="space-y-2 mb-4"><div className="grid grid-cols-2 gap-2"><FormField control={penaltyForm.control} name="penaltyAmount" render={({field}) => (<Input type="number" placeholder="Amt" {...field} value={field.value ?? ''}/>)} /><FormField control={penaltyForm.control} name="penaltyDate" render={({field}) => (<Input type="date" {...field} value={field.value ?? ''}/>)} /></div><FormField control={penaltyForm.control} name="penaltyDescription" render={({field}) => (<Input placeholder="Reason" {...field} value={field.value ?? ''}/>)} /><Button type="submit" variant="destructive" className="w-full" disabled={isAddingPenalty}>Record Penalty</Button></form>
                                            </Form>
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-8">Penalties can only be managed by Finance/Admin.</p>
                                        )}
                                        <ScrollArea className="h-48 border rounded-md"><Table><TableBody>{loanToEdit.penalties?.map((p, i) => {
                                            const penaltyDate = (p.date as any)?.seconds 
                                                ? new Date((p.date as any).seconds * 1000) 
                                                : (p.date instanceof Date ? penaltyDate : new Date());
                                            
                                            return (
                                                <TableRow key={p.penaltyId || i}>
                                                    <TableCell className="text-xs">{isNaN(penaltyDate.getTime()) ? 'N/A' : format(penaltyDate, 'dd/MM/yy')}</TableCell>
                                                    <TableCell className="text-xs">{p.description}</TableCell>
                                                    <TableCell className="text-right font-medium">Ksh {(p.amount || 0).toLocaleString()}</TableCell>
                                                </TableRow>
                                            )
                                        })}</TableBody></Table></ScrollArea>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-6 pt-2"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loan Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete Loan #{loanToDelete?.loanNumber || loanToEdit?.loanNumber} and all its associated history (payments, penalties, notes). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteConfirmOpen(false); setLoanToDelete(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }} 
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
