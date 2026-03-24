'use client';
import { useUser, useCollection, useFirestore, useDoc, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { 
  Search, 
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
  Star
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
                  name: user.displayName || 'Pezeka Member',
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

  const customerLoansQuery = useMemo(() => {
    if (userLoading || !firestore || !user?.uid) return null;
    return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [firestore, user?.uid, userLoading]);

  const { data: customerLoans } = useCollection<Loan>(customerLoansQuery);

  const fullName = useMemo(() => {
      // Prioritize the name from the Firestore profile
      if (customerProfile?.name) return customerProfile.name;
      if (user?.displayName) return user.displayName;
      return "Valued Member";
  }, [customerProfile, user]);

  const firstName = useMemo(() => {
      return fullName.split(' ')[0];
  }, [fullName]);

  const initials = useMemo(() => {
      return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }, [fullName]);

  const activeLoans = useMemo(() => 
    customerLoans?.filter(l => l.status !== 'application' && l.status !== 'paid' && l.status !== 'rejected' && l.status !== 'rollover') || [], 
  [customerLoans]);

  const pendingApplications = useMemo(() => 
    customerLoans?.filter(l => l.status === 'application') || [], 
  [customerLoans]);

  const totalBalance = useMemo(() => {
      return activeLoans.reduce((acc, loan) => acc + (loan.totalRepayableAmount - loan.totalPaid), 0);
  }, [activeLoans]);

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
          toast({ title: 'Profile Updated', description: 'Your details have been saved successfully.' });
          profileForm.reset(values);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
      } finally {
          setIsUpdatingProfile(false);
      }
  };

  const referralLink = useMemo(() => {
      const code = customerProfile?.referralCode || 'INVITE';
      return `pezeka.com/${code}`;
  }, [customerProfile?.referralCode]);

  const handleShareReferral = () => {
      const message = `Hi! I'm using Pezeka Credit for fast and reliable loans. Use my link to join and get started: ${referralLink}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
  };

  const copyReferralLink = () => {
      if (typeof window !== 'undefined') {
          navigator.clipboard.writeText(referralLink);
          toast({ title: 'Link Copied', description: 'You can now share your referral link with friends.' });
      }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB] text-[#1B2B33] pb-24 font-sans flex flex-col">
      {/* Header Section */}
      <header className="px-6 pt-12 pb-6 flex items-center justify-between bg-white border-b border-muted">
        <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-[#5BA9D0] transition-transform active:scale-95 cursor-pointer">
                <AvatarFallback className="bg-[#1B2B33] text-white font-black">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{greeting}</span>
                <span className="text-lg font-black text-[#1B2B33]">{activeTab === 'Profile' ? 'My Profile' : `${firstName} 👋`}</span>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <div className="relative">
                <button className="text-[#1B2B33]/60 hover:text-[#5BA9D0] transition-colors p-2 rounded-full hover:bg-muted">
                    <Bell className="h-5 w-5" />
                </button>
                <div className="absolute top-2 right-2 h-2 w-2 bg-[#27AE60] rounded-full border-2 border-white"></div>
            </div>
            <button 
                onClick={handleLogout}
                className="text-destructive hover:text-destructive/80 transition-colors p-2 rounded-full hover:bg-destructive/5 ml-1"
                title="Logout"
            >
                <LogOut className="h-5 w-5" />
            </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 space-y-8 flex-1 pt-6">
        {activeTab === 'Home' && (
            <>
                {/* Balance Card - Premium Fintech Design */}
                <div className="relative overflow-hidden rounded-[2.5rem] p-8 min-h-[240px] bg-[#1B2B33] text-white shadow-2xl shadow-[#1B2B33]/30 flex flex-col justify-between group">
                    {/* Texture/Pattern Overlay */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>
                    
                    <div className="flex justify-between items-start relative z-10">
                        <div className="space-y-1">
                            <p className="text-white/50 text-[10px] font-black uppercase tracking-widest">Total Outstanding</p>
                            <h2 className="text-4xl font-black tabular-nums">KES {totalBalance.toLocaleString()}</h2>
                            {activeLoans.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-2 bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-md">
                                    <TrendingUp className="h-3 w-3 text-[#5BA9D0]" />
                                    <span className="text-[10px] font-bold text-white/80">Next: KES {nextInstalment.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-xl border border-white/10">
                            <CreditCard className="h-6 w-6 text-[#5BA9D0]" />
                        </div>
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
                    
                    {/* Background Glows */}
                    <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-[#5BA9D0]/20 rounded-full blur-[80px] group-hover:scale-110 transition-transform duration-700"></div>
                    <div className="absolute top-0 left-0 w-20 h-20 bg-white/5 rounded-full blur-[40px]"></div>
                </div>

                {/* Action Grid - Soft UI Style */}
                <div className="grid grid-cols-5 gap-3 px-1">
                    <ActionCircle 
                        icon={<SendHorizontal className="h-6 w-6" />} 
                        label="Send" 
                        status="SOON"
                    />
                    <ActionCircle 
                        icon={<Wallet className="h-6 w-6" />} 
                        label="Pay" 
                        onClick={() => setIsPayOpen(true)}
                    />
                    <ActionCircle 
                        icon={<Landmark className="h-6 w-6" />} 
                        label="Loans" 
                        onClick={() => setIsLoansOpen(true)}
                    />
                    <ActionCircle 
                        icon={<Users className="h-6 w-6" />} 
                        label="Refer" 
                        onClick={() => setIsReferOpen(true)}
                    />
                    <ActionCircle 
                        icon={<Folder className="h-6 w-6" />} 
                        label="Invest" 
                        status="SOON"
                    />
                </div>

                {/* Applications Section - Interactive Empty States */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-[#1B2B33] tracking-tight">Loan Applications</h3>
                        <Badge variant="outline" className="bg-[#5BA9D0]/5 border-[#5BA9D0]/20 text-[#5BA9D0] font-black text-[9px]">VIEW ALL</Badge>
                    </div>
                    {pendingApplications.length === 0 ? (
                        <div className="bg-white border-2 border-dashed border-muted rounded-[2rem] p-8 text-center space-y-4 shadow-sm group hover:border-[#5BA9D0]/30 transition-all cursor-pointer" onClick={() => setIsLoansOpen(true)}>
                            <div className="w-12 h-12 bg-[#5BA9D0]/5 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                <Zap className="h-6 w-6 text-[#5BA9D0]/40" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-sm">Need a quick top-up?</p>
                                <p className="text-muted-foreground text-xs px-4">You're eligible for a Quick Pesa loan. Apply in 60 seconds.</p>
                            </div>
                            <Button variant="ghost" size="sm" className="text-[#5BA9D0] font-black text-[10px] uppercase tracking-widest hover:bg-[#5BA9D0]/5">Apply Now <ChevronRight className="h-3 w-3 ml-1" /></Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingApplications.map(loan => (
                                <div key={loan.id} className="bg-white border border-muted rounded-3xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                                    <div className="space-y-1">
                                        <p className="font-black text-base text-[#1B2B33]">{loan.loanType || 'Quick Pesa'}</p>
                                        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-wider">KES {loan.principalAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-[#FDE68A] text-[#92400E] text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border border-[#FDE68A]">
                                        Pending
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Active Loans Section */}
                <section className="space-y-4">
                    <h3 className="text-lg font-black text-[#1B2B33] tracking-tight">Active Portfolio</h3>
                    {activeLoans.length === 0 ? (
                        <div className="bg-[#1B2B33] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl">
                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="bg-[#5BA9D0] p-2 rounded-lg">
                                        <Lightbulb className="h-4 w-4 text-white" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#5BA9D0]">Financial Insight</span>
                                </div>
                                <p className="text-sm font-bold leading-relaxed">{randomTip}</p>
                                <Button className="bg-white text-[#1B2B33] hover:bg-white/90 font-black text-xs h-10 rounded-xl w-full sm:w-auto">Explore Products</Button>
                            </div>
                            <Star className="absolute -bottom-4 -right-4 h-24 w-24 text-white/5 rotate-12" />
                        </div>
                    ) : (
                        <div className="space-y-3 pb-10">
                            {activeLoans.map(loan => (
                                <div key={loan.id} className="bg-white border border-muted rounded-3xl p-5 flex items-center justify-between group transition-all hover:shadow-md">
                                    <div className="space-y-1">
                                        <p className="font-black text-base text-[#1B2B33]">{loan.loanType || 'Quick Pesa'}</p>
                                        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-wider">Remaining: KES {(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-[#27AE60]/10 text-[#27AE60] text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border border-[#27AE60]/20">
                                        Active
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </>
        )}

        {activeTab === 'Profile' && (
            <div className="space-y-6 pb-10">
                <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-[#1B2B33] text-white p-8 relative">
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-[#5BA9D0] flex items-center justify-center text-3xl font-black text-white shadow-lg rotate-3">
                                {initials}
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-white">{fullName}</CardTitle>
                                <CardDescription className="text-[#5BA9D0] font-black text-[10px] uppercase tracking-widest">{customerProfile?.accountNumber || 'PZ-NEW'}</CardDescription>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <Form {...profileForm}>
                            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                                <div className="space-y-4">
                                    <FormField
                                        control={profileForm.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem className="space-y-2">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40 ml-1">Full Legal Name</FormLabel>
                                                <div className="relative">
                                                    <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#5BA9D0]" />
                                                    <FormControl>
                                                        <Input 
                                                            placeholder="Your full name"
                                                            className="pl-12 h-14 rounded-2xl border-[#5BA9D0]/10 bg-[#F8FAFB] focus:bg-white transition-all focus:ring-[#5BA9D0]"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={profileForm.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem className="space-y-2">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40 ml-1">Primary Phone</FormLabel>
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#5BA9D0]" />
                                                    <FormControl>
                                                        <Input 
                                                            placeholder="07XX XXX XXX"
                                                            className="pl-12 h-14 rounded-2xl border-[#5BA9D0]/10 bg-[#F8FAFB] focus:bg-white transition-all focus:ring-[#5BA9D0]"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={profileForm.control}
                                        name="idNumber"
                                        render={({ field }) => (
                                            <FormItem className="space-y-2">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40 ml-1">National ID Number</FormLabel>
                                                <div className="relative">
                                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#5BA9D0]" />
                                                    <FormControl>
                                                        <Input 
                                                            placeholder="National ID"
                                                            className="pl-12 h-14 rounded-2xl border-[#5BA9D0]/10 bg-[#F8FAFB] focus:bg-white transition-all focus:ring-[#5BA9D0]"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40 ml-1">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#1B2B33]/20" />
                                            <Input 
                                                value={customerProfile?.email || user?.email || ''} 
                                                disabled 
                                                className="pl-12 h-14 rounded-2xl border-none bg-muted/50 text-muted-foreground italic cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button 
                                    type="submit"
                                    disabled={isUpdatingProfile}
                                    className="w-full h-16 rounded-full bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 font-black text-lg shadow-xl shadow-[#5BA9D0]/20 transition-all active:scale-95"
                                >
                                    {isUpdatingProfile ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</>
                                    ) : (
                                        'Update Profile'
                                    )}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        )}
      </main>

      {/* Payment Dialog */}
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
              <div className="bg-[#1B2B33] p-10 text-white">
                  <DialogHeader>
                      <DialogTitle className="text-3xl font-black text-white tracking-tight">Make a Payment</DialogTitle>
                      <DialogDescription className="text-white/50 text-sm mt-2">Instant M-Pesa settlements.</DialogDescription>
                  </DialogHeader>
              </div>
              <div className="p-8 space-y-6">
                  <div className="bg-[#F8FAFB] border border-[#5BA9D0]/10 p-6 rounded-3xl space-y-4">
                      <div className="flex justify-between items-center border-b border-[#1B2B33]/5 pb-3">
                          <span className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Paybill Number</span>
                          <span className="text-xl font-black text-[#1B2B33]">522522</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#1B2B33]/5 pb-3">
                          <span className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Account Number</span>
                          <span className="text-xl font-black text-[#1B2B33]">1347823360</span>
                      </div>
                      {nextInstalment > 0 && (
                          <div className="flex justify-between items-center pt-2">
                              <span className="text-[#5BA9D0] text-[10px] font-black uppercase tracking-widest">Next Instalment</span>
                              <span className="text-2xl font-black text-[#5BA9D0]">KES {nextInstalment.toLocaleString()}</span>
                          </div>
                      )}
                  </div>
                  <div className="flex items-start gap-3 bg-[#27AE60]/5 p-4 rounded-2xl border border-[#27AE60]/10">
                      <Info className="h-5 w-5 text-[#27AE60] shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-[#1B2B33]/70 leading-relaxed italic">
                          "Success: Payments are usually updated within 5 minutes. You'll receive a confirmation email."
                      </p>
                  </div>
                  <Button onClick={() => setIsPayOpen(false)} className="w-full h-14 rounded-2xl bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 font-black text-white text-lg">
                      I've made the payment
                  </Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* Refer a Friend Dialog */}
      <Dialog open={isReferOpen} onOpenChange={setIsReferOpen}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl">
              <DialogHeader className="p-8 pb-0">
                  <DialogTitle className="text-3xl font-black text-[#1B2B33] tracking-tight">Refer & Grow</DialogTitle>
                  <DialogDescription className="font-bold">Build the Pezeka community and help your friends access affordable credit.</DialogDescription>
              </DialogHeader>
              <div className="p-8 pt-4 space-y-6">
                  <div className="bg-[#1B2B33] rounded-3xl p-8 text-center space-y-4 shadow-xl">
                      <div className="w-16 h-16 bg-[#5BA9D0] rounded-2xl flex items-center justify-center mx-auto mb-2 rotate-6">
                          <Users className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="text-lg font-black text-white">Your Magic Link</h4>
                      <div className="bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3 backdrop-blur-md">
                          <span className="text-[11px] font-black text-[#5BA9D0] truncate tracking-wider uppercase">{referralLink}</span>
                          <Button size="icon" variant="ghost" className="h-10 w-10 text-white hover:bg-white/10" onClick={copyReferralLink}>
                              <Copy className="h-4 w-4" />
                          </Button>
                      </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                      <Button onClick={handleShareReferral} className="h-16 rounded-full bg-[#25D366] hover:bg-[#25D366]/90 font-black text-white text-lg shadow-xl shadow-green-500/20">
                          <Share2 className="mr-2 h-5 w-5" /> Share on WhatsApp
                      </Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {/* Loans Explorer Dialog */}
      <Dialog open={isLoansOpen} onOpenChange={setIsLoansOpen}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
              <div className="bg-[#1B2B33] p-10 text-white">
                  <DialogHeader>
                      <DialogTitle className="text-3xl font-black text-white tracking-tight">Our Products</DialogTitle>
                      <DialogDescription className="text-white/50 text-base mt-2">Transparent, reliable, and tailored for you.</DialogDescription>
                  </DialogHeader>
              </div>
              <div className="p-8 bg-white space-y-6">
                  <ScrollArea className="max-h-[50vh] pr-2">
                    <div className="space-y-5">
                        {LOAN_PRODUCTS.map((product, i) => (
                            <div key={i} className="flex items-center justify-between p-6 rounded-[2rem] border-2 border-[#F8FAFB] hover:border-[#5BA9D0]/30 hover:bg-[#5BA9D0]/5 transition-all group cursor-pointer">
                                <div className="space-y-2">
                                    <p className="font-black text-xl text-[#1B2B33]">{product.title}</p>
                                    <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed font-bold italic">{product.description}</p>
                                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#5BA9D0]/10 border border-[#5BA9D0]/20">
                                        <span className="text-[10px] font-black text-[#5BA9D0] uppercase tracking-wider">{product.rate}</span>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/50 group-hover:bg-[#5BA9D0] transition-all">
                                    <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-white" />
                                </div>
                            </div>
                        ))}
                    </div>
                  </ScrollArea>
                  <div className="pt-4 px-2">
                      <Button 
                        onClick={() => { setIsLoansOpen(false); router.push('/account/apply'); }} 
                        className="w-full h-16 rounded-full bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 font-black text-xl shadow-xl shadow-[#5BA9D0]/30 transition-all active:scale-95"
                      >
                          Apply Now
                      </Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {/* Fixed Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t border-muted px-10 flex items-center justify-between z-50">
          <NavItem 
            icon={<Home className="h-6 w-6" />} 
            label="Home" 
            active={activeTab === 'Home'} 
            onClick={() => setActiveTab('Home')} 
          />
          <NavItem 
            icon={<Plus className="h-6 w-6" />} 
            label="Apply" 
            active={false} 
            onClick={() => {
                router.push('/account/apply');
            }} 
          />
          <NavItem 
            icon={<User className="h-6 w-6" />} 
            label="Profile" 
            active={activeTab === 'Profile'} 
            onClick={() => setActiveTab('Profile')} 
          />
      </nav>
    </div>
  );
}

function ActionCircle({ icon, label, status, onClick }: { icon: React.ReactNode, label: string, status?: string, onClick?: () => void }) {
    return (
        <button onClick={onClick} className="flex flex-col items-center gap-2 group relative">
            <div className="w-14 h-14 rounded-[1.25rem] bg-[#5BA9D0]/10 border border-[#5BA9D0]/20 flex items-center justify-center transition-all group-active:scale-90 hover:bg-[#5BA9D0]/20 hover:shadow-md hover:shadow-[#5BA9D0]/10 text-[#5BA9D0]">
                {icon}
            </div>
            <span className="text-[10px] font-black text-[#1B2B33]/60 tracking-wider uppercase">{label}</span>
            {status && (
                <div className="absolute -top-1 -right-1 bg-[#1B2B33] text-white text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ring-2 ring-white">
                    {status}
                </div>
            )}
        </button>
    );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-center gap-1.5 transition-all outline-none relative group ${active ? 'text-[#5BA9D0]' : 'text-[#1B2B33]/30 hover:text-[#1B2B33]/50'}`}
        >
            <div className={`transition-all duration-300 ${active ? 'scale-110 -translate-y-1' : 'scale-100'}`}>
                {icon}
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest transition-opacity ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
            {active && (
                <div className="absolute -bottom-2 w-1.5 h-1.5 bg-[#5BA9D0] rounded-full animate-in zoom-in duration-300"></div>
            )}
        </button>
    );
}
