'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useAppUser, useCollection, useFirestore, useStorage } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, UserCheck, Send, MessageSquare, Briefcase, CalendarDays, ExternalLink, ArrowRight, FileUp, ShieldCheck, Camera, RefreshCw, CheckCircle2, Upload, ImagePlus, Calendar, AlertTriangle, FastForward } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { addDays, addWeeks, addMonths, differenceInDays, differenceInMonths, format, startOfToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { addLoan, addFollowUpNoteToLoan, uploadKYCDocument } from '@/lib/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
}

const staffLoanSchema = z.object({
  amount: z.coerce.number().min(1000, "Minimum application is Ksh 1,000"),
  idNumber: z.string().min(5, "ID Number is required."),
  alternativeNumber: z.string().optional(),
  reason: z.string().min(10, "Please provide a brief reason for the loan request."),
});

const followUpNoteSchema = z.object({
    content: z.string().min(5, "Note must be at least 5 characters long."),
});

const kycUploadSchema = z.object({
    customerId: z.string().min(1, "Please select a customer."),
    type: z.enum(['owner_id', 'guarantor_id', 'loan_form', 'security_attachment', 'guarantor_undertaking']),
    fileName: z.string().min(1, "Enter a label for this document."),
});

export default function Dashboard() {
  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [isStaffLoanOpen, setIsStaffLoanOpen] = useState(false);
  const [isKYCUploadOpen, setIsKYCUploadOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLoanForNotes, setSelectedLoanForNotes] = useState<DashboardLoan | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);

  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthorized = user ? (user.email?.toLowerCase() === 'simon@pezeka.com' || user.role?.toLowerCase() === 'staff' || user.role?.toLowerCase() === 'finance' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2') : false;
  
  const { data: loans, loading: loansLoading } = useCollection<DashboardLoan>(isAuthorized ? 'loans' : null);
  const { data: customers } = useCollection<any>(isAuthorized ? 'customers' : null);

  const staffLoanForm = useForm<z.infer<typeof staffLoanSchema>>({
    resolver: zodResolver(staffLoanSchema),
    defaultValues: { amount: 0, reason: '', idNumber: '', alternativeNumber: '' },
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
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
      setCapturedImage(null);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
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
      if (!user) return;
      if (!capturedImage) {
          toast({ variant: 'destructive', title: 'Photo Required', description: 'Please capture or select a photo of the document before saving.' });
          return;
      }
      setIsSubmitting(true);
      try {
          const customer = customers?.find(c => c.id === values.customerId);
          await uploadKYCDocument(firestore, storage, {
              ...values,
              customerName: customer?.name || "Unknown",
              fileUrl: capturedImage,
              uploadedBy: user.name || user.email || "Staff"
          });
          toast({ title: "Document Captured", description: "Image metadata saved to the Finance repository." });
          kycForm.reset();
          setCapturedImage(null);
          setIsKYCUploadOpen(false);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Upload Failed', description: e.message });
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

  const stats = useMemo(() => {
    if (!loans) return { disbursedCount: 0 };
    let disbursedCount = 0;
    loans.forEach(loan => {
        if (loan.status !== 'application' && loan.status !== 'rejected') {
            disbursedCount++;
        }
    });
    return { disbursedCount };
  }, [loans]);

  const myPortfolioStats = useMemo(() => {
      const activeLoans = myPortfolio.filter(l => l.status !== 'paid' && l.status !== 'rollover');
      const totalDisbursed = myPortfolio.reduce((acc, l) => acc + (Number(l.principalAmount) || 0), 0);
      const totalCollected = myPortfolio.reduce((acc, l) => acc + (Number(l.totalPaid) || 0), 0);
      return { activeCount: activeLoans.length, totalDisbursed, totalCollected };
  }, [myPortfolio]);

  const processedLoans = useMemo(() => {
      if (!loans) return [];
      return loans.map(loan => {
          const currentCustomer = customers?.find(c => c.id === loan.customerId);
          return {
              ...loan,
              displayName: currentCustomer?.name || loan.customerName
          };
      });
  }, [loans, customers]);

  const dueLoans = useMemo(() => {
    const today = startOfToday();
    
    return processedLoans.filter(loan => 
        loan.status !== 'paid' && 
        loan.status !== 'application' && 
        loan.status !== 'rejected' &&
        loan.status !== 'rollover'
    ).map(loan => {
        let baseDate: Date;
        if (loan.firstPaymentDate?.seconds) baseDate = new Date(loan.firstPaymentDate.seconds * 1000);
        else if (loan.firstPaymentDate instanceof Date) baseDate = loan.firstPaymentDate;
        else if (loan.disbursementDate?.seconds) baseDate = new Date(loan.disbursementDate.seconds * 1000);
        else baseDate = loan.disbursementDate instanceof Date ? loan.disbursementDate : new Date();

        if (isNaN(baseDate.getTime())) baseDate = new Date();
        
        const instalmentAmt = loan.instalmentAmount || 1;
        const totalPaid = loan.totalPaid || 0;
        const actualInstalmentsPaid = totalPaid / instalmentAmt;

        let cyclesPassed = 0;
        if (loan.paymentFrequency === 'daily') cyclesPassed = differenceInDays(today, baseDate);
        else if (loan.paymentFrequency === 'weekly') cyclesPassed = Math.floor(differenceInDays(today, baseDate) / 7);
        else if (loan.paymentFrequency === 'monthly') {
            cyclesPassed = differenceInMonths(today, baseDate);
        }

        // expectedByNow is full cycles elapsed. On the due date, cyclesPassed is 0, so expected is 0.
        // This means it's not "Late" until the next day.
        const expectedByNow = cyclesPassed < 0 ? 0 : cyclesPassed;
        
        const arrearsCount = Math.max(0, expectedByNow - actualInstalmentsPaid);
        const advanceCount = Math.max(0, actualInstalmentsPaid - expectedByNow);
        
        const nextInstalmentIndex = Math.floor(actualInstalmentsPaid);
        let nextDueDate: Date;
        if (loan.paymentFrequency === 'daily') nextDueDate = addDays(baseDate, nextInstalmentIndex);
        else if (loan.paymentFrequency === 'weekly') nextDueDate = addWeeks(baseDate, nextInstalmentIndex);
        else nextDueDate = addMonths(baseDate, nextInstalmentIndex);

        const remainingBalance = Math.max(0, (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0));
        const arrearsBalance = Math.min(arrearsCount * instalmentAmt, remainingBalance);

        return { 
            ...loan, 
            nextDueDate, 
            arrearsCount, 
            advanceCount,
            arrearsBalance,
            actualInstalmentsPaid,
            expectedByNow,
            daysUntil: differenceInDays(nextDueDate, today)
        };
      }).filter(loan => {
          const offset = loan.paymentFrequency === 'monthly' ? 7 : (loan.paymentFrequency === 'weekly' ? 3 : 1);
          // Only show if it's due soon, due today, or actually late
          return loan.arrearsCount > 0 || loan.daysUntil <= offset;
      }).sort((a, b) => {
          if (b.arrearsCount !== a.arrearsCount) return b.arrearsCount - a.arrearsCount;
          return a.nextDueDate.getTime() - b.nextDueDate.getTime();
      });
  }, [processedLoans]);

  const dailyDue = useMemo(() => dueLoans.filter(l => l.paymentFrequency === 'daily'), [dueLoans]);
  const weeklyDue = useMemo(() => dueLoans.filter(l => l.paymentFrequency === 'weekly'), [dueLoans]);

  const newApplications = useMemo(() => {
    return processedLoans.filter(loan => loan.status === 'application').sort((a, b) => {
        const tsA = a.disbursementDate?.seconds || 0;
        const tsB = b.disbursementDate?.seconds || 0;
        return tsB - tsA;
    });
  }, [processedLoans]);
  
  if (userLoading || loansLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name || user?.email?.split('@')[0] || 'Admin'}!</h1>
        <div className="flex gap-2">
            <Dialog open={isKYCUploadOpen} onOpenChange={(open) => { 
                setIsKYCUploadOpen(open); 
                if(!open) { 
                    stopCamera(); 
                    setCapturedImage(null); 
                    if (fileInputRef.current) fileInputRef.current.value = '';
                } 
            }}>
                <DialogTrigger asChild><Button variant="outline" className="border-primary/20 text-primary"><FileUp className="mr-2 h-4 w-4" />Upload KYC</Button></DialogTrigger>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>Customer KYC Capture</DialogTitle>
                        <DialogDescription>Select an image from gallery or take a new photo.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] px-6 py-4">
                        <Form {...kycForm}>
                            <form id="kyc-upload-form" onSubmit={kycForm.handleSubmit(onKYCSubmit)} className="space-y-4">
                                <FormField control={kycForm.control} name="customerId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Select Customer</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Search member..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.accountNumber})</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}/>
                                <FormField control={kycForm.control} name="type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Document Category</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="owner_id">Owner ID Card</SelectItem>
                                                <SelectItem value="guarantor_id">Guarantor ID Card</SelectItem>
                                                <SelectItem value="loan_form">Physical Loan Form</SelectItem>
                                                <SelectItem value="security_attachment">Security Photos/Docs</SelectItem>
                                                <SelectItem value="guarantor_undertaking">Guarantor Undertaking</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}/>
                                <FormField control={kycForm.control} name="fileName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Document Label/Note</FormLabel>
                                        <FormControl><Input placeholder="e.g. ID Front Side" {...field} /></FormControl>
                                    </FormItem>
                                )}/>

                                <div className="space-y-4 pt-2">
                                    <div className="relative min-h-[200px] max-h-[300px] bg-zinc-900 rounded-lg overflow-hidden border-2 border-muted flex items-center justify-center">
                                        {!showCamera && !capturedImage && (
                                            <div className="text-center space-y-4 p-6">
                                                <div className="flex flex-col items-center gap-2">
                                                    <ImagePlus className="h-10 w-10 text-muted-foreground" />
                                                    <p className="text-xs text-muted-foreground">No document image selected</p>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                                                        <Upload className="mr-2 h-4 w-4" /> Select from Gallery
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                                                        <Camera className="mr-2 h-4 w-4" /> Take Photo
                                                    </Button>
                                                </div>
                                                <input 
                                                    type="file" 
                                                    ref={fileInputRef} 
                                                    className="hidden" 
                                                    accept="image/*" 
                                                    onChange={handleFileChange} 
                                                />
                                            </div>
                                        )}
                                        <video ref={videoRef} className={`w-full h-full object-contain ${showCamera ? 'block' : 'hidden'}`} autoPlay muted playsInline />
                                        {capturedImage && (
                                            <img src={capturedImage} alt="Captured KYC" className="max-w-full max-h-full object-contain shadow-2xl" />
                                        )}
                                    </div>

                                    {showCamera && (
                                        <div className="flex gap-2">
                                            <Button type="button" className="flex-1" size="sm" onClick={capturePhoto}>Capture Photo</Button>
                                            <Button type="button" variant="outline" size="sm" onClick={stopCamera}>Cancel</Button>
                                        </div>
                                    )}

                                    {capturedImage && (
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                                                <Upload className="h-4 w-4 mr-2" /> Change File
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={startCamera}>
                                                <Camera className="h-4 w-4 mr-2" /> Retake Photo
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </Form>
                    </ScrollArea>
                    <DialogFooter className="p-6 pt-2">
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" form="kyc-upload-form" disabled={isSubmitting || !capturedImage}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Record Document</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isStaffLoanOpen} onOpenChange={setIsStaffLoanOpen}>
            <DialogTrigger asChild><Button variant="secondary"><UserCheck className="mr-2 h-4 w-4" />Staff Loan</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                <DialogTitle>Staff Loan Application</DialogTitle>
                <DialogDescription>Apply for an internal staff credit facility.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] px-6 py-4">
                    <Form {...staffLoanForm}>
                        <form id="staff-loan-form" onSubmit={staffLoanForm.handleSubmit(onStaffLoanSubmit)} className="space-y-4">
                        <FormField control={staffLoanForm.control} name="amount" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Amount (Ksh)</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={staffLoanForm.control} name="idNumber" render={({ field }) => (
                            <FormItem>
                                <FormLabel>ID Number</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}/>
                            <FormField control={staffLoanForm.control} name="alternativeNumber" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Alt. Phone</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                            </FormItem>
                            )}/>
                        </div>
                        <FormField control={staffLoanForm.control} name="reason" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reason</FormLabel>
                                <FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        </form>
                    </Form>
                </ScrollArea>
                <DialogFooter className="p-6 pt-2"><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="staff-loan-form" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit Application</Button></DialogFooter>
            </DialogContent>
            </Dialog>
        </div>
      </div>

      {(user?.role?.toLowerCase() === 'staff' || user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2') && (
          <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> My Portfolio Summary</h3>
              <div className="grid gap-4 md:grid-cols-3">
                  <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Assigned</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{myPortfolioStats.activeCount}</div></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Disbursed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">Ksh {myPortfolioStats.totalDisbursed.toLocaleString()}</div></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Collected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">Ksh {myPortfolioStats.totalCollected.toLocaleString()}</div></CardContent></Card>
              </div>
          </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         {(user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.role?.toLowerCase() === 'finance' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2') && (
           <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Realized Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">Ksh 0</div></CardContent></Card>
         )}
         <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Loans Disbursed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.disbursedCount || 0}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col h-[600px]">
            <CardHeader className="pb-2">
                <CardTitle>Due Loans & Follow-ups</CardTitle>
                <CardDescription>Accounts requiring attention based on their payment schedule and arrears.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <Tabs defaultValue="all" className="h-full flex flex-col">
                    <div className="px-6 pb-2">
                        <TabsList className="grid grid-cols-3 w-full">
                            <TabsTrigger value="all" className="text-xs">All Due ({dueLoans.length})</TabsTrigger>
                            <TabsTrigger value="daily" className="text-xs">Daily ({dailyDue.length})</TabsTrigger>
                            <TabsTrigger value="weekly" className="text-xs">Weekly ({weeklyDue.length})</TabsTrigger>
                        </TabsList>
                    </div>
                    
                    <div className="flex-1 overflow-hidden">
                        <TabsContent value="all" className="h-full m-0 p-0">
                            {dueLoans.length === 0 ? (<div className="p-6"><Alert><AlertTitle>No Due Payments</AlertTitle></Alert></div>) : (
                                <ScrollArea className="h-full">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card z-10">
                                            <TableRow>
                                                <TableHead>Customer Identity</TableHead>
                                                <TableHead>Member No</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Arrears Balance</TableHead>
                                                <TableHead className="text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dueLoans.map((loan) => {
                                                return (
                                                    <TableRow key={loan.id}>
                                                        <TableCell>
                                                            <div className="font-bold text-xs">{loan.displayName}</div>
                                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">Ph: {loan.customerPhone}</div>
                                                            {loan.paymentFrequency === 'weekly' && (
                                                                <Badge variant="outline" className="text-[9px] mt-1 text-blue-600 border-blue-200">
                                                                    {loan.preferredPaymentDay || format(loan.nextDueDate, 'EEEE')}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-bold text-primary">{loan.accountNumber || 'N/A'}</TableCell>
                                                        <TableCell className="text-xs font-black">
                                                            {format(loan.nextDueDate, 'dd/MM/yyyy')}
                                                        </TableCell>
                                                        <TableCell>
                                                            {loan.arrearsCount > 0 && loan.daysUntil < 0 ? (
                                                                <Badge variant="destructive" className="text-[9px] w-fit font-black uppercase tracking-tighter">
                                                                    Late {Math.ceil(loan.arrearsCount)} {loan.paymentFrequency === 'daily' ? 'd' : (loan.paymentFrequency === 'weekly' ? 'w' : 'm')}
                                                                </Badge>
                                                            ) : loan.advanceCount > 0 ? (
                                                                <Badge className="text-[9px] w-fit font-black uppercase tracking-tighter bg-green-100 text-green-800 border-none">
                                                                    Ahead {loan.advanceCount.toFixed(1)} {loan.paymentFrequency === 'daily' ? 'd' : (loan.paymentFrequency === 'weekly' ? 'w' : 'm')}
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="secondary" className="text-[9px] w-fit font-black uppercase tracking-tighter">
                                                                    {loan.daysUntil === 0 ? 'Due Today' : `Due in ${loan.daysUntil}d`}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className={cn(
                                                            "text-right font-black tabular-nums text-sm",
                                                            loan.arrearsBalance > 0 ? "text-destructive" : "text-green-600"
                                                        )}>
                                                            Ksh {loan.arrearsBalance > 0 ? loan.arrearsBalance.toLocaleString() : "0"}
                                                        </TableCell>
                                                        <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => setSelectedLoanForNotes(loan as any)}><MessageSquare className="h-4 w-4 text-blue-600" /></Button></TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            )}
                        </TabsContent>
                        <TabsContent value="daily" className="h-full m-0 p-0">
                            {dailyDue.length === 0 ? (<div className="p-6"><Alert><AlertTitle>No Daily Payments</AlertTitle></Alert></div>) : (
                                <ScrollArea className="h-full">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card z-10">
                                            <TableRow>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Arrears</TableHead>
                                                <TableHead className="text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dailyDue.map((loan) => (
                                                <TableRow key={loan.id}>
                                                    <TableCell><div className="font-medium text-xs">{loan.displayName}</div></TableCell>
                                                    <TableCell className="text-xs font-bold">{format(loan.nextDueDate, 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell>
                                                        {loan.arrearsCount > 0 && loan.daysUntil < 0 ? (
                                                            <Badge variant="destructive" className="text-[9px] font-black uppercase">Late {Math.ceil(loan.arrearsCount)}d</Badge>
                                                        ) : (
                                                            <Badge className={cn("text-[9px] font-black uppercase", loan.advanceCount > 0 ? "bg-green-100 text-green-800" : "bg-secondary text-secondary-foreground")}>
                                                                {loan.daysUntil === 0 ? 'Due Today' : (loan.advanceCount > 0 ? `Ahead ${loan.advanceCount.toFixed(1)}d` : `Due ${loan.daysUntil}d`)}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-xs text-destructive">Ksh {loan.arrearsBalance.toLocaleString()}</TableCell>
                                                    <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => setSelectedLoanForNotes(loan as any)}><MessageSquare className="h-4 w-4 text-blue-600" /></Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            )}
                        </TabsContent>
                        <TabsContent value="weekly" className="h-full m-0 p-0">
                            {weeklyDue.length === 0 ? (<div className="p-6"><Alert><AlertTitle>No Weekly Payments</AlertTitle></Alert></div>) : (
                                <ScrollArea className="h-full">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card z-10">
                                            <TableRow>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Arrears</TableHead>
                                                <TableHead className="text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {weeklyDue.map((loan) => (
                                                <TableRow key={loan.id}>
                                                    <TableCell>
                                                        <div className="font-medium text-xs">{loan.displayName}</div>
                                                        <Badge variant="outline" className="text-[9px] text-blue-600 border-blue-200">
                                                            {loan.preferredPaymentDay || format(loan.nextDueDate, 'EEEE')}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-bold">{format(loan.nextDueDate, 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell>
                                                        {loan.arrearsCount > 0 && loan.daysUntil < 0 ? (
                                                            <Badge variant="destructive" className="text-[9px] font-black uppercase">Late {Math.ceil(loan.arrearsCount)}w</Badge>
                                                        ) : (
                                                            <Badge className={cn("text-[9px] font-black uppercase", loan.advanceCount > 0 ? "bg-green-100 text-green-800" : "bg-secondary text-secondary-foreground")}>
                                                                {loan.daysUntil === 0 ? 'Due Today' : (loan.advanceCount > 0 ? `Ahead ${loan.advanceCount.toFixed(1)}w` : `Due ${loan.daysUntil}d`)}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-xs text-destructive">Ksh {loan.arrearsBalance.toLocaleString()}</TableCell>
                                                    <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => setSelectedLoanForNotes(loan as any)}><MessageSquare className="h-4 w-4 text-blue-600" /></Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>

        <Card className="flex flex-col h-[600px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>New Applications</CardTitle>
                    <CardDescription>Latest customer self-submissions.</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/admin/loans">
                        Review All <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                {newApplications.length === 0 ? (
                    <div className="p-6 text-center">
                        <Alert><AlertTitle>No Pending Applications</AlertTitle></Alert>
                    </div>
                ) : (
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Identity & Phone</TableHead>
                                    <TableHead>Member No</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {newApplications.map((loan) => (
                                    <TableRow key={loan.id} className="group">
                                        <TableCell>
                                            <div className="font-bold text-xs">{loan.displayName}</div>
                                            <div className="text-[10px] text-muted-foreground">Ph: {loan.customerPhone}</div>
                                            <div className="text-[10px] text-muted-foreground">ID: {loan.idNumber || 'N/A'}</div>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-primary">{loan.accountNumber || 'N/A'}</TableCell>
                                        <TableCell className="text-right font-bold text-xs tabular-nums text-green-600">
                                            KES {(loan.principalAmount || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                                <Link href="/admin/loans">
                                                    <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedLoanForNotes} onOpenChange={(open) => !open && setSelectedLoanForNotes(null)}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden">
              {selectedLoanForNotes && (
                  <>
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle className="text-lg">Follow-up: {selectedLoanForNotes.customerName}</DialogTitle>
                        <DialogDescription>Record customer interactions and check recent history.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 px-6 py-4">
                        <Form {...noteForm}>
                            <form onSubmit={noteForm.handleSubmit(onAddNoteSubmit)} className="space-y-2">
                                <FormField control={noteForm.control} name="content" render={({field}) => (<FormItem><FormControl><Textarea placeholder="Notes..." className="h-16 text-sm" {...field} value={field.value ?? ''} /></FormControl></FormItem>)}/>
                                <Button type="submit" className="w-full" size="sm" disabled={isAddingNote}>Save Note</Button>
                            </form>
                        </Form>
                        <ScrollArea className="h-40 border rounded-md p-3">
                            {(!selectedLoanForNotes.followUpNotes || selectedLoanForNotes.followUpNotes.length === 0) ? (<p className="text-xs text-muted-foreground text-center py-8 italic">No interactions.</p>) : (
                                <div className="space-y-3">{[...selectedLoanForNotes.followUpNotes].reverse().map((note, index) => {
                                        let nDate: Date;
                                        if ((note.date as any)?.seconds) nDate = new Date((note.date as any).seconds * 1000);
                                        else if (note.date instanceof Date) nDate = note.date;
                                        else nDate = note.date ? new Date(note.date) : new Date();

                                        return (
                                            <div key={note.noteId || index} className="bg-muted/50 p-2 rounded border text-xs"><div className="flex justify-between items-center mb-1"><span className="font-bold">{note.staffName}</span><span className="text-[9px]">{isNaN(nDate.getTime()) ? 'N/A' : format(nDate, 'dd/MM HH:mm')}</span></div><p className="italic">"{note.content}"</p></div>
                                        );
                                    })}</div>
                            )}
                        </ScrollArea>
                    </div>
                    <DialogFooter className="p-6 pt-2"><DialogClose asChild><Button variant="outline" size="sm" className="w-full">Close</Button></DialogClose></DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>
    </div>
  );
}
