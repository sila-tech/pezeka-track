
'use client';
import { useUser, useCollection, useFirestore, useDoc, useAuth, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  TrendingUp,
  Landmark, 
  Folder,
  Home,
  Plus,
  User,
  CreditCard,
  Wallet,
  LogOut,
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
  ArrowDownCircle,
  ShieldCheck,
  Coins,
  ChevronLeft,
  Bot,
  BrainCircuit,
  Send,
  Sparkles,
} from 'lucide-react';
import { askCustomerAI } from '@/app/actions/customer-ai';

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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { updateCustomer, generateReferralCode, upsertCustomer, requestDeposit, requestWithdrawal, ensureInvestorProfile, submitInvestmentApplication } from '@/lib/firestore';
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
import { Checkbox } from '@/components/ui/checkbox';

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

interface InvestorProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  totalInvestment: number;
  totalWithdrawn: number;
  currentBalance: number;
  interestRate?: number;
  deposits?: { depositId: string; amount: number; date: any; status: string }[];
  withdrawals?: { withdrawalId: string; amount: number; date: any; status: string }[];
}

const profileSchema = z.object({
  name: z.string().min(1, 'Full name is required.'),
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits.')
    .max(13, 'Phone number is too long.')
    .regex(/^(?:(?:\+254|254)[17]\d{8}|0[17]\d{8})$/, 'Enter a valid Kenyan phone number (e.g. 0712345678 or +254712345678).'),
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

const INVEST_TC = `Terms and Conditions — Pezeka Investment Portfolio

1. Investment starts accruing interest upon Finance team verification and approval.
2. Returns are calculated at 30% per annum, compounded daily on the approved balance.
3. Minimum investment is Ksh 500. Additional top-ups must also meet this minimum.
4. Withdrawal requests are subject to a processing period of up to 5 business days.
5. Pezeka Credit is not a bank. Investments are not covered by the Deposit Protection Fund.
6. This product is not guaranteed capital protection. Returns are subject to business performance.
7. By proceeding, you confirm you have read and understood these terms.`;

// Invest modal step: 'info' | 'tc' | 'apply' | 'calculator' | 'deposit' | 'deposit_confirm' | 'withdraw'
type InvestStep = 'info' | 'tc' | 'apply' | 'calculator' | 'deposit' | 'deposit_confirm' | 'withdraw';

export default function AccountPage() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('Home');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [greeting, setGreeting] = useState('Welcome');
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isLoansOpen, setIsLoansOpen] = useState(false);
  const [isReferOpen, setIsReferOpen] = useState(false);
  const [randomTip, setRandomTip] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([
    { role: 'model', content: `Hello! 🚀 I'm NOVA, your Pezeka Neural Assistant. I'm now online and ready to help you with loan applications, payment history, and financial advice. How can I assist you today? ✨` }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAIApplication, setPendingAIApplication] = useState<any | null>(null);
  const [isSubmittingAIApp, setIsSubmittingAIApp] = useState(false);
  const [loanDraft, setLoanDraft] = useState<Record<string, any> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
    
    setRandomTip(FINANCIAL_TIPS[Math.floor(Math.random() * FINANCIAL_TIPS.length)]);
  }, []);

  const { data: customerProfile, loading: profileLoading } = useDoc<Customer>(user ? `customers/${user.uid}` : null);
  const { data: investorProfile, loading: investorLoading } = useDoc<InvestorProfile>(user ? `investors/${user.uid}` : null);
  const { data: investmentApplication } = useDoc<any>(user ? `investmentApplications/${user.uid}` : null);

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
          const isPlaceholder = (n: string) => n.toLowerCase().includes('valued member') || n.toLowerCase().includes('pezeka');
          profileForm.reset({
              name: isPlaceholder(customerProfile.name || '') ? '' : (customerProfile.name || ''),
              phone: customerProfile.phone || '',
              idNumber: customerProfile.idNumber || '',
          });
      }
  }, [customerProfile, profileForm]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);


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
      return name === 'Valued' || name === 'Member' || name === '' ? 'Friend' : name;
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
    .sort((a, b) => ((b.createdAt as any)?.seconds || 0) - ((a.createdAt as any)?.seconds || 0)),
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
        const t1 = (a.date as any)?.seconds || 0;
        const t2 = (b.date as any)?.seconds || 0;
        return t2 - t1;
    });
  }, [customerLoans]);

  const processedActiveLoans = useMemo(() => {
    const today = startOfToday();
    return activeLoans.map(loan => {
        let baseDate: Date;
        if ((loan.firstPaymentDate as any)?.seconds) {
            baseDate = new Date((loan.firstPaymentDate as any).seconds * 1000);
        } else {
            const dDate = (loan.disbursementDate as any)?.seconds 
                ? new Date((loan.disbursementDate as any).seconds * 1000) 
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
        return a.nextDueDate.getTime() - b.nextDueDate.getTime();
    });
  }, [activeLoans]);

  const totalBalance = useMemo(() => {
      return activeLoans.reduce((acc, loan) => acc + (loan.totalRepayableAmount - loan.totalPaid), 0);
  }, [activeLoans]);

  const totalArrears = useMemo(() => {
      return processedActiveLoans.reduce((acc, loan) => acc + loan.arrearsBalance, 0);
  }, [processedActiveLoans]);

  const nextInstalmentAmount = useMemo(() => {
    return processedActiveLoans[0]?.instalmentAmount || 0;
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

  const openInvestTab = () => {
    router.push('/account/invest');
  };


  const submitAIApplication = async () => {
    if (!pendingAIApplication || !user) return;
    setIsSubmittingAIApp(true);
    try {
      const { submitCustomerApplication } = await import('@/lib/firestore');
      const customerName = customerProfile?.name || user.displayName || 'Customer';
      await submitCustomerApplication(firestore, user.uid, {
        ...pendingAIApplication,
        customerName,
        accountNumber: customerProfile?.accountNumber || 'N/A',
        agreedToTerms: true,
      });
      setPendingAIApplication(null);
      setMessages(prev => [...prev, {
        role: 'model',
        content: `✅ Your application has been submitted successfully! 🎉\n\n📄 **Next Step — Send your documents via WhatsApp to 0757664047:**\n- 🪪 National ID (front & back)\n- 📱 M-Pesa statement (last 3 months PDF)\n- Any additional docs based on your loan type\n\n👉 WhatsApp link: https://wa.me/254757664047\n\nProcessing begins once all documents are received. We'll be in touch soon! 🚀`
      }]);
      toast({ title: 'Application Submitted! ✅', description: 'Your loan application has been submitted successfully.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: err.message || 'Could not submit application. Please try the Apply page.' });
    } finally {
      setIsSubmittingAIApp(false);
    }
  };


  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;
    
    const userMsg = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
        const result = await askCustomerAI({
            message: userMsg,
            history: messages,
            customerName: firstName,
            customerProfile: customerProfile ? JSON.parse(JSON.stringify(customerProfile)) : null,
            customerLoans: customerLoans ? JSON.parse(JSON.stringify(customerLoans)) : [],
            loanProducts: LOAN_PRODUCTS,
            referralCode: customerProfile?.referralCode || 'INVITE',
            applicationDraft: loanDraft,
        });

        if (result.success && result.response) {
            let responseText = result.response;

            // 1. Parse [SERVER_DRAFT] — authoritative draft state from server (server-side extraction)
            const serverDraftMatch = responseText.match(/\[SERVER_DRAFT\]([\s\S]*?)\[\/SERVER_DRAFT\]/m);
            if (serverDraftMatch) {
                try {
                    const newDraft = JSON.parse(serverDraftMatch[1].trim());
                    setLoanDraft(newDraft);
                } catch (_) { /* ignore malformed */ }
                responseText = responseText.replace(serverDraftMatch[0], '').trim();
            }

            // 2. Parse [APP_STATE] — fallback for initial loanType detection emitted by AI
            const appStateMatch = responseText.match(/\[APP_STATE\](\{[\s\S]*?\})\[\/APP_STATE\]/m);
            if (appStateMatch) {
                try {
                    const stateData = JSON.parse(appStateMatch[1].trim());
                    delete stateData.nextExpected;
                    if (Object.keys(stateData).length > 0) {
                        setLoanDraft(prev => ({ ...(prev || {}), ...stateData }));
                    }
                } catch (_) { /* ignore */ }
                responseText = responseText.replace(appStateMatch[0], '').trim();
            }

            // 3. Parse [APPLICATION_READY] — finalize and show confirmation dialog
            const appMatch = responseText.match(/\[APPLICATION_READY\]([\s\S]*?)\[\/APPLICATION_READY\]/m);
            if (appMatch) {
                try {
                    const appData = JSON.parse(appMatch[1].trim());
                    setPendingAIApplication(appData);
                    setLoanDraft(null);
                    responseText = responseText.replace(appMatch[0], '').trim();
                } catch (_) { /* ignore */ }
            }

            setMessages(prev => [...prev, { role: 'model', content: responseText.trim() }]);
        } else {
            toast({ variant: 'destructive', title: 'AI Offline', description: (result as any).error || 'Could not reach assistant. Please try again.' });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Something went wrong.' });
    } finally {
        setIsTyping(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#F8FAFB] text-[#1B2B33] pb-24 font-sans flex flex-col">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between bg-white border-b border-muted">
        <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-[#0078D4]">
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
            <button className="text-[#1B2B33]/60 hover:text-[#0078D4] p-2"><Bell className="h-5 w-5" /></button>
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
                        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-xl border border-white/10"><CreditCard className="h-6 w-6 text-[#0078D4]" /></div>
                    </div>
                    <div className="flex justify-between items-end relative z-10 pt-4">
                        <div className="space-y-1">
                            <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Member ID</p>
                            <p className="text-xs font-black uppercase tracking-wider">{customerProfile?.accountNumber || 'PZ-XXXXX'}</p>
                        </div>
                        {investorProfile && (
                          <div className="text-right space-y-1">
                              <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Investment Balance</p>
                              <p className="text-xs font-black uppercase tracking-wider text-green-400">KES {(investorProfile.currentBalance || 0).toLocaleString()}</p>
                          </div>
                        )}
                        {!investorProfile && (
                          <div className="text-right space-y-1">
                              <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Referral Code</p>
                              <p className="text-xs font-black uppercase tracking-wider text-[#0078D4]">{customerProfile?.referralCode || '...'}</p>
                          </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-3 px-1">
                    <ActionCircle
                    icon={
                      <div className="relative">
                        <TrendingUp className="h-6 w-6" />
                        {investmentApplication?.status === 'pending' && (
                          <span className="absolute -top-2 -right-2 bg-amber-400 text-[8px] font-black text-white px-1 py-0.5 rounded-full leading-none uppercase tracking-wide">Review</span>
                        )}
                      </div>
                    }
                    label="Invest"
                    onClick={openInvestTab}
                    highlight
                />
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
                            <div className="w-12 h-12 bg-[#0078D4]/5 rounded-full flex items-center justify-center mx-auto"><Zap className="h-6 w-6 text-[#0078D4]/40" /></div>
                            <p className="font-bold text-sm">Need quick credit?</p>
                            <Button variant="ghost" onClick={() => router.push('/account/apply')} className="text-[#0078D4] font-black text-[10px] uppercase">Apply Now <ChevronRight className="h-3 w-3 ml-1" /></Button>
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
                        <ArrowUpRight className="h-5 w-5 text-[#0078D4]" />
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
                                const appDate = (app.createdAt as any)?.seconds ? new Date((app.createdAt as any).seconds * 1000) : new Date();
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
                                const payDate = (payment.date as any)?.seconds ? new Date((payment.date as any).seconds * 1000) : new Date();
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
                                <Button type="submit" disabled={isUpdatingProfile} className="w-full h-16 rounded-full bg-[#0078D4] font-black text-lg">
                                    {isUpdatingProfile ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        )}
        {activeTab === 'Assistant' && (
            <div className="flex flex-col h-[calc(100vh-180px)] items-center justify-center -mt-2 space-y-6 text-center px-4">
                <div className="relative">
                    <div className="h-24 w-24 rounded-[2rem] bg-gradient-to-br from-violet-600 via-[#0078D4] to-cyan-500 flex items-center justify-center shadow-2xl shadow-blue-500/20">
                        <BrainCircuit className="h-12 w-12 text-white animate-pulse" />
                    </div>
                    <Badge className="absolute -top-2 -right-2 bg-amber-400 text-[10px] font-black text-white px-2 py-1 rounded-full uppercase tracking-wider border-2 border-white shadow-lg">Coming Soon</Badge>
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-black text-[#1B2B33] tracking-tight">Meet NOVA</h3>
                    <p className="text-sm text-muted-foreground font-medium max-w-[280px]">
                        Our Neural AI assistant is currently being trained to provide you with better financial insights and support.
                    </p>
                </div>
                <div className="bg-[#0078D4]/5 border border-[#0078D4]/10 rounded-2xl p-4 w-full">
                    <p className="text-[10px] font-black text-[#0078D4] uppercase tracking-widest mb-1">Status</p>
                    <p className="text-xs font-bold text-[#1B2B33]">Integration in progress... ⚙️</p>
                </div>
            </div>
        )}

      </main>

      {/* ===== AI LOAN APPLICATION CONFIRMATION DIALOG ===== */}
      <Dialog open={!!pendingAIApplication} onOpenChange={(o) => { if (!o) setPendingAIApplication(null); }}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Confirm Loan Application</DialogTitle>
          <DialogDescription className="sr-only">Review and confirm your loan application details</DialogDescription>
          <div className="bg-gradient-to-br from-[#1B2B33] to-[#0d3a4e] p-8 text-white text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#0078D4]/20 border border-[#0078D4]/30 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-7 w-7 text-[#0078D4]" />
            </div>
            <h2 className="text-2xl font-black">Confirm Application</h2>
            <p className="text-white/60 text-sm">Please review your details before submitting</p>
          </div>
          {pendingAIApplication && (
            <div className="p-6 space-y-4 bg-white">
              <div className="space-y-2 bg-[#F8FAFB] rounded-2xl p-4 border border-muted/30">
                {[
                  { label: 'Loan Type', value: pendingAIApplication.loanType },
                  { label: 'Amount', value: `KES ${Number(pendingAIApplication.principalAmount || 0).toLocaleString()}` },
                  { label: 'Instalments', value: `${pendingAIApplication.numberOfInstalments} × ${pendingAIApplication.paymentFrequency}` },
                  { label: 'Phone', value: pendingAIApplication.customerPhone },
                  { label: 'Address', value: pendingAIApplication.physicalAddress },
                  { label: 'Employment', value: pendingAIApplication.employmentType },
                  { label: 'Income Range', value: pendingAIApplication.monthlyIncomeRange },
                  pendingAIApplication.employerName && { label: 'Employer', value: pendingAIApplication.employerName },
                  pendingAIApplication.vehicleRegistration && { label: 'Vehicle Reg', value: pendingAIApplication.vehicleRegistration },
                ].filter(Boolean).map((item: any, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">{item.label}</span>
                    <span className="font-black text-[#1B2B33] text-right max-w-[60%]">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-medium">
                📄 After submission, you&apos;ll need to send your documents (ID + M-Pesa statement) via WhatsApp to complete the process.
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-full font-black"
                  onClick={() => setPendingAIApplication(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-12 rounded-full bg-[#0078D4] hover:bg-[#0066b5] text-white font-black shadow-lg shadow-[#0078D4]/20"
                  onClick={submitAIApplication}
                  disabled={isSubmittingAIApp}
                >
                  {isSubmittingAIApp ? <Loader2 className="h-4 w-4 animate-spin" /> : '✅ Confirm & Submit'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t px-8 flex items-center justify-between z-50">
          <NavItem icon={<Home className="h-6 w-6" />} label="Home" active={activeTab === 'Home'} onClick={() => setActiveTab('Home')} />
          <NavItem icon={<History className="h-6 w-6" />} label="History" active={activeTab === 'History'} onClick={() => setActiveTab('History')} />
          {/* ── NOVA centre button ── */}
          <div className="relative flex flex-col items-center -mt-8">
            <button
              onClick={() => setActiveTab('Assistant')}
              className="relative w-16 h-16 rounded-[1.6rem] flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-90 group"
              style={{
                background: activeTab === 'Assistant'
                  ? 'linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #06b6d4 100%)'
                  : 'linear-gradient(135deg, #1B2B33 0%, #0078D4 100%)',
                boxShadow: activeTab === 'Assistant'
                  ? '0 0 0 4px rgba(124,58,237,0.25), 0 8px 24px rgba(124,58,237,0.4)'
                  : '0 4px 20px rgba(0,120,212,0.4)',
              }}
            >
              {/* pulse ring */}
              <span className="absolute inset-0 rounded-[1.6rem] animate-ping opacity-20 bg-[#0078D4] group-hover:opacity-30" />
              <BrainCircuit className="h-8 w-8 text-white relative z-10" />
              <span className="absolute -top-1 -right-1 bg-amber-400 text-[8px] font-black text-white px-1 py-0.5 rounded-full leading-none uppercase tracking-tight z-20 border border-white shadow-sm">Soon</span>
              
            </button>
            <span className="mt-1.5 text-[9px] font-black uppercase tracking-widest"
              style={{ color: activeTab === 'Assistant' ? '#7c3aed' : '#1B2B33' }}>
              NOVA
            </span>
          </div>

          <NavItem icon={<Plus className="h-6 w-6" />} label="Apply" onClick={() => router.push('/account/apply')} />
          <NavItem icon={<User className="h-6 w-6" />} label="Profile" active={activeTab === 'Profile'} onClick={() => setActiveTab('Profile')} />
      </nav>



      <Dialog open={isReferOpen} onOpenChange={setIsReferOpen}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem]">
              <DialogHeader><DialogTitle className="text-2xl font-black">Refer and Earn</DialogTitle></DialogHeader>
              <div className="p-4 space-y-6">
                  <div className="bg-[#1B2B33] rounded-3xl p-8 text-center space-y-4">
                      <div className="bg-[#0078D4] h-16 w-16 rounded-2xl flex items-center justify-center mx-auto"><Users className="h-8 w-8 text-white" /></div>
                      <h4 className="text-white text-lg font-black">Your Invitation Link</h4>
                      <div className="bg-white/10 p-4 rounded-2xl flex items-center justify-between gap-3 backdrop-blur-md">
                          <span className="text-[11px] font-black text-[#0078D4] truncate uppercase">{referralLink}</span>
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
                      {nextInstalmentAmount > 0 && (
                          <div className="flex justify-between items-center pt-2 border-t">
                              <span className="text-[#0078D4] text-[10px] font-black uppercase">Next Instalment</span>
                              <span className="text-xl font-black text-[#1B2B33]">KES {nextInstalmentAmount.toLocaleString()}</span>
                          </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t"><span className="text-primary text-[10px] font-black uppercase">Total Arrears</span><span className="text-2xl font-black text-destructive">KES {totalArrears.toLocaleString()}</span></div>
                  </div>
                  <Button onClick={() => setIsPayOpen(false)} className="w-full h-14 rounded-2xl bg-[#0078D4] font-black text-white">Done</Button>
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={isLoansOpen} onOpenChange={setIsLoansOpen}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden">
              <div className="bg-[#1B2B33] p-10 text-white"><DialogHeader><DialogTitle className="text-3xl font-black text-white">Our Loans</DialogTitle></DialogHeader></div>
              <div className="p-8 space-y-6 bg-white">
                  <ScrollArea className="max-h-[50vh] overflow-y-auto pr-4">
                      {LOAN_PRODUCTS.map((p, i) => (
                          <div key={i} className="p-6 rounded-3xl border mb-4 flex items-center justify-between hover:bg-[#0078D4]/5 transition-colors cursor-pointer" onClick={() => router.push('/account/apply')}>
                              <div className="space-y-1">
                                  <p className="font-black text-lg">{p.title}</p>
                                  <p className="text-[10px] font-black text-[#0078D4] uppercase tracking-widest">{p.rate}</p>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                      ))}
                  </ScrollArea>
                  <Button onClick={() => router.push('/account/apply')} className="w-full h-16 rounded-full bg-[#0078D4] text-white text-lg font-black shadow-lg shadow-[#0078D4]/20 transition-all active:scale-95">
                      Apply Now
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionCircle({ icon, label, status, onClick, highlight }: { icon: React.ReactNode, label: string, status?: string, onClick?: () => void, highlight?: boolean }) {
    return (
        <button onClick={onClick} className="flex flex-col items-center gap-2 group relative">
            <div className={cn(
              "w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all group-active:scale-90",
              highlight 
                ? "bg-green-500/15 border border-green-500/30 text-green-600"
                : "bg-[#0078D4]/10 border border-[#0078D4]/20 text-[#0078D4]"
            )}>{icon}</div>
            <span className="text-[10px] font-black text-[#1B2B33]/60 tracking-wider uppercase">{label}</span>
            {status && <div className="absolute -top-1 -right-1 bg-[#1B2B33] text-white text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ring-2 ring-white">{status}</div>}
        </button>
    );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
    return (
        <button onClick={onClick} className={cn("flex flex-col items-center gap-1 transition-all outline-none", active ? 'text-[#0078D4]' : 'text-[#1B2B33]/30')}>
            <div className={cn("transition-all duration-300", active ? 'scale-110 -translate-y-1' : 'scale-100')}>{icon}</div>
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );
}
