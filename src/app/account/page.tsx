'use client';
import { useUser, useCollection, useFirestore, useDoc, useAuth, useMemoFirebase, useStorage } from '@/firebase';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  SendHorizontal, 
  Landmark, 
  Folder,
  Home,
  Plus,
  User,
  CreditCard,
  Wallet,
  LogOut,
  Info,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Phone,
  Mail,
  UserCircle,
  Loader2,
  Users,
  Share2,
  Copy,
  TrendingUp,
  Lightbulb,
  Zap,
  Star,
  AlertCircle,
  Camera,
  Upload,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { signOut } from 'firebase/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { updateCustomer, generateReferralCode, upsertCustomer, uploadKYCDocument } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { differenceInDays, differenceInMonths, startOfToday, addDays, addWeeks, addMonths, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  principalAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  instalmentAmount: number;
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
  loanType?: string;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  firstPaymentDate?: any;
  disbursementDate?: any;
  numberOfInstalments: number;
}

interface Customer {
    id: string;
    accountNumber?: string;
    name: string;
    phone: string;
    email?: string;
    idNumber?: string;
    referralCode?: string;
}

const profileSchema = z.object({
  name: z.string().min(1, 'Full name is required.'),
  phone: z.string().min(10, 'Valid phone number is required.'),
  idNumber: z.string().min(5, 'National ID is required.'),
});

const kycSchema = z.object({
    type: z.enum(['owner_id', 'guarantor_id', 'loan_form', 'security_attachment']),
    fileName: z.string().min(1, 'Label is required'),
});

const LOAN_PRODUCTS = [
    { title: 'Quick Pesa', description: 'Instant 1-month credit for emergency needs.', rate: '10% Interest' },
    { title: 'Salary Advance', description: 'Access funds ahead of your payday.', rate: '10% Interest' },
    { title: 'Business Loan', description: 'Grow your enterprise with flexible capital.', rate: '5% Interest' },
    { title: 'Logbook Loan', description: 'Unlock value from your vehicle.', rate: '10% Interest' },
];

const FINANCIAL_TIPS = [
    "Tip: Paying your loan early improves your Pezeka credit limit!",
    "Success: Referring a friend helps us build a stronger community.",
    "Insight: Small business loans are 5% interest—ideal for scaling.",
    "Reminder: Keep your ID number updated for faster appraisals."
];

