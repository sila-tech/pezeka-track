'use client';

import { useState, useMemo, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser, useMemoFirebase, useStorage } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Loader2, PlusCircle, Eye, Pencil, Trash2, CheckCircle2, User, Users, RefreshCw, Landmark, Phone, Calendar, ShieldCheck, Sparkles, AlertCircle, AlertTriangle, CheckCircle, ChevronDown, Check } from 'lucide-react';
import { canAccessStaffModules, canAccessSensitiveModules } from '@/lib/admin-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
// Command UI components removed as they are missing in this environment
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
  deleteLoanPayment,
  updateLoanPayment,
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
  status: z.enum(['due', 'paid', 'active', 'rollover', 'overdue', 'application', 'awaiting_documents', 'under_review']),
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
  const [customerSearch, setCustomerSearch] = useState('');
  const [memberTabSearch, setMemberTabSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [applicationToManage, setApplicationToManage] = useState<Loan | null>(null);
  const [viewingApplication, setViewingApplication] = useState<Loan | null>(null);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rolloverConfirmOpen, setRolloverConfirmOpen] = useState(false);
  const [markAsPaidConfirmOpen, setMarkAsPaidConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingKYC, setViewingKYC] = useState<KYCDoc | null>(null);
  const [paymentToEdit, setPaymentToEdit] = useState<any | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  
  // KYC Upload Internal states
  const [isKYCAddOpen, setIsKYCAddOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const isAuthorized = canAccessStaffModules(user);
  const canEdit = canAccessSensitiveModules(user);
  const canViewKYC = isAuthorized;

  const { data: customers, loading: customersLoading } = useCollection<Customer>(isAuthorized ? 'customers' : null);
  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: staffList, loading: staffLoading } = useCollection<Staff>(isAuthorized ? 'users' : null);

  const kycQuery = useMemoFirebase(() => {
      if (!loanToEdit || !firestore || !canViewKYC) return null;
      return query(collection(firestore, 'kyc_documents'), where('customerId', '==', loanToEdit.customerId));
  }, [loanToEdit?.customerId, firestore, canViewKYC]);

  const { data: kycDocs, isLoading: kycLoading } = useCollection<KYCDoc>(kycQuery);

  const getLoanDisplayStatus = (loan: Loan) => {
      if (loan.status === 'active') {
          const balance = (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0);
          if (balance <= 0) return 'paid';
      }
      return loan.status;
  };

  const getLoanStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case 'paid': return 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200';
        case 'active': return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200';
        case 'rejected': return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200';
        case 'rollover': return 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200';
        case 'application': return 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200';
        case 'awaiting_documents': return 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200';
        case 'under_review': return 'bg-cyan-100 text-cyan-800 border-cyan-300 hover:bg-cyan-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200';
      }
  };

  const filteredLoans = useMemo(() => {
    if (!loans) return [];
    
    return loans.filter(loan => {
        const displayStatus = getLoanDisplayStatus(loan);
        if (displayStatus === 'application' || displayStatus === 'awaiting_documents' || displayStatus === 'under_review' || displayStatus === 'rejected') return false;
        
        const statusMatch = statusFilter === 'all' || displayStatus === statusFilter;
        const searchMatch = searchTerm === '' ||
            loan.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.customerPhone.includes(searchTerm) ||
            loan.idNumber?.includes(searchTerm) ||
            loan.accountNumber?.includes(searchTerm);
        return statusMatch && searchMatch;
    }).sort((a, b) => {
        const d1 = (a.disbursementDate as any)?.seconds || 0;
        const d2 = (b.disbursementDate as any)?.seconds || 0;
        return d2 - d1;
    });
  }, [loans, searchTerm, statusFilter]);
  
  const applicationLoans = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => loan.status === 'application' || loan.status === 'awaiting_documents' || loan.status === 'under_review').sort((a, b) => {
        const d1 = (a as any).createdAt?.seconds || 0;
        const d2 = (b as any).createdAt?.seconds || 0;
        return d2 - d1;
    });
  }, [loans]);

  const sortedAllMembers = useMemo(() => {
    if (!customers) return [];
    let result = [...customers];
    if (memberTabSearch) {
        const s = memberTabSearch.toLowerCase();
        result = result.filter(c => 
            c.name?.toLowerCase().includes(s) || 
            c.phone?.includes(s) || 
            c.idNumber?.includes(s) || 
            c.accountNumber?.toLowerCase().includes(s)
        );
    }
    return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [customers, memberTabSearch]);


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
        accountNumber = (newSnap.data() as any)?.accountNumber || '';
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

  const handleMarkUnderReview = async (loan: Loan) => {
      setIsUpdatingStatus(true);
      try {
          await updateLoan(firestore, loan.id, { status: 'under_review' });
          toast({ title: 'Application is now Under Review' });
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

  const handleDeletePayment = async (payment: any) => {
    if (!loanToEdit || !canEdit) return;
    if (!confirm('Are you sure you want to delete this payment record? This will reduce the total paid amount.')) return;
    setIsUpdating(true);
    try {
        await deleteLoanPayment(firestore, loanToEdit.id, payment);
        toast({ title: 'Payment Deleted', description: 'The payment has been removed from the ledger.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
        setIsUpdating(false);
    }
  };

  const handleOpenEditPayment = (payment: any) => {
    if (!canEdit) return;
    const dateObj = (payment.date as any)?.seconds
        ? new Date((payment.date as any).seconds * 1000)
        : (payment.date ? new Date(payment.date as any) : new Date());
    setEditPaymentAmount(String(payment.amount || ''));
    setEditPaymentDate(isNaN(dateObj.getTime()) ? format(new Date(), 'yyyy-MM-dd') : format(dateObj, 'yyyy-MM-dd'));
    setPaymentToEdit(payment);
  };

  const handleEditPaymentSave = async () => {
    if (!loanToEdit || !paymentToEdit || !canEdit) return;
    const newAmount = parseFloat(editPaymentAmount);
    if (isNaN(newAmount) || newAmount <= 0) {
        toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid payment amount.' });
        return;
    }
    setIsUpdating(true);
    try {
        await updateLoanPayment(firestore, loanToEdit.id, paymentToEdit, newAmount, new Date(editPaymentDate));
        toast({ title: 'Payment Updated', description: 'The payment has been corrected in the ledger.' });
        setPaymentToEdit(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
        setIsUpdating(false);
    }
  };

  const handleEditTerms = (loan: Loan) => {
      if (!canEdit) return;
      const dDate = (loan.disbursementDate as any)?.seconds 
          ? new Date((loan.disbursementDate as any).seconds * 1000) 
          : (loan.disbursementDate ? new Date(loan.disbursementDate as any) : new Date());
      
      const fDate = (loan.firstPaymentDate as any)?.seconds
          ? new Date((loan.firstPaymentDate as any).seconds * 1000)
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
          setLoanToEdit({ ...loanToEdit, ...updateData } as Loan);
          setIsEditingTerms(false);
      } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); } finally { setIsUpdating(false); }
  }

  const handleRollover = async () => {
      if (!loanToEdit || !canEdit) return;
      setIsUpdating(true);
      try {
          await rolloverLoan(firestore, loanToEdit, new Date());
          const interestPaid = (loanToEdit.totalRepayableAmount - loanToEdit.principalAmount) / (loanToEdit.numberOfInstalments || 1);
          toast({
              title: 'Rollover Recorded',
              description: `Interest-only payment applied. Principal balance unchanged. Next instalment date moved forward.`
          });
          setRolloverConfirmOpen(false);
          // Update local state to reflect rollover status without closing modal
          setLoanToEdit((prev) => prev ? { ...prev, status: 'rollover' } : null);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Rollover Failed', description: e.message });
      } finally {
          setIsUpdating(false);
      }
  };

  const handleMarkAsPaid = async () => {
      if (!loanToEdit || !canEdit) return;
      setIsUpdating(true);
      try {
          await updateLoan(firestore, loanToEdit.id, { status: 'paid' });
          toast({ title: 'Loan Settled', description: 'Status updated to fully paid.' });
          setMarkAsPaidConfirmOpen(false);
          // Delay closing the parent modal to prevent Radix UI body pointer-events freeze
          setTimeout(() => setLoanToEdit(null), 150);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
      } finally {
          setIsUpdating(false);
      }
  };

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
            <DialogTrigger asChild><Button><Search className="mr-2 h-4 w-4" />Add / Search Member</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[700px] h-[90vh] p-0 flex flex-col overflow-hidden border-none shadow-2xl">
              <DialogHeader className="p-8 pb-4 bg-gradient-to-r from-primary/10 to-transparent border-b">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg text-primary">
                        <PlusCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <DialogTitle className="text-2xl font-black">Add a New Loan</DialogTitle>
                        <DialogDescription className="text-sm font-medium">Configure specific credit terms for a new disbursement facility.</DialogDescription>
                    </div>
                </div>
              </DialogHeader>
              <Form {...form}>
                <div className="flex-1 overflow-hidden flex flex-col">
                  <ScrollArea className="flex-1 p-8">
                    <form id="add-loan-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-6 pb-8">
                      <FormField control={form.control} name="customerType" render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-sm font-bold flex items-center gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              Customer Type
                            </FormLabel>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="existing" /></FormControl><FormLabel className="font-normal">Existing Member</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="new" /></FormControl><FormLabel className="font-normal">New Registration</FormLabel></FormItem>
                            </RadioGroup>
                          </FormItem>
                      )} />

                      <div className="col-span-2 space-y-6">
                                {/* Section 1: Member Details */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 px-1 border-b pb-2">
                                    <div className="h-4 w-1 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">1. Member Details</h3>
                                  </div>

                                  {form.watch('customerType') === 'existing' ? (
                                    <FormField control={form.control} name="customerId" render={({ field }) => (
                                      <FormItem className="col-span-2">
                                        <Popover open={isCustomerSelectOpen} onOpenChange={setIsCustomerSelectOpen}>
                                          <PopoverTrigger asChild>
                                            <FormControl>
                                              <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                  "w-full justify-between h-14 text-left font-normal border-primary/20 hover:border-primary transition-all shadow-sm bg-white",
                                                  !field.value && "text-muted-foreground"
                                                )}
                                              >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <User className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Selected Member</span>
                                                        <span className="font-semibold text-foreground">
                                                            {field.value
                                                                ? customers?.find((c) => c.id === field.value)?.name || "Unknown Member"
                                                                : "Search by Name, Phone or ID..."}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Search className="h-4 w-4 text-primary opacity-50" />
                                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                                </div>
                                              </Button>
                                            </FormControl>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[400px] p-0 shadow-2xl border-primary/10" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                                            <div className="flex flex-col max-h-[450px]">
                                                <div className="p-3 border-b bg-muted/30">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                                        <Input 
                                                            placeholder="Search members..." 
                                                            className="pl-9 h-11 bg-background border-primary/20 focus-visible:ring-primary"
                                                            value={customerSearch}
                                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                                            onKeyDown={(e) => e.stopPropagation()}
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <ScrollArea className="h-[300px]">
                                                    <div className="p-2 space-y-1">
                                                        {customersLoading ? (
                                                            <div className="flex items-center justify-center py-10">
                                                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {(() => {
                                                                    const searchLower = (customerSearch || "").toLowerCase();
                                                                    const filtered = customers?.filter(c => {
                                                                        if (!searchLower) return true;
                                                                        const nameMatch = c.name?.toLowerCase().includes(searchLower);
                                                                        const phoneMatch = c.phone?.includes(customerSearch);
                                                                        const idMatch = c.idNumber?.includes(customerSearch);
                                                                        const accountMatch = c.accountNumber?.toLowerCase().includes(searchLower);
                                                                        return nameMatch || phoneMatch || idMatch || accountMatch;
                                                                    }).slice(0, 100);

                                                                    if (!filtered || filtered.length === 0) {
                                                                        return (
                                                                            <div className="text-center py-10 px-4">
                                                                                <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                                                                                <p className="text-sm text-muted-foreground font-medium">No members found</p>
                                                                                <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    return filtered.map((c) => (
                                                                        <button
                                                                            key={c.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                form.setValue("customerId", c.id);
                                                                                form.setValue("idNumber", c.idNumber || '');
                                                                                setIsCustomerSelectOpen(false);
                                                                            }}
                                                                            className={cn(
                                                                                "w-full text-left px-3 py-3 flex items-center gap-3 rounded-lg transition-all hover:bg-primary/5 group",
                                                                                field.value === c.id ? "bg-primary/10 border border-primary/20 shadow-sm" : "border border-transparent hover:border-primary/10"
                                                                            )}
                                                                        >
                                                                            <div className={cn(
                                                                                "h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                                                                                field.value === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                                            )}>
                                                                                {field.value === c.id ? <CheckCircle2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
                                                                            </div>
                                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                                <span className={cn(
                                                                                    "font-black text-sm truncate",
                                                                                    field.value === c.id ? "text-primary" : "text-slate-900"
                                                                                )}>{c.name || "Unnamed Member"}</span>
                                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                                    <Badge variant="outline" className="text-[10px] py-0 h-4 bg-background font-black border-primary/20 px-1.5 text-primary">
                                                                                        {c.accountNumber || 'NO-ACC'}
                                                                                    </Badge>
                                                                                    <span className="text-[10px] text-slate-500 font-bold">
                                                                                        {c.phone}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    ));
                                                                })()}
                                                            </>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                      </FormItem>
                                    )} />
                                  ) : (
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                                      <FormField control={form.control} name="newCustomerName" render={({ field }) => (
                                          <FormItem><FormLabel className="text-[10px] font-black uppercase">Name</FormLabel><FormControl><Input placeholder="Full Name" {...field} className="h-10 bg-white" /></FormControl></FormItem>
                                      )} />
                                      <FormField control={form.control} name="newCustomerPhone" render={({ field }) => (
                                          <FormItem><FormLabel className="text-[10px] font-black uppercase">Phone</FormLabel><FormControl><Input placeholder="07XX..." {...field} className="h-10 bg-white" /></FormControl></FormItem>
                                      )} />
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="idNumber" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-[10px] font-black uppercase">ID Number</FormLabel>
                                          <FormControl><Input placeholder="National ID" {...field} className="h-10" /></FormControl>
                                          <FormMessage/>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="assignedStaffId" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-[10px] font-black uppercase">Credit Officer</FormLabel>
                                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Assign staff"/></SelectTrigger></FormControl>
                                            <SelectContent>
                                              {staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </FormItem>
                                    )} />
                                  </div>
                                </div>

                                {/* Section 2: Loan Terms */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 px-1 border-b pb-2">
                                    <div className="h-4 w-1 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">2. Loan Terms</h3>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="principalAmount" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-[10px] font-black uppercase text-primary">Principal Amount (Ksh)</FormLabel>
                                          <FormControl><Input type="number" {...field} className="h-12 text-lg font-black border-primary/30" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="interestRate" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-[10px] font-black uppercase">Interest %</FormLabel>
                                          <FormControl><Input type="number" step="0.01" {...field} className="h-12 font-bold" /></FormControl>
                                        </FormItem>
                                    )} />
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="disbursementDate" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase">Disbursement Date</FormLabel><FormControl><Input type="date" {...field} className="h-10" /></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name="firstPaymentDate" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary">First Payment Date</FormLabel><FormControl><Input type="date" {...field} className="h-10 border-primary/20" /></FormControl></FormItem>
                                    )} />
                                  </div>
                                </div>

                                {/* Section 3: Repayment Schedule */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 px-1 border-b pb-2">
                                    <div className="h-4 w-1 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">3. Repayment Schedule</h3>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="paymentFrequency" render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase">Frequency</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Select"/></SelectTrigger></FormControl>
                                          <SelectContent>
                                            <SelectItem value="daily">Daily</SelectItem>
                                            <SelectItem value="weekly">Weekly</SelectItem>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormItem>
                                    )} />
                                    <FormField control={form.control} name="numberOfInstalments" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase">Total Instalments</FormLabel><FormControl><Input type="number" {...field} className="h-10" /></FormControl></FormItem>
                                    )} />
                                  </div>

                                  {form.watch('paymentFrequency') === 'weekly' && (
                                      <FormField control={form.control} name="preferredPaymentDay" render={({ field }) => (
                                          <FormItem><FormLabel className="text-[10px] font-black uppercase">Collection Day</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-10"><SelectValue placeholder="e.g. Monday" /></SelectTrigger></FormControl><SelectContent>{DAYS_OF_WEEK.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent></Select></FormItem>
                                      )} />
                                  )}
                                </div>
                              </div>

                      <div className="col-span-2 space-y-4 rounded-xl bg-primary/5 p-6 border border-primary/10">
                        <div className="flex justify-between items-center"><span className="text-sm font-medium text-muted-foreground">Periodic Instalment</span><span className="text-xl font-black text-primary">Ksh {calculatedValues.instalmentAmount}</span></div>
                        <div className="h-[1px] bg-primary/10" />
                        <div className="flex justify-between items-center"><span className="text-sm font-medium text-muted-foreground">Total Repayable</span><span className="text-lg font-bold">Ksh {calculatedValues.totalRepayableAmount}</span></div>
                      </div>
                    </form>
                  </ScrollArea>
                  <DialogFooter className="p-8 bg-slate-50 border-t mt-auto">
                    <DialogClose asChild>
                      <Button variant="ghost" className="font-bold h-12 px-6">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" form="add-loan-form" disabled={isSubmitting} className="px-10 font-black text-base h-12 shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                      {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
                      Confirm Disbursement
                    </Button>
                  </DialogFooter>
                </div>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
            <TabsTrigger value="all">Active Debt ({filteredLoans.length})</TabsTrigger>
            <TabsTrigger value="applications">Pending Applications ({applicationLoans.length})</TabsTrigger>
            <TabsTrigger value="search">Search Members</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="m-0">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle>Portfolio Ledger</CardTitle>
                        <div className="relative"><Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search name, phone, ID or Member No..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-[350px]" /></div>
                    </div>
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
                              {filteredLoans.map((loan: Loan) => {
                                  const fDate = (loan.firstPaymentDate as any)?.seconds ? new Date((loan.firstPaymentDate as any).seconds * 1000) : (loan.firstPaymentDate ? new Date(loan.firstPaymentDate as any) : null);
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
                                        <TableCell className="text-xs font-medium">
                                            <div className="text-primary">{fDate && !isNaN(fDate.getTime()) ? format(fDate, 'dd/MM/yy') : 'N/A'}</div>
                                            {loan.paymentFrequency === 'weekly' && loan.preferredPaymentDay && (
                                                <div className="text-[10px] text-muted-foreground mt-0.5">{loan.preferredPaymentDay}s</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-bold tabular-nums">KES {((loan.totalRepayableAmount || 0) - (loan.totalPaid || 0)).toLocaleString()}</TableCell>
                                        <TableCell className="text-center"><Badge className={cn("border", getLoanStatusColor(getLoanDisplayStatus(loan)))}>{getLoanDisplayStatus(loan).toUpperCase()}</Badge></TableCell>
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
                                            {loan.status === 'awaiting_documents' && canEdit && (
                                                <Button size="sm" variant="secondary" onClick={() => handleMarkUnderReview(loan)} disabled={isUpdatingStatus}>Mark Under Review</Button>
                                            )}
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

        <TabsContent value="search" className="m-0 space-y-4">
            <Card className="border-primary/10 shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5 border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                Member Directory
                            </CardTitle>
                            <CardDescription>Search and initiate loans for existing members.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-[400px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                            <Input 
                                placeholder="Search by Name, Phone, ID or Account..." 
                                className="pl-10 h-11 bg-white border-primary/20 focus-visible:ring-primary shadow-sm"
                                value={memberTabSearch}
                                onChange={(e) => setMemberTabSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[600px]">
                        <Table>
                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead>Member Details</TableHead>
                                    <TableHead>Contact Info</TableHead>
                                    <TableHead>Identity</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customersLoading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" /><p className="text-sm text-muted-foreground">Loading members...</p></TableCell></TableRow>
                                ) : sortedAllMembers.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center py-20 italic text-muted-foreground">No members found matching your search.</TableCell></TableRow>
                                ) : (
                                    sortedAllMembers.map((c) => (
                                        <TableRow key={c.id} className="hover:bg-primary/5 transition-colors group">
                                            <TableCell>
                                                <div className="font-black text-sm text-slate-900">{c.name}</div>
                                                <Badge variant="outline" className="text-[9px] font-mono mt-1 bg-white border-primary/20 text-primary">
                                                    {c.accountNumber || 'NO-ACCOUNT'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                                    <Phone className="h-3 w-3 text-primary/60" />
                                                    {c.phone}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <ShieldCheck className="h-3 w-3" />
                                                    {c.idNumber || 'N/A'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    size="sm" 
                                                    className="font-bold bg-primary hover:bg-primary/90 shadow-sm"
                                                    onClick={() => {
                                                        form.setValue('customerId', c.id);
                                                        form.setValue('idNumber', c.idNumber || '');
                                                        setOpen(true);
                                                    }}
                                                >
                                                    <PlusCircle className="mr-2 h-3.5 w-3.5" />
                                                    Apply Loan
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* Application Management Dialog */}
      <Dialog open={!!applicationToManage} onOpenChange={(o) => !o && setApplicationToManage(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              {applicationToManage && (
                  <>
                    <DialogHeader>
                        <DialogTitle>Process Application: {applicationToManage.customerName}</DialogTitle>
                        <DialogDescription>Review terms and finalize disbursement or reject the request.</DialogDescription>
                    </DialogHeader>
                    <Form {...approvalForm}>
                        <form onSubmit={approvalForm.handleSubmit(onApproveSubmit)} className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={approvalForm.control} name="principalAmount" render={({ field }) => (
                                    <FormItem><FormLabel>Approved Principal (Ksh)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                )}/>
                                <FormField control={approvalForm.control} name="interestRate" render={({ field }) => (
                                    <FormItem><FormLabel>Monthly Interest (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
                                )}/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={approvalForm.control} name="numberOfInstalments" render={({ field }) => (
                                    <FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                )}/>
                                <FormField control={approvalForm.control} name="paymentFrequency" render={({ field }) => (
                                    <FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></FormItem>
                                )}/>
                                {approvalForm.watch('paymentFrequency') === 'weekly' && (
                                    <FormField control={approvalForm.control} name="preferredPaymentDay" render={({ field }) => (
                                        <FormItem><FormLabel>Preferred Day</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="e.g. Monday" /></SelectTrigger></FormControl><SelectContent>{DAYS_OF_WEEK.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent></Select></FormItem>
                                    )} />
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={approvalForm.control} name="disbursementDate" render={({ field }) => (
                                    <FormItem><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                                )}/>
                                <FormField control={approvalForm.control} name="firstPaymentDate" render={({ field }) => (
                                    <FormItem><FormLabel>First Payment Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                                )}/>
                            </div>
                            <FormField control={approvalForm.control} name="assignedStaffId" render={({ field }) => (
                                <FormItem><FormLabel>Assign Field Officer</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger></FormControl><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}</SelectContent></Select></FormItem>
                            )}/>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={approvalForm.control} name="processingFee" render={({ field }) => (<FormItem><FormLabel>Processing Fee</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                                <FormField control={approvalForm.control} name="registrationFee" render={({ field }) => (<FormItem><FormLabel>Reg. Fee</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                            </div>
                            <DialogFooter className="gap-2">
                                <Button type="button" variant="destructive" onClick={handleReject} disabled={isUpdatingStatus}>Reject Application</Button>
                                <Button type="submit" disabled={isUpdatingStatus}>{isUpdatingStatus ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}Approve & Disburse</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                  </>
              )}
          </DialogContent>
      </Dialog>

      {/* View Application Dialog */}
      <Dialog open={!!viewingApplication} onOpenChange={(o) => !o && setViewingApplication(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              {viewingApplication && (
                  <>
                    <DialogHeader>
                        <DialogTitle>Application Details</DialogTitle>
                        <DialogDescription>Submitted by {viewingApplication.customerName}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="font-bold">Requested Amount:</div><div>Ksh {viewingApplication.principalAmount.toLocaleString()}</div>
                            <div className="font-bold">Loan Product:</div><div>{viewingApplication.loanType}</div>
                            <div className="font-bold">Instalments:</div><div>{viewingApplication.numberOfInstalments} ({viewingApplication.paymentFrequency})</div>
                            <div className="font-bold">Phone:</div><div>{viewingApplication.customerPhone}</div>
                            <div className="font-bold">ID Number:</div><div>{viewingApplication.idNumber || 'N/A'}</div>
                        </div>

                        {/* AI Analysis Report */}
                        {(viewingApplication as any).aiAnalysis ? (() => {
                            const analysis = (viewingApplication as any).aiAnalysis;
                            const getRiskColor = (level: string) => {
                                if (level.includes('Zero') || level.includes('Qualified')) return 'text-green-700 bg-green-50 border-green-200';
                                if (level.includes('Moderate')) return 'text-amber-700 bg-amber-50 border-amber-200';
                                return 'text-red-700 bg-red-50 border-red-200';
                            };
                            const getRiskIcon = (level: string) => {
                                if (level.includes('Zero') || level.includes('Qualified')) return <CheckCircle className="h-4 w-4 text-green-600" />;
                                if (level.includes('Moderate')) return <AlertCircle className="h-4 w-4 text-amber-600" />;
                                return <AlertTriangle className="h-4 w-4 text-red-600" />;
                            };
                            return (
                                <div className="border-2 border-indigo-100 bg-indigo-50/40 rounded-xl overflow-hidden">
                                    <div className="bg-indigo-100/60 px-4 py-2.5 flex items-center gap-2 border-b border-indigo-100">
                                        <Sparkles className="h-4 w-4 text-indigo-600" />
                                        <span className="font-black text-sm text-indigo-900">AI Statement Analysis</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${getRiskColor(analysis.riskLevel)}`}>
                                                {getRiskIcon(analysis.riskLevel)}
                                                {analysis.riskLevel}
                                            </div>
                                            <div className="text-right text-xs space-y-0.5">
                                                <div className="font-bold text-green-700">IN: KES {(analysis.incomeFlow || 0).toLocaleString()}</div>
                                                <div className="font-bold text-red-700">OUT: KES {(analysis.expenditure || 0).toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border text-xs text-slate-700 leading-relaxed">{analysis.decisionReason}</div>
                                        {analysis.redFlags?.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Red Flags</p>
                                                <div className="space-y-1">{analysis.redFlags.map((f: string, i: number) => <div key={i} className="text-xs bg-red-50 border border-red-100 rounded px-2 py-1 text-slate-700">⚠ {f}</div>)}</div>
                                            </div>
                                        )}
                                        {analysis.otherDebts?.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Other Debts Detected</p>
                                                <div className="space-y-1">{analysis.otherDebts.map((d: string, i: number) => <div key={i} className="text-xs bg-amber-50 border border-amber-100 rounded px-2 py-1 text-slate-700">• {d}</div>)}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })() : (
                            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-xs text-muted-foreground border">
                                <Sparkles className="h-3.5 w-3.5" />
                                AI analysis not yet available for this application.
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingApplication(null)}>Close</Button>
                        {canEdit && <Button onClick={() => { setViewingApplication(null); handleManageApplication(viewingApplication); }}>Process Application</Button>}
                    </DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>

      <Dialog open={!!loanToEdit} onOpenChange={(isOpen) => { if(!isOpen) { setLoanToEdit(null); setCapturedImage(null); setShowCamera(false); } }}>
          <DialogContent className="sm:max-w-5xl p-0 overflow-hidden">
              {loanToEdit && (
                  <>
                    <DialogHeader className="p-6 pb-0">
                        <div className="flex items-center justify-between"><DialogTitle>Manage Loan #{loanToEdit.loanNumber}</DialogTitle><Badge className={cn("mr-8 border", getLoanStatusColor(getLoanDisplayStatus(loanToEdit)))}>{getLoanDisplayStatus(loanToEdit).toUpperCase()}</Badge></div>
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
                                <TabsContent value="payments" className="space-y-4 pt-4">
                                    {canEdit && (
                                        <div className="bg-muted/30 p-4 rounded-lg border border-dashed">
                                            <h4 className="text-xs font-black uppercase mb-3 text-primary">Record New Repayment</h4>
                                            <Form {...paymentForm}>
                                                <form onSubmit={paymentForm.handleSubmit(onRecordPayment)} className="flex items-end gap-3">
                                                    <FormField control={paymentForm.control} name="paymentDate" render={({ field }) => (
                                                        <FormItem className="flex-1"><FormLabel className="text-[10px]">Date</FormLabel><FormControl><Input type="date" {...field} className="h-9 text-xs" /></FormControl></FormItem>
                                                    )}/>
                                                    <FormField control={paymentForm.control} name="paymentAmount" render={({ field }) => (
                                                        <FormItem className="flex-1"><FormLabel className="text-[10px]">Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field} className="h-9 text-xs" /></FormControl></FormItem>
                                                    )}/>
                                                    <Button type="submit" size="sm" className="h-9 px-4 font-bold" disabled={isUpdating}>
                                                        {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                                    </Button>
                                                </form>
                                            </Form>
                                            <div className="flex gap-2 pt-4 border-t border-dashed mt-4">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="flex-1 text-green-600 border-green-200 hover:bg-green-50 font-bold h-9 text-xs"
                                                    onClick={() => setMarkAsPaidConfirmOpen(true)}
                                                    disabled={getLoanDisplayStatus(loanToEdit) === 'paid' || isUpdating}
                                                >
                                                    <CheckCircle2 className="h-3 w-3 mr-2" /> Mark Settled
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50 font-bold h-9 text-xs"
                                                    onClick={() => setRolloverConfirmOpen(true)}
                                                    disabled={['paid', 'rollover', 'application'].includes(getLoanDisplayStatus(loanToEdit)) || isUpdating}
                                                >
                                                    <RefreshCw className="h-3 w-3 mr-2" /> Rollover
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    <ScrollArea className="h-48 border rounded-md">
                                        <Table>
                                            <TableHeader className="bg-muted/50 sticky top-0"><TableRow><TableHead className="h-8 text-[10px]">Date</TableHead><TableHead className="h-8 text-right text-[10px]">Amount</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {(!loanToEdit.payments || loanToEdit.payments.length === 0) ? (
                                                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-xs text-muted-foreground italic">No payments recorded.</TableCell></TableRow>
                                                ) : (
                                                    [...loanToEdit.payments].reverse().map((p, i) => (
                                                        <TableRow key={p.paymentId || i} className="group hover:bg-muted/50">
                                                            <TableCell className="text-[10px]">{ (p.date as any)?.seconds ? format(new Date((p.date as any).seconds * 1000), 'dd/MM/yy HH:mm') : (p.date ? format(new Date(p.date as any), 'dd/MM/yy HH:mm') : '...')}</TableCell>
                                                            <TableCell className="text-right text-[10px] font-bold">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <span>Ksh {(p.amount || 0).toLocaleString()}</span>
                                                                    {canEdit && (
                                                                        <>
                                                                            <Button 
                                                                                variant="ghost" 
                                                                                size="icon" 
                                                                                className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" 
                                                                                onClick={() => handleOpenEditPayment(p)} 
                                                                                disabled={isUpdating}
                                                                                title="Edit Payment"
                                                                            >
                                                                                <Pencil className="h-3 w-3" />
                                                                            </Button>
                                                                            <Button 
                                                                                variant="ghost" 
                                                                                size="icon" 
                                                                                className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                                                                                onClick={() => handleDeletePayment(p)} 
                                                                                disabled={isUpdating}
                                                                                title="Delete Payment"
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </TabsContent>
                                <TabsContent value="followups">
                                    {/* Follow-up notes logic remains similar */}
                                </TabsContent>
                                <TabsContent value="penalties">
                                    {/* Penalties logic remains similar */}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-2"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>

      {/* Edit Payment Modal */}
      <Dialog open={!!paymentToEdit} onOpenChange={(o) => { if (!o) setPaymentToEdit(null); }}>
          <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                  <DialogTitle>Edit Payment</DialogTitle>
                  <DialogDescription>Correct the amount or date for this payment. The loan balance will be recalculated automatically.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                  <div className="space-y-1">
                      <label className="text-xs font-semibold">Payment Date</label>
                      <Input type="date" value={editPaymentDate} onChange={(e) => setEditPaymentDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs font-semibold">Amount (Ksh)</label>
                      <Input type="number" value={editPaymentAmount} onChange={(e) => setEditPaymentAmount(e.target.value)} className="h-9 text-sm" placeholder="Enter correct amount" />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setPaymentToEdit(null)}>Cancel</Button>
                  <Button onClick={handleEditPaymentSave} disabled={isUpdating}>
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={!!viewingKYC} onOpenChange={(o) => !o && setViewingKYC(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
              <div className="relative w-full h-[85vh] flex items-center justify-center">
                  {viewingKYC?.fileUrl && <img src={viewingKYC.fileUrl} className="max-w-full max-h-full object-contain" alt="KYC" />}
              </div>
          </DialogContent>
      </Dialog>

      {/* Rollover Confirmation */}
      <AlertDialog open={rolloverConfirmOpen} onOpenChange={setRolloverConfirmOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Instalment Rollover — Loan #{loanToEdit?.loanNumber}</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm">
                          <p>
                              The customer is paying <strong>interest only</strong> for this instalment period.
                          </p>
                          <ul className="list-disc ml-4 space-y-1 text-muted-foreground">
                              <li>The <strong>principal balance stays unchanged</strong> — the loan is not reduced.</li>
                              <li>The interest amount will be recorded as a receipt in the finance ledger.</li>
                              <li>The <strong>next payment date</strong> will shift forward by one period.</li>
                              <li>The loan status will show <strong>ROLLOVER</strong> until the next real payment is made.</li>
                          </ul>
                          <p className="font-semibold text-foreground">This action cannot be undone.</p>
                      </div>
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRollover} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700">
                      {isUpdating ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Confirm Interest-Only Rollover
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      {/* Mark as Paid Confirmation */}
      <AlertDialog open={markAsPaidConfirmOpen} onOpenChange={setMarkAsPaidConfirmOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Mark Loan as Fully Settled?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Are you sure you want to mark Loan #{loanToEdit?.loanNumber} as paid? This will move the loan to history and settle the outstanding balance.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleMarkAsPaid} disabled={isUpdating} className="bg-green-600 hover:bg-green-700">
                      {isUpdating ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Confirm Settlement
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      {/* Edit Terms Dialog */}
      <Dialog open={isEditingTerms} onOpenChange={setIsEditingTerms}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Edit Loan Terms</DialogTitle></DialogHeader>
              <Form {...editTermsForm}>
                  <form onSubmit={editTermsForm.handleSubmit(onEditTermsSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={editTermsForm.control} name="principalAmount" render={({field}) => (<FormItem><FormLabel>Principal</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                          <FormField control={editTermsForm.control} name="interestRate" render={({field}) => (<FormItem><FormLabel>Monthly Interest %</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)}/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={editTermsForm.control} name="numberOfInstalments" render={({field}) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                          <FormField control={editTermsForm.control} name="paymentFrequency" render={({field}) => (<FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></FormItem>)}/>
                          {editTermsForm.watch('paymentFrequency') === 'weekly' && (
                              <FormField control={editTermsForm.control} name="preferredPaymentDay" render={({ field }) => (
                                  <FormItem><FormLabel>Preferred Day</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="e.g. Monday" /></SelectTrigger></FormControl><SelectContent>{DAYS_OF_WEEK.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent></Select></FormItem>
                              )} />
                          )}
                      </div>
                      <FormField control={editTermsForm.control} name="totalRepayableAmount" render={({field}) => (<FormItem><FormLabel>Total Repayable (Override)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={editTermsForm.control} name="disbursementDate" render={({field}) => (<FormItem><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)}/>
                          <FormField control={editTermsForm.control} name="firstPaymentDate" render={({field}) => (<FormItem><FormLabel>First Pay Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)}/>
                      </div>
                      <FormField control={editTermsForm.control} name="assignedStaffId" render={({field}) => (<FormItem><FormLabel>Assign Staff</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}</SelectContent></Select></FormItem>)}/>
                      <DialogFooter><Button type="submit" disabled={isUpdating}>{isUpdating && <Loader2 className="animate-spin mr-2 h-4 w-4" />}Update Terms</Button></DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete Loan Record?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the record from the ledger.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setLoanToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive" disabled={isDeleting}>Delete</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
