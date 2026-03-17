
'use client';
import { useUser, useCollection, useFirestore, useDoc, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Bell, 
  SendHorizontal, 
  Landmark, 
  Briefcase, 
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
  Copy
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
  const [isUpdatingProfile, setIsUpdating] = useState(false);

  // Handle dynamic greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const { data: customerProfile, loading: profileLoading } = useDoc<Customer>(user ? `customers/${user.uid}` : null);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      phone: '',
      idNumber: '',
    }
  });

  /**
   * SELF-HEALING MIGRATION
   * Ensures every logged-in user has a profile document and a unique referral code.
   */
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

  // Sync local form state with fetched profile ONLY once or when data changes and form is pristine
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
      return customerProfile?.name || user?.displayName || "Valued Member";
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
          profileForm.reset(values); // Mark as pristine again
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
      navigator.clipboard.writeText(referralLink);
      toast({ title: 'Link Copied', description: 'You can now share your referral link with friends.' });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB] text-[#1B2B33] pb-24 font-sans flex flex-col">
      {/* Header Section */}
      <header className="px-6 pt-12 pb-6 flex items-center justify-between bg-white border-b border-muted">
        <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-[#5BA9D0]">
                <AvatarFallback className="bg-[#1B2B33] text-white font-black">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1">
                <span className="text-lg font-bold text-[#1B2B33]">{activeTab === 'Profile' ? 'My Profile' : `${greeting}, ${firstName}`}</span>
                {activeTab !== 'Profile' && <span className="text-lg">👋</span>}
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button className="text-[#1B2B33]/60 hover:text-[#5BA9D0] transition-colors p-1">
                <Search className="h-5 w-5" />
            </button>
            <div className="relative">
                <button className="text-[#1B2B33]/60 hover:text-[#5BA9D0] transition-colors p-1">
                    <Bell className="h-5 w-5" />
                </button>
                <div className="absolute top-1 right-1 h-2 w-2 bg-[#27AE60] rounded-full border-2 border-white"></div>
            </div>
            <button 
                onClick={handleLogout}
                className="text-destructive hover:text-destructive/80 transition-colors p-1 ml-1"
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
                {/* Balance Card - Brand Focal Point */}
                <div className="relative overflow-hidden rounded-[2.5rem] p-8 min-h-[220px] bg-gradient-to-br from-[#5BA9D0] to-[#005C97] shadow-xl shadow-[#5BA9D0]/20 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1 text-white">
                            <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Total Balance</p>
                            <h2 className="text-4xl font-black">KES {totalBalance.toLocaleString()}</h2>
                        </div>
                        <CreditCard className="h-10 w-10 text-white/40" />
                    </div>
                    
                    <div className="flex justify-between items-end text-white">
                        <div className="space-y-1">
                            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Account Holder</p>
                            <p className="text-sm font-black uppercase">{fullName}</p>
                        </div>
                        <div className="text-right space-y-1">
                            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Referral Code</p>
                            <p className="text-sm font-black uppercase tracking-wider">{customerProfile?.referralCode || 'PROVISIONING...'}</p>
                        </div>
                    </div>
                    
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute top-0 left-0 w-20 h-20 bg-white/5 rounded-full blur-2xl"></div>
                </div>

                {/* Action Grid */}
                <div className="grid grid-cols-5 gap-2 px-2">
                    <ActionCircle 
                        icon={<SendHorizontal className="h-6 w-6 text-[#5BA9D0]" />} 
                        label="Send" 
                        status="Soon"
                    />
                    <ActionCircle 
                        icon={<Wallet className="h-6 w-6 text-[#5BA9D0]" />} 
                        label="Pay" 
                        onClick={() => setIsPayOpen(true)}
                    />
                    <ActionCircle 
                        icon={<Landmark className="h-6 w-6 text-[#5BA9D0]" />} 
                        label="Loans" 
                        onClick={() => setIsLoansOpen(true)}
                    />
                    <ActionCircle 
                        icon={<Users className="h-6 w-6 text-[#5BA9D0]" />} 
                        label="Refer" 
                        onClick={() => setIsReferOpen(true)}
                    />
                    <ActionCircle 
                        icon={<Folder className="h-6 w-6 text-[#5BA9D0]" />} 
                        label="Invest" 
                        status="Soon"
                    />
                </div>

                {/* Loan Applications Section */}
                <section className="space-y-4">
                    <h3 className="text-lg font-bold text-[#1B2B33] tracking-tight">Loan Applications</h3>
                    {pendingApplications.length === 0 ? (
                        <div className="bg-white border border-muted rounded-3xl p-8 text-center shadow-sm">
                            <p className="text-muted-foreground text-sm italic">No pending applications found.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingApplications.map(loan => (
                                <div key={loan.id} className="bg-white border border-muted rounded-3xl p-5 flex items-center justify-between group transition-all hover:shadow-md">
                                    <div className="space-y-1">
                                        <p className="font-black text-base text-[#1B2B33]">{loan.loanType || 'Quick Pesa'}</p>
                                        <p className="text-muted-foreground text-xs font-bold">Requested: KES {loan.principalAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-[#FDE68A] text-[#92400E] text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider">
                                        Pending
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Active Loans Section */}
                <section className="space-y-4">
                    <h3 className="text-lg font-bold text-[#1B2B33] tracking-tight">Active Loans</h3>
                    {activeLoans.length === 0 ? (
                        <div className="bg-white border border-muted rounded-3xl p-8 text-center shadow-sm">
                            <p className="text-muted-foreground text-sm italic">No active loans found.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-10">
                            {activeLoans.map(loan => (
                                <div key={loan.id} className="bg-white border border-muted rounded-3xl p-5 flex items-center justify-between group transition-all hover:shadow-md">
                                    <div className="space-y-1">
                                        <p className="font-black text-base text-[#1B2B33]">{loan.loanType || 'Quick Pesa'}</p>
                                        <p className="text-muted-foreground text-xs font-bold">Balance: KES {(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-[#27AE60]/10 text-[#27AE60] text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider border border-[#27AE60]/20">
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
                    <CardHeader className="bg-[#1B2B33] text-white p-8">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-[#5BA9D0] flex items-center justify-center text-3xl font-black text-white shadow-lg">
                                {initials}
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-white">{fullName}</CardTitle>
                                <CardDescription className="text-white/60">Account: {customerProfile?.accountNumber || 'N/A'}</CardDescription>
                            </div>
                        </div>
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
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40 ml-1">Full Name</FormLabel>
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
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40 ml-1">Phone Number</FormLabel>
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
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#5BA9D0]/40" />
                                            <Input 
                                                value={customerProfile?.email || user?.email || ''} 
                                                disabled 
                                                className="pl-12 h-14 rounded-2xl border-none bg-muted/50 text-muted-foreground italic cursor-not-allowed"
                                            />
                                        </div>
                                        <p className="text-[9px] text-muted-foreground ml-1">Primary authentication email cannot be changed.</p>
                                    </div>
                                </div>

                                <Button 
                                    type="submit"
                                    disabled={isUpdatingProfile}
                                    className="w-full h-16 rounded-full bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 font-black text-lg shadow-xl shadow-[#5BA9D0]/20 transition-all active:scale-95"
                                >
                                    {isUpdatingProfile ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Changes...</>
                                    ) : (
                                        'Save Profile Changes'
                                    )}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <div className="bg-[#5BA9D0]/5 border border-[#5BA9D0]/10 rounded-3xl p-6 flex items-start gap-4">
                    <Info className="h-6 w-6 text-[#5BA9D0] shrink-0" />
                    <div className="space-y-1">
                        <p className="font-bold text-sm text-[#1B2B33]">Security Note</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            To update your registered email or change your login password, please visit the account settings in the login portal.
                        </p>
                    </div>
                </div>
            </div>
        )}
      </main>

      {/* Payment Dialog */}
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
          <DialogContent className="sm:max-w-md rounded-[2rem]">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-[#1B2B33]">Pay Loan</DialogTitle>
                  <DialogDescription>Use the details below to make your repayment via M-Pesa.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                  <div className="bg-[#1B2B33] text-white p-6 rounded-3xl space-y-4 shadow-xl">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                          <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Paybill Number</span>
                          <span className="text-xl font-black">522522</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                          <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Account Number</span>
                          <span className="text-xl font-black">1347823360</span>
                      </div>
                      {nextInstalment > 0 && (
                          <div className="flex justify-between items-center pt-2">
                              <span className="text-[#5BA9D0] text-xs font-bold uppercase tracking-widest">Next Instalment</span>
                              <span className="text-2xl font-black">KES {nextInstalment.toLocaleString()}</span>
                          </div>
                      )}
                  </div>
                  <div className="flex items-start gap-3 bg-[#5BA9D0]/10 p-4 rounded-2xl border border-[#5BA9D0]/20">
                      <Info className="h-5 w-5 text-[#5BA9D0] shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-[#1B2B33]/70 leading-relaxed">
                          Once you make the payment, our system will automatically update your balance within 5-10 minutes. You will receive an email confirmation.
                      </p>
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={() => setIsPayOpen(false)} className="w-full h-14 rounded-xl bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 font-bold text-white">
                      Done
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Refer a Friend Dialog */}
      <Dialog open={isReferOpen} onOpenChange={setIsReferOpen}>
          <DialogContent className="sm:max-w-md rounded-[2rem]">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-[#1B2B33]">Refer a Friend</DialogTitle>
                  <DialogDescription>Love using Pezeka? Invite your friends and help them grow too!</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                  <div className="bg-[#F8FAFB] border border-[#5BA9D0]/20 rounded-3xl p-8 text-center space-y-4">
                      <div className="w-16 h-16 bg-[#5BA9D0]/10 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Users className="h-8 w-8 text-[#5BA9D0]" />
                      </div>
                      <h4 className="text-lg font-bold">Your Referral Link</h4>
                      <div className="bg-white border rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm">
                          <span className="text-sm font-bold text-[#5BA9D0] truncate">{referralLink}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-[#5BA9D0]" onClick={copyReferralLink}>
                              <Copy className="h-4 w-4" />
                          </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground px-4">Friends who sign up using your link will be associated with your account.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                      <Button onClick={handleShareReferral} className="h-14 rounded-2xl bg-[#25D366] hover:bg-[#25D366]/90 font-bold text-white">
                          <Share2 className="mr-2 h-4 w-4" /> Share on WhatsApp
                      </Button>
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={() => setIsReferOpen(false)} variant="ghost" className="w-full font-bold text-[#1B2B33]/40">
                      Maybe Later
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Loans Explorer Dialog */}
      <Dialog open={isLoansOpen} onOpenChange={setIsLoansOpen}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
              <div className="bg-[#1B2B33] p-10 text-white">
                  <DialogHeader>
                      <DialogTitle className="text-3xl font-black text-white tracking-tight">Loan Products</DialogTitle>
                      <DialogDescription className="text-white/60 text-base mt-2">Choose the perfect credit facility for your needs.</DialogDescription>
                  </DialogHeader>
              </div>
              <div className="p-8 bg-white space-y-6">
                  <ScrollArea className="max-h-[50vh] pr-2">
                    <div className="space-y-5">
                        {LOAN_PRODUCTS.map((product, i) => (
                            <div key={i} className="flex items-center justify-between p-6 rounded-[2rem] border border-muted hover:border-[#5BA9D0]/30 hover:bg-[#5BA9D0]/5 transition-all group cursor-pointer shadow-sm">
                                <div className="space-y-2">
                                    <p className="font-black text-xl text-[#1B2B33]">{product.title}</p>
                                    <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed font-medium">{product.description}</p>
                                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#27AE60]/10 border border-[#27AE60]/20">
                                        <span className="text-[10px] font-black text-[#27AE60] uppercase tracking-wider">{product.rate.toUpperCase()}</span>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/50 group-hover:bg-[#5BA9D0]/10 transition-colors">
                                    <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-[#5BA9D0] transition-colors" />
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

      {/* Fixed Bottom Navigation - Light Theme */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t border-muted px-10 flex items-center justify-between z-50">
          <NavItem 
            icon={<Home className="h-6 w-6" />} 
            label="Home" 
            active={activeTab === 'Home'} 
            onClick={() => setActiveTab('Home')} 
          />
          <NavItem 
            icon={<Plus className="h-6 w-6" />} 
            label="New Loan" 
            active={activeTab === 'New Loan'} 
            onClick={() => {
                setActiveTab('New Loan');
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
            <div className="w-14 h-14 rounded-full bg-[#5BA9D0]/10 border border-[#5BA9D0]/20 flex items-center justify-center transition-all group-active:scale-90 hover:bg-[#5BA9D0]/20">
                {icon}
            </div>
            <span className="text-[11px] font-bold text-[#1B2B33]/70">{label}</span>
            {status && (
                <div className="absolute -top-1 -right-1 bg-[#1B2B33] text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ring-2 ring-white">
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
            className={`flex flex-col items-center gap-1.5 transition-all outline-none relative ${active ? 'text-[#5BA9D0]' : 'text-[#1B2B33]/40 hover:text-[#1B2B33]/60'}`}
        >
            <div className={`transition-all ${active ? 'scale-110' : 'scale-100'}`}>
                {icon}
            </div>
            <span className={`text-[10px] font-bold tracking-tight ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
            {active && (
                <div className="absolute -bottom-2 w-1 h-1 bg-[#5BA9D0] rounded-full"></div>
            )}
        </button>
    );
}