export default function AccountPage() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('Home');
  const [greeting, setGreeting] = useState('Welcome');
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isLoansOpen, setIsLoansOpen] = useState(false);
  const [isReferOpen, setIsReferOpen] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [randomTip, setRandomTip] = useState('');

  const [isKYCOpen, setIsKYCOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
    
    setRandomTip(FINANCIAL_TIPS[Math.floor(Math.random() * FINANCIAL_TIPS.length)]);
  }, []);

  const { data: customerProfile, loading: profileLoading } = useDoc<Customer>(user ? `customers/${user.uid}` : null);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', phone: '', idNumber: '', }
  });

  const kycForm = useForm<z.infer<typeof kycSchema>>({
      resolver: zodResolver(kycSchema),
      defaultValues: { type: 'owner_id', fileName: '' }
  });

  useEffect(() => {
      if (user && !profileLoading && firestore) {
          if (!customerProfile) {
              upsertCustomer(firestore, user.uid, {
                  name: user.displayName || 'Valued Member',
                  email: user.email || '',
                  phone: '',
              });
          } else if (!customerProfile.referralCode) {
              const newCode = generateReferralCode();
              updateCustomer(firestore, user.uid, { referralCode: newCode });
          }
      }
  }, [customerProfile, profileLoading, user, firestore]);

  useEffect(() => {
      if (customerProfile && !profileForm.formState.isDirty) {
          profileForm.reset({
              name: customerProfile.name || '',
              phone: customerProfile.phone || '',
              idNumber: customerProfile.idNumber || '',
          });
      }
  }, [customerProfile, profileForm]);

  const customerLoansQuery = useMemoFirebase(() => {
    if (userLoading || !firestore || !user?.uid) return null;
    return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [firestore, user?.uid, userLoading]);

  const { data: customerLoans } = useCollection<Loan>(customerLoansQuery);

  const kycDocsQuery = useMemoFirebase(() => {
      if (userLoading || !firestore || !user?.uid) return null;
      return query(collection(firestore, 'kyc_documents'), where('customerId', '==', user.uid));
  }, [firestore, user?.uid, userLoading]);

  const { data: kycDocs, isLoading: kycLoading } = useCollection<any>(kycDocsQuery);

  const fullName = useMemo(() => {
      const profileName = customerProfile?.name;
      const authName = user?.displayName;
      
      const isPlaceholder = (n: string | null | undefined) => 
          !n || n.toLowerCase().includes('pezeka') || n.toLowerCase().includes('valued member');

      if (profileName && !isPlaceholder(profileName)) return profileName;
      if (authName && !isPlaceholder(authName)) return authName;
      
      return "Member";
  }, [customerProfile, user]);

  const firstName = useMemo(() => {
      const name = fullName.split(' ')[0];
      return name === 'Valued' || name === 'Member' ? 'there' : name;
  }, [fullName]);

  const initials = useMemo(() => {
      if (fullName === 'Member') return 'PZ';
      return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }, [fullName]);

  const activeLoans = useMemo(() => 
    customerLoans?.filter(l => l.status !== 'application' && l.status !== 'paid' && l.status !== 'rejected' && l.status !== 'rollover') || [], 
  [customerLoans]);

  const pendingApplications = useMemo(() => 
    customerLoans?.filter(l => l.status === 'application') || [], 
  [customerLoans]);

  const processedActiveLoans = useMemo(() => {
    const today = startOfToday();
    return activeLoans.map(loan => {
        let baseDate: Date;
        if (loan.firstPaymentDate?.seconds) {
            baseDate = new Date(loan.firstPaymentDate.seconds * 1000);
        } else {
            const dDate = loan.disbursementDate?.seconds 
                ? new Date(loan.disbursementDate.seconds * 1000) 
                : new Date();
            
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
        else if (loan.paymentFrequency === 'monthly') {
            cyclesPassed = differenceInMonths(today, baseDate);
        }

        const expectedByNow = cyclesPassed < 0 ? 0 : cyclesPassed;
        
        const arrearsCount = Math.max(0, expectedByNow - actualInstalmentsPaid);
        const advanceCount = Math.max(0, actualInstalmentsPaid - expectedByNow);
        
        const remainingBalance = Math.max(0, (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0));
        const arrearsBalance = Math.min(arrearsCount * instalmentAmt, remainingBalance);

        const nextInstalmentIndex = Math.floor(actualInstalmentsPaid);
        let nextDueDate: Date;
        if (loan.paymentFrequency === 'daily') nextDueDate = addDays(baseDate, nextInstalmentIndex);
        else if (loan.paymentFrequency === 'weekly') nextDueDate = addWeeks(baseDate, nextInstalmentIndex);
        else nextDueDate = addMonths(baseDate, nextInstalmentIndex);

        return { 
            ...loan, 
            nextDueDate, 
            arrearsCount, 
            advanceCount,
            arrearsBalance,
            daysUntil: differenceInDays(nextDueDate, today)
        };
    });
  }, [activeLoans]);

  const totalBalance = useMemo(() => {
      return activeLoans.reduce((acc, loan) => acc + (loan.totalRepayableAmount - loan.totalPaid), 0);
  }, [activeLoans]);

  const totalArrears = useMemo(() => {
      return processedActiveLoans.reduce((acc, loan) => acc + loan.arrearsBalance, 0);
  }, [processedActiveLoans]);

  const nextInstalment = useMemo(() => {
      if (activeLoans.length === 0) return 0;
      return activeLoans[0].instalmentAmount;
  }, [activeLoans]);

  const handleLogout = async () => {
      await signOut(auth);
      router.replace('/');
  };

  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
      if (!user) return;
      setIsUpdatingProfile(true);
      try {
          await updateCustomer(firestore, user.uid, values);
          toast({ title: 'Profile Updated' });
          profileForm.reset(values);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Update Failed' });
      } finally {
          setIsUpdatingProfile(false);
      }
  };

  const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (videoRef.current) videoRef.current.srcObject = stream;
          setShowCamera(true);
          setCapturedImage(null);
      } catch (e) {
          toast({ variant: 'destructive', title: 'Camera Error' });
      }
  };

  const capturePhoto = () => {
      if (videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0);
              setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
              const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
              tracks.forEach(t => t.stop());
              setShowCamera(false);
          }
      }
  };

  async function onKYCSubmit(values: z.infer<typeof kycSchema>) {
      if (!user || !capturedImage) return;
      setIsUploading(true);
      try {
          await uploadKYCDocument(firestore, storage, {
              ...values,
              customerId: user.uid,
              customerName: fullName,
              fileUrl: capturedImage,
              uploadedBy: 'Member'
          });
          toast({ title: 'Document Uploaded' });
          setIsKYCOpen(false);
          setCapturedImage(null);
          kycForm.reset();
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Upload Failed' });
      } finally {
          setIsUploading(false);
      }
  }

  const referralLink = useMemo(() => {
      const code = customerProfile?.referralCode || 'INVITE';
      return `pezeka.com/${code}`;
  }, [customerProfile?.referralCode]);

  const copyReferralLink = () => {
      if (typeof window !== 'undefined') {
          navigator.clipboard.writeText(referralLink);
          toast({ title: 'Link Copied' });
      }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB] text-[#1B2B33] pb-24 font-sans flex flex-col">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between bg-white border-b border-muted">
        <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-[#5BA9D0]">
                <AvatarFallback className="bg-[#1B2B33] text-white font-black">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{greeting}</span>
                <span className="text-lg font-black text-[#1B2B33]">{activeTab === 'Profile' ? 'Settings' : (activeTab === 'Documents' ? 'My Vault' : `${firstName} 👋`)}</span>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button className="text-[#1B2B33]/60 hover:text-[#5BA9D0] p-2"><Bell className="h-5 w-5" /></button>
            <button onClick={handleLogout} className="text-destructive p-2"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>

      <main className="px-6 space-y-8 flex-1 pt-6">
        {activeTab === 'Home' && (
            <>
                <div className="relative overflow-hidden rounded-[2.5rem] p-8 min-h-[240px] bg-[#1B2B33] text-white shadow-2xl shadow-[#1B2B33]/30 flex flex-col justify-between group">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div className="space-y-1">
                            <p className="text-white/50 text-[10px] font-black uppercase tracking-widest">Total Outstanding</p>
                            <h2 className="text-4xl font-black tabular-nums">KES {totalBalance.toLocaleString()}</h2>
                            {totalArrears > 0 && (
                                <div className="flex items-center gap-1.5 mt-2 bg-destructive/20 w-fit px-3 py-1 rounded-full border border-destructive/30">
                                    <AlertCircle className="h-3 w-3 text-red-400" />
                                    <span className="text-[10px] font-bold text-red-200">Arrears: KES {totalArrears.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-xl border border-white/10"><CreditCard className="h-6 w-6 text-[#5BA9D0]" /></div>
                    </div>
                    <div className="flex justify-between items-end relative z-10 pt-4">
                        <div className="space-y-1">
                            <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Member ID</p>
                            <p className="text-xs font-black uppercase tracking-wider">{customerProfile?.accountNumber || 'PZ-XXXXX'}</p>
                        </div>
                        <div className="text-right space-y-1">
                            <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Referral Code</p>
                            <p className="text-xs font-black uppercase tracking-wider text-[#5BA9D0]">{customerProfile?.referralCode || '...'}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-5 gap-3 px-1">
                    <ActionCircle icon={<SendHorizontal className="h-6 w-6" />} label="Send" status="SOON" />
                    <ActionCircle icon={<Wallet className="h-6 w-6" />} label="Pay" onClick={() => setIsPayOpen(true)} />
                    <ActionCircle icon={<Landmark className="h-6 w-6" />} label="Loans" onClick={() => setIsLoansOpen(true)} />
                    <ActionCircle icon={<Users className="h-6 w-6" />} label="Refer" onClick={() => setIsReferOpen(true)} />
                    <ActionCircle icon={<Folder className="h-6 w-6" />} label="Vault" onClick={() => setActiveTab('Documents')} />
                </div>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-[#1B2B33] tracking-tight">Active Portfolio</h3>
                    </div>
                    {processedActiveLoans.length === 0 ? (
                        <div className="bg-white border-2 border-dashed border-muted rounded-[2rem] p-8 text-center space-y-4">
                            <div className="w-12 h-12 bg-[#5BA9D0]/5 rounded-full flex items-center justify-center mx-auto"><Zap className="h-6 w-6 text-[#5BA9D0]/40" /></div>
                            <p className="font-bold text-sm">Need quick credit?</p>
                            <Button variant="ghost" onClick={() => router.push('/account/apply')} className="text-[#5BA9D0] font-black text-[10px] uppercase">Apply Now <ChevronRight className="h-3 w-3 ml-1" /></Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {processedActiveLoans.map(loan => (
                                <div key={loan.id} className="bg-white border border-muted rounded-3xl p-5 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="font-black text-base text-[#1B2B33]">{loan.loanType || 'Quick Pesa'}</p>
                                            <p className="text-muted-foreground text-[10px] font-black uppercase">Outstanding: KES {(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {loan.arrearsCount > 0 && loan.daysUntil < 0 ? (
                                                <Badge variant="destructive" className="text-[9px] uppercase">Late {Math.ceil(loan.arrearsCount)} {loan.paymentFrequency[0]}</Badge>
                                            ) : (
                                                <Badge className="bg-green-100 text-green-800 text-[9px] uppercase border-none">{loan.daysUntil === 0 ? 'Due Today' : 'Active'}</Badge>
                                            )}
                                            <span className="text-[10px] font-bold text-muted-foreground italic">Next: {format(loan.nextDueDate, 'MMM dd')}</span>
                                        </div>
                                    </div>
                                    {loan.arrearsBalance > 0 && (
                                        <div className="bg-red-50 border border-red-100 p-3 rounded-2xl flex items-center justify-between">
                                            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Overdue Balance</span>
                                            <span className="text-sm font-black text-red-600">KES {loan.arrearsBalance.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </>
        )}

        {activeTab === 'Documents' && (
            <div className="space-y-6">
                <Card className="rounded-[2.5rem] bg-white border-none shadow-xl overflow-hidden">
                    <CardHeader className="bg-[#1B2B33] text-white p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-white">KYC Vault</CardTitle>
                                <CardDescription className="text-white/50">Stored documents for verification.</CardDescription>
                            </div>
                            <Button onClick={() => setIsKYCOpen(true)} className="bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 rounded-full h-12 w-12 p-0 shadow-lg">
                                <Plus className="h-6 w-6" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        {kycLoading ? (
                            <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
                        ) : !kycDocs || kycDocs.length === 0 ? (
                            <div className="text-center py-12 space-y-4">
                                <div className="bg-muted h-16 w-16 rounded-full flex items-center justify-center mx-auto"><FileText className="h-8 w-8 text-muted-foreground" /></div>
                                <p className="text-sm text-muted-foreground font-medium">Your KYC vault is empty.</p>
                                <Button onClick={() => setIsKYCOpen(true)} variant="outline" className="rounded-full">Upload Documents</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {kycDocs.map(doc => (
                                    <div key={doc.id} className="group relative aspect-square rounded-2xl overflow-hidden border bg-muted">
                                        <img src={doc.fileUrl} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 p-3 flex flex-col justify-end">
                                            <p className="text-[10px] text-white font-black uppercase">{doc.fileName}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        )}

        {activeTab === 'Profile' && (
            <div className="space-y-6 pb-10">
                <Card className="rounded-[2.5rem] bg-white shadow-xl overflow-hidden border-none">
                    <CardHeader className="bg-[#1B2B33] text-white p-8">
                        <CardTitle className="text-white">Account Details</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <Form {...profileForm}>
                            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                                <FormField control={profileForm.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Full Legal Name</FormLabel><FormControl><Input className="h-14 rounded-2xl bg-[#F8FAFB]" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={profileForm.control} name="phone" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Primary Phone</FormLabel><FormControl><Input className="h-14 rounded-2xl bg-[#F8FAFB]" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={profileForm.control} name="idNumber" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-muted-foreground">National ID Number</FormLabel><FormControl><Input className="h-14 rounded-2xl bg-[#F8FAFB]" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <Button type="submit" disabled={isUpdatingProfile} className="w-full h-16 rounded-full bg-[#5BA9D0] font-black text-lg">
                                    {isUpdatingProfile ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        )}
      </main>

      <Dialog open={isKYCOpen} onOpenChange={setIsKYCOpen}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem]">
              <DialogHeader><DialogTitle className="text-2xl font-black">Upload Document</DialogTitle><DialogDescription>Select document type and capture or select a photo.</DialogDescription></DialogHeader>
              <div className="space-y-6 pt-4">
                  <Form {...kycForm}>
                      <form id="kyc-form" onSubmit={kycForm.handleSubmit(onKYCSubmit)} className="space-y-4">
                          <FormField control={kycForm.control} name="type" render={({ field }) => (
                              <FormItem><FormLabel>Document Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="owner_id">ID Card (Front/Back)</SelectItem><SelectItem value="security_attachment">Security/Collateral Photo</SelectItem><SelectItem value="loan_form">Signed Application Form</SelectItem></SelectContent></Select></FormItem>
                          )}/>
                          <FormField control={kycForm.control} name="fileName" render={({ field }) => (
                              <FormItem><FormLabel>Label</FormLabel><FormControl><Input placeholder="e.g. My ID Card" {...field} /></FormControl></FormItem>
                          )}/>
                          <div className="relative min-h-[200px] bg-muted rounded-2xl overflow-hidden flex items-center justify-center border-2 border-dashed border-primary/20">
                              {!showCamera && !capturedImage && (
                                  <div className="flex flex-col gap-2 p-6">
                                      <Button type="button" onClick={() => fileRef.current?.click()} variant="outline"><Upload className="mr-2 h-4 w-4" /> Select File</Button>
                                      <Button type="button" onClick={startCamera}><Camera className="mr-2 h-4 w-4" /> Use Camera</Button>
                                      <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                              const reader = new FileReader();
                                              reader.onloadend = () => setCapturedImage(reader.result as string);
                                              reader.readAsDataURL(file);
                                          }
                                      }} />
                                  </div>
                              )}
                              {showCamera && <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />}
                              {capturedImage && <img src={capturedImage} className="w-full h-full object-cover" />}
                          </div>
                          {showCamera && <Button type="button" onClick={capturePhoto} className="w-full">Capture Photo</Button>}
                          {capturedImage && <Button type="button" onClick={() => setCapturedImage(null)} variant="ghost" className="w-full">Retake Photo</Button>}
                      </form>
                  </Form>
              </div>
              <DialogFooter><Button form="kyc-form" disabled={isUploading || !capturedImage} className="w-full h-14 rounded-full bg-[#5BA9D0]">
                  {isUploading ? <Loader2 className="animate-spin" /> : 'Record Document'}
              </Button></DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={isReferOpen} onOpenChange={setIsReferOpen}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem]">
              <DialogHeader><DialogTitle className="text-2xl font-black">Refer & Grow</DialogTitle></DialogHeader>
              <div className="p-4 space-y-6">
                  <div className="bg-[#1B2B33] rounded-3xl p-8 text-center space-y-4">
                      <div className="bg-[#5BA9D0] h-16 w-16 rounded-2xl flex items-center justify-center mx-auto"><Users className="h-8 w-8 text-white" /></div>
                      <h4 className="text-white text-lg font-black">Your Invitation Link</h4>
                      <div className="bg-white/10 p-4 rounded-2xl flex items-center justify-between gap-3 backdrop-blur-md">
                          <span className="text-[11px] font-black text-[#5BA9D0] truncate uppercase">{referralLink}</span>
                          <Button size="icon" variant="ghost" className="text-white" onClick={copyReferralLink}><Copy className="h-4 w-4" /></Button>
                      </div>
                  </div>
                  <Button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Join Pezeka Credit for fast loans: ' + referralLink)}`, '_blank')} className="w-full h-16 rounded-full bg-[#25D366] text-white font-black text-lg shadow-xl shadow-green-500/20"><Share2 className="mr-2 h-5 w-5" /> Share on WhatsApp</Button>
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem]">
              <div className="bg-[#1B2B33] p-10 text-white"><DialogHeader><DialogTitle className="text-3xl font-black text-white">Repayment</DialogTitle></DialogHeader></div>
              <div className="p-8 space-y-6">
                  <div className="bg-[#F8FAFB] p-6 rounded-3xl space-y-4 border">
                      <div className="flex justify-between items-center"><span className="text-muted-foreground text-[10px] font-black uppercase">Paybill</span><span className="text-xl font-black">522522</span></div>
                      <div className="flex justify-between items-center"><span className="text-muted-foreground text-[10px] font-black uppercase">Account</span><span className="text-xl font-black">1347823360</span></div>
                      <div className="flex justify-between items-center pt-2 border-t"><span className="text-primary text-[10px] font-black uppercase">Total Arrears</span><span className="text-2xl font-black text-destructive">KES {totalArrears.toLocaleString()}</span></div>
                  </div>
                  <Button onClick={() => setIsPayOpen(false)} className="w-full h-14 rounded-2xl bg-[#5BA9D0] font-black text-white">Done</Button>
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={isLoansOpen} onOpenChange={setIsLoansOpen}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden">
              <div className="bg-[#1B2B33] p-10 text-white"><DialogHeader><DialogTitle className="text-3xl font-black text-white">Our Loans</DialogTitle></DialogHeader></div>
              <div className="p-8 space-y-6 bg-white">
                  <ScrollArea className="max-h-[40vh]">{LOAN_PRODUCTS.map((p, i) => (
                      <div key={i} className="p-6 rounded-3xl border mb-4 flex items-center justify-between hover:bg-[#5BA9D0]/5">
                          <div className="space-y-1"><p className="font-black text-lg">{p.title}</p><p className="text-[10px] font-black text-[#5BA9D0] uppercase">{p.rate}</p></div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                  ))}</ScrollArea>
                  <Button onClick={() => router.push('/account/apply')} className="w-full h-16 rounded-full bg-[#5BA9D0] font-black text-xl">Apply Now</Button>
              </div>
          </DialogContent>
      </Dialog>

      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t px-8 flex items-center justify-between z-50">
          <NavItem icon={<Home className="h-6 w-6" />} label="Home" active={activeTab === 'Home'} onClick={() => setActiveTab('Home')} />
          <NavItem icon={<Plus className="h-6 w-6" />} label="Apply" onClick={() => router.push('/account/apply')} />
          <NavItem icon={<FileText className="h-6 w-6" />} label="Docs" active={activeTab === 'Documents'} onClick={() => setActiveTab('Documents')} />
          <NavItem icon={<User className="h-6 w-6" />} label="Profile" active={activeTab === 'Profile'} onClick={() => setActiveTab('Profile')} />
      </nav>
    </div>
  );
}

function ActionCircle({ icon, label, status, onClick }: { icon: React.ReactNode, label: string, status?: string, onClick?: () => void }) {
    return (
        <button onClick={onClick} className="flex flex-col items-center gap-2 group relative">
            <div className="w-14 h-14 rounded-[1.25rem] bg-[#5BA9D0]/10 border border-[#5BA9D0]/20 flex items-center justify-center transition-all group-active:scale-90 text-[#5BA9D0]">{icon}</div>
            <span className="text-[10px] font-black text-[#1B2B33]/60 tracking-wider uppercase">{label}</span>
            {status && <div className="absolute -top-1 -right-1 bg-[#1B2B33] text-white text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ring-2 ring-white">{status}</div>}
        </button>
    );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
    return (
        <button onClick={onClick} className={cn("flex flex-col items-center gap-1 transition-all outline-none", active ? 'text-[#5BA9D0]' : 'text-[#1B2B33]/30')}>
            <div className={cn("transition-all duration-300", active ? 'scale-110 -translate-y-1' : 'scale-100')}>{icon}</div>
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );
}