
'use client';

import { useState, useMemo, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser, useMemoFirebase, useStorage } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Search, User, Eye, AlertCircle, Pencil, Trash2, FileText, Camera, ShieldCheck, ArrowRight, Lock, Upload, ImagePlus } from 'lucide-react';
import { getDoc, collection, query, where } from 'firebase/firestore';
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
  uploadKYCDocument,
  type Loan
} from '@/lib/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, addDays, addWeeks, addMonths, differenceInDays, startOfToday, differenceInMonths } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { calculateAmortization, calculateInterestForOneInstalment } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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

const kycUploadSchema = z.object({
    type: z.enum(['owner_id', 'guarantor_id', 'loan_form', 'security_attachment', 'guarantor_undertaking']),
    fileName: z.string().min(1, "Enter a label for this document."),
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

interface KYCDoc {
    id: string;
    customerId: string;
    type: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: any;
}

const TYPE_LABELS: Record<string, string> = {
    owner_id: 'Owner ID',
    guarantor_id: 'Guarantor ID',
    loan_form: 'Loan Form',
    security_attachment: 'Security',
    guarantor_undertaking: 'Undertaking'
};

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
  const [viewingKYC, setViewingKYC] = useState<KYCDoc | null>(null);
  
  // KYC Upload Internal states
  const [isKYCAddOpen, setIsKYCAddOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const isSuperAdmin = user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2' || user?.uid === 'Z8gkNLZEVUWbsooR8R7OuHxApB62';
  const userRole = user?.role?.toLowerCase();
  const isFinance = userRole === 'finance';
  const isStaff = userRole === 'staff' || isFinance;
  
  const isAuthorized = isSuperAdmin || isStaff;
  const canEdit = isSuperAdmin || isFinance; 
  const canViewKYC = isAuthorized;

  const { data: customers, loading: customersLoading } = useCollection<Customer>(isAuthorized ? 'customers' : null);
  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: staffList, loading: staffLoading } = useCollection<Staff>(isAuthorized ? 'users' : null);

  const kycQuery = useMemoFirebase(() => {
      if (!loanToEdit || !firestore || !canViewKYC) return null;
      return query(collection(firestore, 'kyc_documents'), where('customerId', '==', loanToEdit.customerId));
  }, [loanToEdit?.customerId, firestore, canViewKYC]);

  const { data: kycDocs, isLoading: kycLoading } = useCollection<KYCDoc>(kycQuery);

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
    }).sort((a, b) => {
        const d1 = a.disbursementDate?.seconds || 0;
        const d2 = b.disbursementDate?.seconds || 0;
        return d2 - d1;
    });
  }, [loans, searchTerm, statusFilter]);
  
  const applicationLoans = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => loan.status === 'application').sort((a, b) => {
        const d1 = a.createdAt?.seconds || 0;
        const d2 = b.createdAt?.seconds || 0;
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

  const kycUploadForm = useForm<z.infer<typeof kycUploadSchema>>({
      resolver: zodResolver(kycUploadSchema),
      defaultValues: { type: 'owner_id', fileName: '' }
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


  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
      setCapturedImage(null);
    } catch (e) { toast({ variant: 'destructive', title: 'Camera Error' }); }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setCapturedImage(reader.result as string); stopCamera(); };
      reader.readAsDataURL(file);
    }
  };

  async function onKYCSubmit(values: z.infer<typeof kycUploadSchema>) {
      if (!loanToEdit || !capturedImage || !user) return;
      setIsSubmitting(true);
      try {
          await uploadKYCDocument(firestore, storage, {
              ...values,
              customerId: loanToEdit.customerId,
              customerName: loanToEdit.customerName,
              fileUrl: capturedImage,
              uploadedBy: user.name || user.email || 'Admin'
          });
          toast({ title: 'KYC Document Saved' });
          setCapturedImage(null);
          setIsKYCAddOpen(false);
          kycUploadForm.reset();
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Upload Failed', description: e.message });
      } finally { setIsSubmitting(false); }
  }

  async function onSubmit(values: z.infer<typeof loanSchema>) {
    if (!canEdit) return;
    setIsSubmitting(true);
    try {
      let customerId = values.customerId;
      let customerName = '';
      let customerPhone = '';
      let accountNumber = '';

      if (values.customerType === 'new') {
        const newCustomerData = { 
            name: values.newCustomerName!, 
            phone: values.newCustomerPhone!, 
            idNumber: values.idNumber,
            registeredByStaffId: user?.uid,
            registeredByStaffName: user?.name || user?.email || 'Staff'
        };
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
            recordedBy: user?.name || user?.email || 'Admin',
            staffId: user?.uid 
        });
        toast({ title: 'Payment Recorded', description: 'Notification sent to customer.' });
        paymentForm.reset();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); } finally { setIsUpdating(false); }
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
              assignedStaffName: staff?.name || staff?.email || "Unknown",
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
      toast({ title: 'Loan Deleted' });
      if (loanToEdit?.id === loanToDelete.id) setLoanToEdit(null);
      setLoanToDelete(null);
      setDeleteConfirmOpen(false);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Delete Failed', description: e.message }); } finally { setIsDeleting(false); }
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
                              <SelectContent>
                                {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.accountNumber})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                      )} />
                    ) : (
                      <>
                        <FormField control={form.control} name="newCustomerName" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="newCustomerPhone" render={({ field }) => (
                            <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                      </>
                    )}
                    <FormField control={form.control} name="idNumber" render={({ field }) => (
                        <FormItem className="col-span-2"><FormLabel>ID Number</FormLabel><FormControl><Input placeholder="Customer ID" {...field} /></FormControl><FormMessage/></FormItem>
                    )} />
                    <FormField control={form.control} name="assignedStaffId" render={({ field }) => (
                        <FormItem className="col-span-2"><FormLabel>Assign Staff</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select staff"/></SelectTrigger></FormControl><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="disbursementDate" render={({ field }) => (
                        <FormItem><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="firstPaymentDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-primary font-bold">First Payment Date</FormLabel><FormControl><Input type="date" {...field} className="border-primary/30" /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="principalAmount" render={({ field }) => (
                        <FormItem><FormLabel>Principal</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="interestRate" render={({ field }) => (
                        <FormItem><FormLabel>Interest %</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="numberOfInstalments" render={({ field }) => (
                        <FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="paymentFrequency" render={({ field }) => (
                      <FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select frequency"/></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    <div className="col-span-2 space-y-2 rounded-md bg-muted p-4">
                      <div className="flex justify-between"><span className="text-sm">Instalment</span><span className="font-bold">Ksh {calculatedValues.instalmentAmount}</span></div>
                      <div className="flex justify-between"><span className="text-sm">Total</span><span className="font-bold">Ksh {calculatedValues.totalRepayableAmount}</span></div>
                    </div>
                  </form>
                </ScrollArea>
                <DialogFooter className="p-6 pt-2"><DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="add-loan-form" disabled={isSubmitting}>Disburse</Button></DialogFooter>
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
                              {filteredLoans.map((loan: any) => {
                                  const fDate = loan.firstPaymentDate?.seconds ? new Date(loan.firstPaymentDate.seconds * 1000) : (loan.firstPaymentDate ? new Date(loan.firstPaymentDate as any) : null);
                                  return (
                                    <TableRow key={loan.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setLoanToEdit(loan)}>
                                        <TableCell className="font-mono text-[10px]">{loan.loanNumber}</TableCell>
                                        <TableCell className="font-bold text-xs">{loan.accountNumber || 'N/A'}</TableCell>
                                        <TableCell>
                                            <div className="font-bold text-sm">{loan.customerName}</div>
                                            <div className="text-[10px] text-muted-foreground">National ID: {loan.idNumber || "N/A"}</div>
                                        </TableCell>
                                        <TableCell className="text-xs">{loan.customerPhone}</TableCell>
                                        <TableCell><div className="flex items-center gap-1"><User className="h-3 w-3 text-muted-foreground" /><span className="text-xs">{loan.assignedStaffName || "Unassigned"}</span></div></TableCell>
                                        <TableCell className="text-xs font-medium text-primary">{fDate && !isNaN(fDate.getTime()) ? format(fDate, 'dd/MM/yy') : 'N/A'}</TableCell>
                                        <TableCell className="text-right font-bold tabular-nums">KES {((loan.totalRepayableAmount || 0) - (loan.totalPaid || 0)).toLocaleString()}</TableCell>
                                        <TableCell className="text-center"><Badge variant="outline">{loan.status.toUpperCase()}</Badge></TableCell>
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
                        <TableHeader><TableRow><TableHead>Member No</TableHead><TableHead>Customer Identity</TableHead><TableHead>Phone</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {applicationLoans.map((loan) => (
                                <TableRow key={loan.id}>
                                    <TableCell className="font-bold text-xs">{loan.accountNumber || 'N/A'}</TableCell>
                                    <TableCell><div className="font-bold text-sm">{loan.customerName}</div></TableCell>
                                    <TableCell className="text-xs">{loan.customerPhone}</TableCell>
                                    <TableCell className="text-xs">{loan.loanType}</TableCell>
                                    <TableCell className="font-bold text-right">Ksh {(loan.principalAmount || 0).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => setViewingApplication(loan)}><Eye className="h-4 w-4 mr-1" /> View</Button>
                                            {canEdit && <Button size="sm" onClick={() => handleManageApplication(loan)}>Process</Button>}
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

      <Dialog open={!!loanToEdit} onOpenChange={(isOpen) => { if(!isOpen) { setLoanToEdit(null); setCapturedImage(null); setShowCamera(false); } }}>
          <DialogContent className="sm:max-w-5xl p-0 overflow-hidden">
              {loanToEdit && (
                  <>
                    <DialogHeader className="p-6 pb-0">
                        <div className="flex items-center justify-between"><DialogTitle>Manage Loan #{loanToEdit.loanNumber}</DialogTitle><Badge className="mr-8">{loanToEdit.status.toUpperCase()}</Badge></div>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
                        <div className="space-y-4 md:col-span-1">
                            <Card><CardHeader className="py-3 flex justify-between items-center"><CardTitle className="text-sm">Summary</CardTitle>{canEdit && <Button variant="ghost" size="icon" onClick={() => handleEditTerms(loanToEdit)}><Pencil className="h-3.5 w-3.5" /></Button>}</CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="flex justify-between"><span>Customer:</span><span className="font-medium">{loanToEdit.customerName}</span></div>
                                    <div className="flex justify-between"><span>Remaining:</span><span className="font-bold text-destructive">Ksh {((loanToEdit.totalRepayableAmount || 0) - (loanToEdit.totalPaid || 0)).toLocaleString()}</span></div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="md:col-span-2 space-y-6">
                            <Tabs defaultValue="payments">
                                <TabsList className="grid grid-cols-4 w-full">
                                    <TabsTrigger value="payments">Payments</TabsTrigger>
                                    <TabsTrigger value="followups">Notes</TabsTrigger>
                                    {canViewKYC && <TabsTrigger value="kyc"><ShieldCheck className="h-3 w-3 mr-1" /> KYC Vault</TabsTrigger>}
                                    <TabsTrigger value="penalties">Penalties</TabsTrigger>
                                </TabsList>
                                <TabsContent value="kyc">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black uppercase text-muted-foreground">Verification Materials</h4>
                                            <Dialog open={isKYCAddOpen} onOpenChange={(o) => { setIsKYCAddOpen(o); if(!o) { stopCamera(); setCapturedImage(null); } }}>
                                                <DialogTrigger asChild><Button variant="outline" size="sm" className="h-7 text-[10px] font-bold"><PlusCircle className="h-3 w-3 mr-1" /> Add Document</Button></DialogTrigger>
                                                <DialogContent className="sm:max-w-md">
                                                    <DialogHeader><DialogTitle>Record KYC Document</DialogTitle></DialogHeader>
                                                    <Form {...kycUploadForm}>
                                                        <form onSubmit={kycUploadForm.handleSubmit(onKYCSubmit)} className="space-y-4 pt-4">
                                                            <FormField control={kycUploadForm.control} name="type" render={({ field }) => (
                                                                <FormItem><FormLabel>Document Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="owner_id">Owner ID Card</SelectItem><SelectItem value="guarantor_id">Guarantor ID Card</SelectItem><SelectItem value="loan_form">Loan Form</SelectItem><SelectItem value="security_attachment">Security Photos</SelectItem></SelectContent></Select></FormItem>
                                                            )}/>
                                                            <FormField control={kycUploadForm.control} name="fileName" render={({ field }) => (
                                                                <FormItem><FormLabel>Label</FormLabel><FormControl><Input placeholder="e.g. Front ID" {...field} /></FormControl></FormItem>
                                                            )}/>
                                                            <div className="relative min-h-[200px] bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center">
                                                                {!showCamera && !capturedImage && (
                                                                    <div className="text-center p-4 flex flex-col gap-2">
                                                                        <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>Upload File</Button>
                                                                        <Button type="button" variant="outline" size="sm" onClick={startCamera}>Take Photo</Button>
                                                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                                                    </div>
                                                                )}
                                                                <video ref={videoRef} className={`w-full h-full object-contain ${showCamera ? 'block' : 'hidden'}`} autoPlay muted playsInline />
                                                                {capturedImage && <img src={capturedImage} alt="Preview" className="max-h-[300px] object-contain" />}
                                                            </div>
                                                            {showCamera && <Button type="button" className="w-full" onClick={capturePhoto}>Capture</Button>}
                                                            <DialogFooter><Button type="submit" disabled={isSubmitting || !capturedImage}>Save Document</Button></DialogFooter>
                                                        </form>
                                                    </Form>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                        <ScrollArea className="h-64 border rounded-md p-2">
                                            {kycLoading ? <Loader2 className="animate-spin mx-auto mt-10" /> : (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {kycDocs?.map(doc => (
                                                        <div key={doc.id} className="relative aspect-video rounded border bg-muted cursor-pointer group overflow-hidden" onClick={() => setViewingKYC(doc)}>
                                                            <img src={doc.fileUrl} className="w-full h-full object-cover" alt="KYC" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Eye className="text-white h-5 w-5" /></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </div>
                                </TabsContent>
                                <TabsContent value="payments">
                                    <ScrollArea className="h-64 border rounded-md"><Table><TableBody>{loanToEdit.payments?.map((p, i) => (
                                        <TableRow key={p.paymentId || i}><TableCell className="text-xs">{format(new Date((p.date as any).seconds * 1000), 'dd/MM/yy HH:mm')}</TableCell><TableCell className="text-right">Ksh {(p.amount || 0).toLocaleString()}</TableCell></TableRow>
                                    ))}</TableBody></Table></ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-2"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>

      <Dialog open={!!viewingKYC} onOpenChange={(o) => !o && setViewingKYC(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
              <div className="relative w-full h-[85vh] flex items-center justify-center">
                  {viewingKYC?.fileUrl && <img src={viewingKYC.fileUrl} className="max-w-full max-h-full object-contain" alt="KYC" />}
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
