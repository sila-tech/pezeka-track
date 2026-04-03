'use client';

import { useMemo, useState, useRef } from 'react';
import { useAppUser, useCollection, useFirestore, useStorage, useMemoFirebase, useDoc } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Loader2, UserCheck, Send, MessageSquare, Briefcase, FileUp, 
    ShieldCheck, Camera, Upload, ImagePlus, ExternalLink, 
    ArrowRight, Clock, Calendar as CalendarIcon, TrendingUp, HandCoins,
    AlertCircle, Banknote, History as HistoryIcon, CheckCircle2, XCircle, Phone,
    Target, UserPlus, Wallet, Info
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    addDays, addWeeks, addMonths, differenceInDays, differenceInMonths, 
    format, startOfToday, endOfToday, startOfWeek, endOfWeek, 
    startOfMonth, endOfMonth, isWithinInterval 
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { 
    Dialog, DialogContent, DialogDescription, DialogHeader, 
    DialogTitle, DialogTrigger, DialogFooter, DialogClose 
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { addLoan, addFollowUpNoteToLoan, uploadKYCDocument, addExpenseRequest } from '@/lib/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { query, collection, where } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';

interface FollowUpNote {
    noteId: string;
    date: { seconds: number; nanoseconds: number } | Date;
    staffName: string;
    staffId: string;
    content: string;
}

interface DashboardLoan {
  id: string;
  loanNumber: string;
  customerName: string;
  customerPhone: string;
  customerId: string;
  accountNumber?: string; 
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
  disbursementDate: { seconds: number; nanoseconds: number } | any;
  firstPaymentDate?: { seconds: number; nanoseconds: number } | any;
  preferredPaymentDay?: string;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  numberOfInstalments: number;
  instalmentAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  principalAmount: number;
  idNumber?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  followUpNotes?: FollowUpNote[];
  payments?: { amount: number; date: any; staffId?: string }[];
  createdAt?: { seconds: number; nanoseconds: number };
}

const staffLoanSchema = z.object({
  amount: z.coerce.number().min(1000, "Minimum application is Ksh 1,000"),
  idNumber: z.string().min(5, "ID Number is required."),
  alternativeNumber: z.string().optional(),
  reason: z.string().min(10, "Please provide a brief reason for the loan request."),
});

const facilitationRequestSchema = z.object({
    amount: z.coerce.number().min(50, "Minimum request is Ksh 50"),
    description: z.string().min(5, "Please provide a clear reason for this expense."),
});

const followUpNoteSchema = z.object({
    content: z.string().min(5, "Note must be at least 5 characters long."),
});

const kycUploadSchema = z.object({
    customerId: z.string().min(1, "Please select a customer."),
    type: z.enum(['owner_id', 'guarantor_id', 'loan_form', 'security_attachment', 'guarantor_undertaking']),
    fileName: z.string().min(1, "Enter a label for this document."),
});

function DatePickerWithRange({
  className,
  date,
  setDate,
}: {
  className?: string;
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            size="sm"
            className={cn(
              'w-full sm:w-[260px] justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} -{' '}
                  {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function Dashboard() {
  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [isStaffLoanOpen, setIsStaffLoanOpen] = useState(false);
  const [isFacilitationOpen, setIsFacilitationOpen] = useState(false);
  const [isKYCUploadOpen, setIsKYCUploadOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLoanForNotes, setSelectedLoanForNotes] = useState<DashboardLoan | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2' || user?.uid === 'Z8gkNLZEVUWbsooR8R7OuHxApB62';
  const isFinance = user?.role === 'finance';
  const isStaff = user?.role === 'staff' || isFinance;
  const isAuthorized = user && (isSuperAdmin || isStaff);
  
  const canManageKYC = isAuthorized;

  const { data: loans, loading: loansLoading } = useCollection<DashboardLoan>(isAuthorized ? 'loans' : null);
  const { data: customers } = useCollection<any>(isAuthorized ? 'customers' : null);

  const currentMonthKey = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const { data: myGoal, isLoading: goalLoading } = useDoc<any>(user ? `staffGoals/${user.uid}_${currentMonthKey}` : null);

  const myRequestsQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      return query(collection(firestore, 'expenseRequests'), where('staffId', '==', user.uid));
  }, [user, firestore]);

  const { data: facilitationRequests } = useCollection<any>(myRequestsQuery);

  const myExpensesQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      return query(collection(firestore, 'financeEntries'), where('staffId', '==', user.uid), where('type', '==', 'expense'));
  }, [user, firestore]);

  const { data: myApprovedExpenses } = useCollection<any>(myExpensesQuery);

  const staffLoanForm = useForm<z.infer<typeof staffLoanSchema>>({
    resolver: zodResolver(staffLoanSchema),
    defaultValues: { amount: 0, reason: '', idNumber: '', alternativeNumber: '' },
  });

  const facilitationForm = useForm<z.infer<typeof facilitationRequestSchema>>({
      resolver: zodResolver(facilitationRequestSchema),
      defaultValues: { amount: 0, description: '' }
  });

  const noteForm = useForm<z.infer<typeof followUpNoteSchema>>({
      resolver: zodResolver(followUpNoteSchema),
      defaultValues: { content: '' },
  });

  const kycForm = useForm<z.infer<typeof kycUploadSchema>>({
      resolver: zodResolver(kycUploadSchema),
      defaultValues: { customerId: '', type: 'owner_id', fileName: '' },
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
      setCapturedImage(null);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings to capture KYC photos.',
      });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  async function onKYCSubmit(values: z.infer<typeof kycUploadSchema>) {
      if (!user || !canManageKYC) return;
      if (!capturedImage) {
          toast({ variant: 'destructive', title: 'Photo Required', description: 'Please capture or select a photo of the document before saving.' });
          return;
      }
      setIsSubmitting(true);
      try {
          const customer = customers?.find(c => c.id === values.customerId);
          await uploadKYCDocument(firestore, storage, {
              ...values,
              customerId: values.customerId,
              customerName: customer?.name || "Unknown",
              fileUrl: capturedImage,
              uploadedBy: user.name || user.email || "Staff"
          });
          toast({ title: "Document Captured", description: "Image metadata saved to the Repository." });
          kycForm.reset();
          setCapturedImage(null);
          setIsKYCUploadOpen(false);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Upload Failed', description: e.message });
      } finally {
          setIsSubmitting(false);
      }
  }

  async function onFacilitationSubmit(values: z.infer<typeof facilitationRequestSchema>) {
      if (!user) return;
      setIsSubmitting(true);
      try {
          await addExpenseRequest(firestore, {
              staffId: user.uid,
              staffName: user.name || user.email?.split('@')[0] || "Staff",
              amount: values.amount,
              description: values.description,
              category: 'facilitation'
          });
          toast({ title: 'Request Submitted', description: 'Your facilitation request is pending Finance approval.' });
          facilitationForm.reset();
          setIsFacilitationOpen(false);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Request Failed', description: e.message });
      } finally {
          setIsSubmitting(false);
      }
  }

  async function onStaffLoanSubmit(values: z.infer<typeof staffLoanSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const loanData = {
        customerId: user.uid,
        customerName: user.name || user.email?.split('@')[0] || "Staff",
        customerPhone: "Internal Staff",
        accountNumber: "STAFF",
        disbursementDate: new Date(),
        firstPaymentDate: addMonths(new Date(), 1),
        principalAmount: values.amount,
        interestRate: 0, 
        registrationFee: 0,
        processingFee: 0,
        carTrackInstallationFee: 0,
        chargingCost: 0,
        numberOfInstalments: 1,
        paymentFrequency: 'monthly' as const,
        status: 'application' as const,
        loanType: 'Staff Loan',
        instalmentAmount: values.amount,
        totalRepayableAmount: values.amount,
        totalPaid: 0,
        idNumber: values.idNumber,
        alternativeNumber: values.alternativeNumber || "",
        comments: `Staff Loan Application: ${values.reason}`,
      };
      await addLoan(firestore, loanData);
      toast({ title: "Application Submitted" });
      staffLoanForm.reset();
      setIsStaffLoanOpen(false);
    } catch (e: any) { toast({ variant: "destructive", title: "Failed", description: e.message }); } finally { setIsSubmitting(false); }
  }

  async function onAddNoteSubmit(values: z.infer<typeof followUpNoteSchema>) {
      if (!selectedLoanForNotes || !user) return;
      setIsAddingNote(true);
      try {
          await addFollowUpNoteToLoan(firestore, selectedLoanForNotes.id, { content: values.content, staffName: user.name || user.email?.split('@')[0] || "Staff", staffId: user.uid });
          toast({ title: "Note Added" });
          noteForm.reset();
      } catch (e: any) { toast({ variant: 'destructive', title: 'Action Failed', description: e.message }); } finally { setIsAddingNote(false); }
  }

  const myPortfolio = useMemo(() => {
      if (!loans || !user) return [];
      return loans.filter(loan => 
          loan.assignedStaffId === user.uid && 
          loan.status !== 'application' && 
          loan.status !== 'rejected' &&
          loan.status !== 'rollover'
      );
  }, [loans, user]);

  const myMonthlyExpenses = useMemo(() => {
      if (!myApprovedExpenses) return 0;
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());
      return myApprovedExpenses.reduce((acc, exp) => {
          const date = exp.date?.seconds ? new Date(exp.date.seconds * 1000) : new Date(exp.date);
          if (date >= start && date <= end) return acc + Number(exp.amount);
          return acc;
      }, 0);
  }, [myApprovedExpenses]);

  const myPortfolioStats = useMemo(() => {
      const fromDate = date?.from;
      const toDate = date?.to || date?.from;
      
      const interval = fromDate ? { 
          start: new Date(fromDate).setHours(0, 0, 0, 0), 
          end: new Date(toDate!).setHours(23, 59, 59, 999) 
      } : null;

      let periodDisbursed = 0;
      let periodCollected = 0;

      myPortfolio.forEach(loan => {
          const dDate = loan.disbursementDate?.seconds 
              ? new Date(loan.disbursementDate.seconds * 1000) 
              : (loan.disbursementDate instanceof Date ? loan.disbursementDate : new Date(loan.disbursementDate));
          
          if (!interval || isWithinInterval(dDate, interval)) {
              periodDisbursed += Number(loan.principalAmount) || 0;
          }

          (loan.payments || []).forEach(payment => {
              const pDate = (payment.date as any)?.seconds 
                  ? new Date((payment.date as any).seconds * 1000) 
                  : new Date(payment.date as Date);
              
              if (!interval || isWithinInterval(pDate, interval)) {
                  periodCollected += Number(payment.amount) || 0;
              }
          });
      });

      const activeLoansCount = myPortfolio.filter(l => l.status !== 'paid' && l.status !== 'rollover').length;

      return { 
          activeCount: activeLoansCount, 
          totalDisbursed: periodDisbursed, 
          totalCollected: periodCollected 
      };
  }, [myPortfolio, date]);

  const myMonthlyProgress = useMemo(() => {
      if (!user || !loans || !customers) return { onboarding: 0, disbursement: 0, collection: 0 };
      
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());
      const interval = { start, end };

      const myOnboarded = customers.filter(c => {
          if (c.registeredByStaffId !== user.uid) return false;
          const cDate = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : new Date();
          return isWithinInterval(cDate, interval);
      }).length;

      let myDisbursed = 0;
      let myCollected = 0;

      loans.forEach(loan => {
          if (loan.assignedStaffId === user.uid && loan.status !== 'application' && loan.status !== 'rejected') {
              const dDate = loan.disbursementDate?.seconds 
                  ? new Date(loan.disbursementDate.seconds * 1000) 
                  : (loan.disbursementDate instanceof Date ? loan.disbursementDate : new Date());
              
              if (isWithinInterval(dDate, interval)) {
                  myDisbursed += Number(loan.principalAmount) || 0;
              }
          }

          (loan.payments || []).forEach(p => {
              const isMine = p.staffId === user.uid || p.recordedBy === (user.name || user.email);
              if (isMine) {
                  const pDate = (p.date as any)?.seconds ? new Date((p.date as any).seconds * 1000) : new Date(p.date as any);
                  if (isWithinInterval(pDate, interval)) {
                      myCollected += Number(p.amount) || 0;
                  }
              }
          });
      });

      return { onboarding: myOnboarded, disbursement: myDisbursed, collection: myCollected };
  }, [user, loans, customers]);

  const activeTargets = useMemo(() => {
      return {
          onboarding: myGoal?.onboardingTarget || 20,
          disbursement: myGoal?.disbursementTarget || 1000000,
          collection: myGoal?.collectionTarget || 800000
      };
  }, [myGoal]);

  const processedLoansWithTimeline = useMemo(() => {
      if (!loans) return [];
      const today = startOfToday();

      return loans.filter(loan => 
          loan.status !== 'paid' && 
          loan.status !== 'application' && 
          loan.status !== 'rejected' &&
          loan.status !== 'rollover'
      ).map(loan => {
          const currentCustomer = customers?.find(c => c.id === loan.customerId);
          
          let baseDate: Date;
          if (loan.firstPaymentDate?.seconds) {
              baseDate = new Date(loan.firstPaymentDate.seconds * 1000);
          } else if (loan.firstPaymentDate instanceof Date) {
              baseDate = loan.firstPaymentDate;
          } else {
              const dDate = loan.disbursementDate?.seconds 
                  ? new Date(loan.disbursementDate.seconds * 1000) 
                  : (loan.disbursementDate instanceof Date ? loan.disbursementDate : new Date());
              
              if (loan.paymentFrequency === 'daily') baseDate = addDays(dDate, 1);
              else if (loan.paymentFrequency === 'weekly') baseDate = addWeeks(dDate, 1);
              else baseDate = addMonths(dDate, 1);
          }

          if (isNaN(baseDate.getTime())) baseDate = new Date();
          
          const instalmentAmt = loan.instalmentAmount || 1;
          const totalPaid = loan.totalPaid || 0;
          const actualInstalmentsPaid = totalPaid / instalmentAmt;

          let cyclesPassed = 0;
          if (loan.paymentFrequency === 'daily') cyclesPassed = differenceInDays(today, baseDate);
          else if (loan.paymentFrequency === 'weekly') cyclesPassed = Math.floor(differenceInDays(today, baseDate) / 7);
          else if (loan.paymentFrequency === 'monthly') cyclesPassed = differenceInMonths(today, baseDate);

          const expectedByNow = cyclesPassed < 0 ? 0 : cyclesPassed + 1;
          const arrearsCount = Math.max(0, expectedByNow - actualInstalmentsPaid);
          
          const nextInstalmentIndex = Math.floor(actualInstalmentsPaid);
          let nextDueDate: Date;
          if (loan.paymentFrequency === 'daily') nextDueDate = addDays(baseDate, nextInstalmentIndex);
          else if (loan.paymentFrequency === 'weekly') nextDueDate = addWeeks(baseDate, nextInstalmentIndex);
          else nextDueDate = addMonths(baseDate, nextInstalmentIndex);

          const remainingBalance = Math.max(0, (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0));
          const arrearsBalance = Math.min(arrearsCount * instalmentAmt, remainingBalance);

          return { 
              ...loan, 
              displayName: currentCustomer?.name || loan.customerName,
              nextDueDate, 
              arrearsCount, 
              arrearsBalance,
              daysUntil: differenceInDays(nextDueDate, today)
          };
      });
  }, [loans, customers]);

  const priorityDueLoans = useMemo(() => {
      return processedLoansWithTimeline.filter(loan => {
          return loan.arrearsBalance > 0;
      }).sort((a, b) => a.daysUntil - b.daysUntil);
  }, [processedLoansWithTimeline]);

  const dailyDue = useMemo(() => processedLoansWithTimeline.filter(l => l.paymentFrequency === 'daily').sort((a, b) => a.daysUntil - b.daysUntil), [processedLoansWithTimeline]);
  const weeklyDue = useMemo(() => processedLoansWithTimeline.filter(l => l.paymentFrequency === 'weekly').sort((a, b) => a.daysUntil - b.daysUntil), [processedLoansWithTimeline]);

  const newApplications = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => loan.status === 'application').map(loan => {
        const currentCustomer = customers?.find(c => c.id === loan.customerId);
        return { ...loan, displayName: currentCustomer?.name || loan.customerName };
    }).sort((a, b) => {
        const tsA = a.createdAt?.seconds || 0;
        const tsB = b.createdAt?.seconds || 0;
        return tsB - tsA;
    });
  }, [loans, customers]);

  if (userLoading || loansLoading || goalLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Welcome, {user?.name || user?.email?.split('@')[0] || 'Admin'}!</h1>
        <div className="flex flex-wrap gap-2">
            {canManageKYC && (
                <Dialog open={isKYCUploadOpen} onOpenChange={(open) => { setIsKYCUploadOpen(open); if(!open) { stopCamera(); setCapturedImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; } }}>
                    <DialogTrigger asChild><Button variant="outline" className="border-primary/20 text-primary"><FileUp className="mr-2 h-4 w-4" />Capture KYC</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-0"><DialogTitle>Customer KYC Capture</DialogTitle><DialogDescription>Select an image from gallery or take a new photo.</DialogDescription></DialogHeader>
                        <ScrollArea className="max-h-[70vh] px-6 py-4">
                            <Form {...kycForm}>
                                <form id="kyc-upload-form" onSubmit={kycForm.handleSubmit(onKYCSubmit)} className="space-y-4">
                                    <FormField control={kycForm.control} name="customerId" render={({ field }) => (
                                        <FormItem><FormLabel>Select Customer</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Search member..." /></SelectTrigger></FormControl><SelectContent>{customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.accountNumber})</SelectItem>)}</SelectContent></Select></FormItem>
                                    )}/>
                                    <FormField control={kycForm.control} name="type" render={({ field }) => (
                                        <FormItem><FormLabel>Document Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="owner_id">Owner ID Card</SelectItem><SelectItem value="guarantor_id">Guarantor ID Card</SelectItem><SelectItem value="loan_form">Physical Loan Form</SelectItem><SelectItem value="security_attachment">Security Photos/Docs</SelectItem><SelectItem value="guarantor_undertaking">Guarantor Undertaking</SelectItem></SelectContent></Select></FormItem>
                                    )}/>
                                    <FormField control={kycForm.control} name="fileName" render={({ field }) => (<FormItem><FormLabel>Document Label/Note</FormLabel><FormControl><Input placeholder="e.g. ID Front Side" {...field} /></FormControl></FormItem>)}/>
                                    <div className="space-y-4 pt-2">
                                        <div className="relative min-h-[200px] max-h-[300px] bg-zinc-900 rounded-lg overflow-hidden border-2 border-muted flex items-center justify-center">
                                            {!showCamera && !capturedImage && (<div className="text-center space-y-4 p-6"><div className="flex flex-col items-center gap-2"><ImagePlus className="h-10 w-10 text-muted-foreground" /><p className="text-xs text-muted-foreground">No document selected</p></div><div className="flex flex-col gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Gallery</Button><Button type="button" variant="outline" size="sm" onClick={startCamera}><Camera className="mr-2 h-4 w-4" /> Take Photo</Button></div><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} /></div>)}
                                            <video ref={videoRef} className={`w-full h-full object-contain ${showCamera ? 'block' : 'hidden'}`} autoPlay muted playsInline />
                                            {capturedImage && (<img src={capturedImage} alt="Captured KYC" className="max-w-full max-h-full object-contain shadow-2xl" />)}
                                        </div>
                                        {showCamera && (<div className="flex gap-2"><Button type="button" className="flex-1" size="sm" onClick={capturePhoto}>Capture Photo</Button><Button type="button" variant="outline" size="sm" onClick={stopCamera}>Cancel</Button></div>)}
                                        {capturedImage && (<div className="flex gap-2"><Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Change</Button><Button type="button" variant="outline" size="sm" className="flex-1" onClick={startCamera}><Camera className="h-4 w-4 mr-2" /> Retake</Button></div>)}
                                    </div>
                                </form>
                            </Form>
                        </ScrollArea>
                        <DialogFooter className="p-6 pt-2"><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="kyc-upload-form" disabled={isSubmitting || !capturedImage}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Record Document</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            <Dialog open={isFacilitationOpen} onOpenChange={setIsFacilitationOpen}>
                <DialogTrigger asChild><Button variant="outline" className="border-green-200 text-green-700 bg-green-50 hover:bg-green-100"><Banknote className="mr-2 h-4 w-4" />Request Facilitation</Button></DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Facilitation Request</DialogTitle><DialogDescription>Submit a request for operational funds. Requires Finance approval.</DialogDescription></DialogHeader>
                    <Form {...facilitationForm}>
                        <form onSubmit={facilitationForm.handleSubmit(onFacilitationSubmit)} className="space-y-4 pt-4">
                            <FormField control={facilitationForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={facilitationForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Reason / Expense Details</FormLabel><FormControl><Textarea placeholder="Details of the expense..." {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <DialogFooter><Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}Submit Request</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isStaffLoanOpen} onOpenChange={setIsStaffLoanOpen}>
            <DialogTrigger asChild><Button variant="secondary"><UserCheck className="mr-2 h-4 w-4" />Staff Loan</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0"><DialogTitle>Staff Loan Application</DialogTitle><DialogDescription>Apply for an internal staff credit facility.</DialogDescription></DialogHeader>
                <ScrollArea className="max-h-[60vh] px-6 py-4">
                    <Form {...staffLoanForm}>
                        <form id="staff-loan-form" onSubmit={staffLoanForm.handleSubmit(onStaffLoanSubmit)} className="space-y-4">
                            <FormField control={staffLoanForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={staffLoanForm.control} name="idNumber" render={({ field }) => (<FormItem><FormLabel>ID Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={staffLoanForm.control} name="alternativeNumber" render={({ field }) => (<FormItem><FormLabel>Alt. Phone</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>)}/>
                            </div>
                            <FormField control={staffLoanForm.control} name="reason" render={({ field }) => (<FormItem><FormLabel>Reason</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                        </form>
                    </Form>
                </ScrollArea>
                <DialogFooter className="p-6 pt-2"><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="staff-loan-form" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit Application</Button></DialogFooter>
            </DialogContent>
            </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2"><ShieldCheck className="h-3 w-3" /> Active Debt</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{myPortfolioStats.activeCount}</div><p className="text-[10px] text-muted-foreground mt-1">Total assigned active loans</p></CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2"><HandCoins className="h-3 w-3" /> Period Disbursed</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">Ksh {myPortfolioStats.totalDisbursed.toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">Capital advanced in window</p></CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2"><TrendingUp className="h-3 w-3 text-green-600" /> Period Collected</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-600">Ksh {myPortfolioStats.totalCollected.toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">Total payments processed</p></CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2"><Banknote className="h-3 w-3 text-orange-600" /> My Monthly Expenses</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-orange-600">Ksh {myMonthlyExpenses.toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">Facilitation used in {format(new Date(), 'MMMM')}</p></CardContent>
          </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="goals">My Goals <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary text-[10px] border-none">LIVE</Badge></TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="m-0 space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                    <Card className="flex flex-col h-[500px]">
                        <CardHeader className="pb-2"><div className="flex items-center justify-between"><div><CardTitle>Due Loans & Follow-ups</CardTitle><CardDescription>Detailed repayment tracking and cycle management.</CardDescription></div><DatePickerWithRange date={date} setDate={setDate} /></div></CardHeader>
                        <CardContent className="flex-1 overflow-hidden p-0">
                            <Tabs defaultValue="all" className="h-full flex flex-col">
                                <div className="px-6 pb-2"><TabsList className="grid grid-cols-3 w-full"><TabsTrigger value="all" className="text-xs">Priority ({priorityDueLoans.length})</TabsTrigger><TabsTrigger value="daily" className="text-xs">Daily ({dailyDue.length})</TabsTrigger><TabsTrigger value="weekly" className="text-xs">Weekly ({weeklyDue.length})</TabsTrigger></TabsList></div>
                                <div className="flex-1 overflow-hidden">
                                    <TabsContent value="all" className="h-full m-0 p-0">
                                        {priorityDueLoans.length === 0 ? (<div className="p-12 text-center h-full flex flex-col items-center justify-center"><Clock className="h-12 w-12 text-muted-foreground/20 mb-4" /><p className="text-muted-foreground font-medium">No urgent follow-ups required.</p></div>) : (
                                            <ScrollArea className="h-full"><Table><TableHeader className="sticky top-0 bg-card z-10"><TableRow><TableHead>Member & Phone</TableHead><TableHead>Schedule</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Arrears/Inst.</TableHead><TableHead className="text-center">Action</TableHead></TableRow></TableHeader>
                                                    <TableBody>{priorityDueLoans.map((loan) => (
                                                            <TableRow key={loan.id}><TableCell>
                                                                <div className="font-bold text-xs">{loan.displayName}</div>
                                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5"><Phone className="h-2.5 w-2.5" /> {loan.customerPhone}</div>
                                                                <div className="text-[9px] font-mono text-primary/60">{loan.accountNumber}</div>
                                                            </TableCell><TableCell>
                                                                <div className="text-[10px] font-bold uppercase">{loan.paymentFrequency}</div>
                                                                {loan.paymentFrequency === 'weekly' && loan.preferredPaymentDay && (
                                                                    <div className="text-[9px] text-blue-600 font-black">{loan.preferredPaymentDay}</div>
                                                                )}
                                                            </TableCell><TableCell>{loan.daysUntil < 0 ? <Badge variant="destructive" className="text-[8px]">LATE {Math.abs(loan.daysUntil)}d</Badge> : <Badge variant="secondary" className="text-[8px]">DUE {loan.daysUntil}d</Badge>}</TableCell><TableCell className="text-right whitespace-nowrap"><div className={cn("font-black tabular-nums text-xs", loan.arrearsBalance > 0 ? "text-destructive" : "text-green-600")}>Ksh {loan.arrearsBalance.toLocaleString()}</div></TableCell><TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => setSelectedLoanForNotes(loan as any)}><MessageSquare className="h-4 w-4 text-blue-600" /></Button></TableCell></TableRow>
                                                        ))}</TableBody>
                                                </Table></ScrollArea>
                                        )}
                                    </TabsContent>
                                    <TabsContent value="daily" className="h-full m-0 p-0"><ScrollArea className="h-full"><Table><TableHeader className="sticky top-0 bg-card z-10"><TableRow><TableHead>Customer & Phone</TableHead>  <TableHead>Due</TableHead><TableHead className="text-right">Balance</TableHead><TableHead/></TableRow></TableHeader><TableBody>{dailyDue.map(loan => (<TableRow key={loan.id}><TableCell><div className="font-bold text-xs">{loan.displayName}</div><div className="text-[10px] text-muted-foreground">{loan.customerPhone}</div></TableCell><TableCell><Badge variant="outline" className="text-[8px]">{loan.daysUntil === 0 ? 'TODAY' : loan.daysUntil < 0 ? 'LATE' : 'SOON'}</Badge></TableCell><TableCell className="text-right font-bold text-xs tabular-nums">Ksh {loan.arrearsBalance.toLocaleString()}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => setSelectedLoanForNotes(loan as any)}><MessageSquare className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table></ScrollArea></TabsContent>
                                    <TabsContent value="weekly" className="h-full m-0 p-0"><ScrollArea className="h-full"><Table><TableHeader className="sticky top-0 bg-card z-10"><TableRow><TableHead>Customer & Phone</TableHead><TableHead>Day</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Balance</TableHead><TableHead/></TableRow></TableHeader><TableBody>{weeklyDue.map(loan => (<TableRow key={loan.id}><TableCell><div className="font-bold text-xs">{loan.displayName}</div><div className="text-[10px] text-muted-foreground">{loan.customerPhone}</div></TableCell><TableCell><div className="text-[10px] font-black text-blue-600 uppercase">{loan.preferredPaymentDay || '-'}</div></TableCell><TableCell><Badge variant="outline" className="text-[8px]">{loan.daysUntil === 0 ? 'TODAY' : loan.daysUntil < 0 ? 'LATE' : 'SOON'}</Badge></TableCell><TableCell className="text-right font-bold text-xs tabular-nums">Ksh {loan.arrearsBalance.toLocaleString()}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => setSelectedLoanForNotes(loan as any)}><MessageSquare className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table></ScrollArea></TabsContent>
                                </div>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <Card className="h-[300px]">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between"><div><CardTitle className="text-lg flex items-center gap-2"><HistoryIcon className="h-5 w-5 text-primary" /> Facilitation Requests</CardTitle><CardDescription>Status of your operational expense requests.</CardDescription></div></CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[220px]"><Table><TableHeader className="sticky top-0 bg-card z-10"><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                                    <TableBody>{facilitationRequests?.length === 0 ? (<TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">No requests made yet.</TableCell></TableRow>) : (
                                            [...facilitationRequests || []].sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((req) => (
                                                <TableRow key={req.id}><TableCell className="text-[10px]">{req.createdAt?.seconds ? format(new Date(req.createdAt.seconds * 1000), 'dd/MM') : '...'}</TableCell><TableCell className="font-bold text-xs">Ksh {req.amount.toLocaleString()}</TableCell><TableCell className="text-[10px] max-w-[150px] truncate">{req.description}</TableCell><TableCell className="text-right"><Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[8px] font-black uppercase">{req.status}</Badge></TableCell></TableRow>
                                            ))
                                        )}</TableBody>
                                </Table></ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                <Card className="flex flex-col h-[816px]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><div><CardTitle>New Applications</CardTitle><CardDescription>Latest customer self-submissions.</CardDescription></div><Button variant="outline" size="sm" asChild><Link href="/admin/loans">Review All <ArrowRight className="ml-2 h-3 w-3" /></Link></Button></CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                        {newApplications.length === 0 ? (<div className="p-12 text-center h-full flex flex-col items-center justify-center"><AlertCircle className="h-12 w-12 text-muted-foreground/20 mb-4" /><p className="text-muted-foreground font-medium">No pending applications.</p></div>) : (
                            <ScrollArea className="h-full"><Table><TableHeader className="sticky top-0 bg-card z-10"><TableRow><TableHead>Identity & Phone</TableHead><TableHead>Member No</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                                    <TableBody>{newApplications.map((loan) => (
                                            <TableRow key={loan.id} className="group"><TableCell><div className="font-bold text-xs">{loan.displayName}</div><div className="text-[10px] text-muted-foreground">Ph: {loan.customerPhone}</div></TableCell><TableCell className="text-xs font-bold text-primary">{loan.accountNumber || 'N/A'}</TableCell><TableCell className="text-right font-bold text-xs tabular-nums text-green-600">KES {(loan.principalAmount || 0).toLocaleString()}</TableCell><TableCell><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild><Link href="/admin/loans"><ExternalLink className="h-3 w-3" /></Link></Button></TableCell></TableRow>
                                        ))}</TableBody>
                                </Table></ScrollArea>
                        )}
                    </CardContent>
                </Card>
              </div>
          </TabsContent>

          <TabsContent value="goals" className="m-0">
              <div className="grid gap-6 md:grid-cols-3">
                  <GoalCard 
                    title="Customer Onboarding" 
                    icon={<UserPlus className="h-5 w-5 text-blue-600" />} 
                    current={myMonthlyProgress.onboarding} 
                    target={activeTargets.onboarding} 
                    unit="Members" 
                    description="New customer registrations this month." 
                  />
                  <GoalCard 
                    title="Monthly Disbursement" 
                    icon={<HandCoins className="h-5 w-5 text-primary" />} 
                    current={myMonthlyProgress.disbursement} 
                    target={activeTargets.disbursement} 
                    unit="Ksh" 
                    description="Total principal advanced to customers." 
                  />
                  <GoalCard 
                    title="Collection Target" 
                    icon={<Wallet className="h-5 w-5 text-green-600" />} 
                    current={myMonthlyProgress.collection} 
                    target={activeTargets.collection} 
                    unit="Ksh" 
                    description="Total repayments collected from the field." 
                  />
              </div>

              {!myGoal && (
                  <Alert className="mt-6 bg-blue-50 border-blue-200">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800">Standard Monthly Targets</AlertTitle>
                      <AlertDescription className="text-blue-700">
                          Finance has not yet set specific targets for your profile this month. Showing standard company targets.
                      </AlertDescription>
                  </Alert>
              )}

              <Card className="mt-6 border-dashed bg-muted/20">
                  <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                          <Target className="h-5 w-5 text-primary" />
                          About Your Goals
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-4 max-w-3xl">
                      <p>Goals are automatically calculated based on your activity during the current calendar month. Progress is tracked from your registered customer profiles, loans assigned to you, and payments you record.</p>
                      <ul className="list-disc pl-5 space-y-2">
                          <li><strong>Onboarding</strong>: Count of customers where you are the 'Registered By' staff member.</li>
                          <li><strong>Disbursement</strong>: Sum of principal amounts for loans assigned to you and disbursed this month.</li>
                          <li><strong>Collection</strong>: Sum of all loan payments you have recorded in the system this month.</li>
                      </ul>
                      <p className="italic font-medium text-primary">Consistently meeting your targets helps improve the Pezeka community and your internal performance rating.</p>
                  </CardContent>
              </Card>
          </TabsContent>
      </Tabs>

      <Dialog open={!!selectedLoanForNotes} onOpenChange={(open) => !open && setSelectedLoanForNotes(null)}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden">
              {selectedLoanForNotes && (
                  <><DialogHeader className="p-6 pb-0"><DialogTitle className="text-lg">Follow-up: {selectedLoanForNotes.customerName}</DialogTitle><DialogDescription>Record interactions.</DialogDescription></DialogHeader>
                    <div className="space-y-4 px-6 py-4">
                        <Form {...noteForm}><form onSubmit={noteForm.handleSubmit(onAddNoteSubmit)} className="space-y-2"><FormField control={noteForm.control} name="content" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="Notes..." className="h-16 text-sm" {...field} value={field.value ?? ''} /></FormControl></FormItem>)}/><Button type="submit" className="w-full" size="sm" disabled={isAddingNote}>{isAddingNote ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}Save Note</Button></form></Form>
                        <ScrollArea className="h-40 border rounded-md p-3">{(!selectedLoanForNotes.followUpNotes || selectedLoanForNotes.followUpNotes.length === 0) ? (<p className="text-xs text-muted-foreground text-center py-8 italic">No interactions.</p>) : (<div className="space-y-3">{[...selectedLoanForNotes.followUpNotes].reverse().map((note, index) => (<div key={note.noteId || index} className="bg-muted/50 p-2 rounded border text-xs"><div className="flex justify-between items-center mb-1"><span className="font-bold">{note.staffName}</span><span className="text-[9px]">{note.date?.seconds ? format(new Date(note.date.seconds * 1000), 'dd/MM HH:mm') : '...'}</span></div><p className="italic">"{note.content}"</p></div>))}</div>)}</ScrollArea>
                    </div><DialogFooter className="p-6 pt-2"><DialogClose asChild><Button variant="outline" size="sm" className="w-full">Close</Button></DialogClose></DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>
    </div>
  );
}

function GoalCard({ title, icon, current, target, unit, description }: { title: string, icon: React.ReactNode, current: number, target: number, unit: string, description: string }) {
    const percentage = Math.min(100, Math.round((current / (target || 1)) * 100));
    
    return (
        <Card className="overflow-hidden border-t-4 border-t-primary/20">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="bg-muted/50 p-2 rounded-lg">{icon}</div>
                    <Badge variant={percentage >= 100 ? 'default' : 'secondary'} className={cn(percentage >= 100 ? "bg-green-600" : "")}>
                        {percentage}%
                    </Badge>
                </div>
                <CardTitle className="text-base font-black mt-3">{title}</CardTitle>
                <CardDescription className="text-[10px] leading-tight">{description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black">{unit === 'Ksh' ? 'Ksh ' : ''}{current.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">/ {(target || 0).toLocaleString()} {unit === 'Ksh' ? '' : unit}</span>
                </div>
                <Progress value={percentage} className="h-2 mt-4" />
                <p className="text-[9px] text-muted-foreground mt-3 font-medium italic">
                    {percentage >= 100 ? "Goal achieved! Excellent work." : `Remaining: ${unit === 'Ksh' ? 'Ksh ' : ''}${Math.max(0, (target || 0) - current).toLocaleString()} ${unit === 'Ksh' ? '' : unit}`}
                </p>
            </CardContent>
        </Card>
    );
}
