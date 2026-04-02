
'use client';
import { useUser, useCollection, useFirestore, useDoc, useAuth, useMemoFirebase } from '@/firebase';
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
  LogOut as SignOut,
  ChevronRight,
  Loader2,
  Users,
  Share2,
  Copy,
  Zap,
  AlertCircle,
  FileText,
  History,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { signOut } from 'firebase/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { updateCustomer, generateReferralCode, upsertCustomer } from '@/lib/firestore';
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
  payments?: { paymentId: string; amount: number; date: any }[];
  createdAt?: { seconds: number; nanoseconds: number };
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
  const router = useRouter();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('Home');
  const [greeting, setGreeting] = useState('Welcome');
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isLoansOpen, setIsLoansOpen] = useState(false);
  const [isReferOpen, setIsReferOpen] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [randomTip, setRandomTip] = useState('');

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

  const applicationHistory = useMemo(() => 
    (customerLoans?.filter(l => l.status === 'application' || l.status === 'rejected') || [])
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)),
  [customerLoans]);

  const repaymentHistory = useMemo(() => {
    if (!customerLoans) return [];
    const allPayments: any[] = [];
    customerLoans.forEach(loan => {
        (loan.payments || []).forEach(p => {
            allPayments.push({
                ...p,
                loanNumber: loan.loanNumber,
                loanType: loan.loanType || 'Quick Pesa'
            });
        });
    });
    return allPayments.sort((a, b) => {
        const t1 = a.date?.seconds || 0;
        const t2 = b.date?.seconds || 0;
        return t2 - t1;
    });
  }, [customerLoans]);

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
            arrearsBalance,
            daysUntil: differenceInDays(nextDueDate, today)
        };
    }).sort((a, b) => {
        // Sort by next due date ascending (soonest first)
        return a.nextDueDate.getTime() - b.nextDueDate.getTime();
    });
  }, [activeLoans]);

  const totalBalance = useMemo(() => {
      return activeLoans.reduce((acc, loan) => acc + (loan.totalRepayableAmount - loan.totalPaid), 0);
  }, [activeLoans]);

  const totalArrears = useMemo(() => {
      return processedActiveLoans.reduce((acc, loan) => acc + loan.arrearsBalance, 0);
  }, [processedActiveLoans]);

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
                <span className="text-lg font-black text-[#1B2B33]">
                    {activeTab === 'Profile' ? 'Settings' : activeTab === 'History' ? 'Transaction Log' : `${firstName} 👋`}
                </span>
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

                <div className="grid grid-cols-4 gap-3 px-1">
                    <ActionCircle icon={<SendHorizontal className="h-6 w-6" />} label="Send" status="SOON" />
                    <ActionCircle icon={<Wallet className="h-6 w-6" />} label="Pay" onClick={() => setIsPayOpen(true)} />
                    <ActionCircle icon={<Landmark className="h-6 w-6" />} label="Loans" onClick={() => setIsLoansOpen(true)} />
                    <ActionCircle icon={<Users className="h-6 w-6" />} label="Refer" onClick={() => setIsReferOpen(true)} />
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
                                            <Badge className={cn("text-[9px] uppercase font-black px-3 py-1 rounded-full",
                                                loan.status === 'active' ? "bg-blue-100 text-blue-800" :
                                                loan.status === 'paid' ? "bg-green-100 text-green-800" :
                                                loan.status === 'overdue' ? "bg-red-100 text-red-800" :
                                                "bg-muted text-muted-foreground"
                                            )}>
                                                {loan.status}
                                            </Badge>
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

        {activeTab === 'History' && (
            <div className="space-y-8 pb-10">
                <section className="space-y-4">
                    <h3 className="text-lg font-black flex items-center gap-2">
                        <ArrowUpRight className="h-5 w-5 text-[#5BA9D0]" />
                        My Applications
                    </h3>
                    {applicationHistory.length === 0 ? (
                        <div className="bg-white rounded-[2rem] p-10 text-center border-2 border-dashed">
                            <Clock className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-xs text-muted-foreground font-medium">No previous applications found.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {applicationHistory.map(app => {
                                const appDate = app.createdAt?.seconds ? new Date(app.createdAt.seconds * 1000) : new Date();
                                return (
                                    <div key={app.id} className="bg-white p-5 rounded-[1.5rem] border border-muted shadow-sm flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="font-black text-sm text-[#1B2B33]">{app.loanType || 'Personal Loan'}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase">{format(appDate, 'PPP')}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <p className="font-black text-sm">KES {app.principalAmount.toLocaleString()}</p>
                                            <Badge variant="outline" className={cn("text-[8px] uppercase font-black px-2 py-0.5 rounded-full border-none",
                                                app.status === 'application' ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                                            )}>
                                                {app.status === 'application' ? 'Under Review' : app.status}
                                            </Badge>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>

                <section className="space-y-4">
                    <h3 className="text-lg font-black flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Repayment Log
                    </h3>
                    {repaymentHistory.length === 0 ? (
                        <div className="bg-white rounded-[2rem] p-10 text-center border-2 border-dashed">
                            <Wallet className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-xs text-muted-foreground font-medium">No repayments recorded yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {repaymentHistory.map((payment, i) => {
                                const payDate = payment.date?.seconds ? new Date(payment.date.seconds * 1000) : new Date();
                                return (
                                    <div key={payment.paymentId || i} className="bg-white p-5 rounded-[1.5rem] border border-muted shadow-sm flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="font-black text-xs text-[#1B2B33]">Ref: {payment.loanNumber}</p>
                                            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">{format(payDate, 'MMM dd, yyyy HH:mm')}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-green-600 text-base">+ KES {payment.amount.toLocaleString()}</p>
                                            <p className="text-[8px] text-muted-foreground font-bold uppercase">{payment.loanType}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>
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

      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t px-6 flex items-center justify-between z-50">
          <NavItem icon={<Home className="h-6 w-6" />} label="Home" active={activeTab === 'Home'} onClick={() => setActiveTab('Home')} />
          <NavItem icon={<History className="h-6 w-6" />} label="History" active={activeTab === 'History'} onClick={() => setActiveTab('History')} />
          <NavItem icon={<Plus className="h-6 w-6" />} label="Apply" onClick={() => router.push('/account/apply')} />
          <NavItem icon={<User className="h-6 w-6" />} label="Profile" active={activeTab === 'Profile'} onClick={() => setActiveTab('Profile')} />
      </nav>

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
                  <ScrollArea className="max-h-[50vh] overflow-y-auto pr-4">
                      {LOAN_PRODUCTS.map((p, i) => (
                          <div key={i} className="p-6 rounded-3xl border mb-4 flex items-center justify-between hover:bg-[#5BA9D0]/5 transition-colors cursor-pointer" onClick={() => router.push('/account/apply')}>
                              <div className="space-y-1">
                                  <p className="font-black text-lg">{p.title}</p>
                                  <p className="text-[10px] font-black text-[#5BA9D0] uppercase tracking-widest">{p.rate}</p>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                      ))}
                  </ScrollArea>
                  <Button onClick={() => router.push('/account/apply')} className="w-full h-16 rounded-full bg-[#5BA9D0] text-white text-lg font-black shadow-lg shadow-[#5BA9D0]/20 transition-all active:scale-95">
                      Apply Now
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
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
