'use client';
import { useUser, useCollection, useFirestore, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PlusCircle, 
  Loader2, 
  FileUp, 
  History, 
  Wallet, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Bell, 
  User, 
  PiggyBank, 
  ArrowUpRight, 
  Receipt, 
  Smartphone, 
  Home, 
  CreditCard, 
  Users, 
  Bot,
  MoreHorizontal
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { format, addDays, addWeeks, addMonths, isBefore, startOfToday } from 'date-fns';
import { collection, query, where } from 'firebase/firestore';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { addLoan, upsertCustomer } from '@/lib/firestore';
import { calculateAmortization } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Payment {
  paymentId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
}

interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  alternativeNumber?: string;
  idNumber?: string;
  loanType?: string;
  disbursementDate: { seconds: number, nanoseconds: number };
  principalAmount: number;
  interestRate?: number;
  registrationFee: number;
  processingFee: number;
  carTrackInstallationFee: number;
  chargingCost: number;
  numberOfInstalments: number;
  instalmentAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  payments?: Payment[];
  comments?: string;
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
}

interface Customer {
    id: string;
    accountNumber?: string;
    name: string;
    phone: string;
    email?: string;
}

const applicationSchema = z.object({
  loanType: z.string({ required_error: 'Please select a loan type.' }),
  loanAmount: z.coerce.number().min(1, 'Please enter a valid loan amount.'),
  numberOfInstalments: z.coerce.number().min(1, 'Please enter number of instalments.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  idNumber: z.string().min(5, 'Please enter a valid ID number.'),
  phone: z.string().min(10, 'Please enter a valid phone number.'),
  alternativeNumber: z.string().optional(),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions.' }),
  }),
});

export default function AccountPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState<Loan | null>(null);
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  const { data: customerProfile, loading: profileLoading } = useDoc<Customer>(user ? `customers/${user.uid}` : null);

  const customerLoansQuery = useMemo(() => {
    if (userLoading || !firestore || !user?.uid) return null;
    return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [firestore, user?.uid, userLoading]);

  const { data: customerLoans, loading: loansLoading } = useCollection<Loan>(customerLoansQuery);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = useMemo(() => {
      const fullName = customerProfile?.name || user?.displayName;
      if (fullName) return fullName.split(' ')[0];
      const email = user?.email || "";
      if (email) return email.split('@')[0];
      return "there";
  }, [customerProfile, user]);

  const applicationForm = useForm<z.infer<typeof applicationSchema>>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      loanType: 'Quick Pesa',
      loanAmount: 0,
      numberOfInstalments: 1,
      paymentFrequency: 'monthly',
      idNumber: '',
      phone: user?.phoneNumber || '',
      alternativeNumber: '',
      agreeToTerms: false as any,
    },
  });

  useEffect(() => {
    const pendingData = sessionStorage.getItem('pendingLoanApplication');
    if (pendingData) {
      try {
        const data = JSON.parse(pendingData);
        applicationForm.setValue('loanAmount', data.amount);
        applicationForm.setValue('numberOfInstalments', data.period);
        applicationForm.setValue('paymentFrequency', data.frequency);
        if (data.loanType) applicationForm.setValue('loanType', data.loanType);
        sessionStorage.removeItem('pendingLoanApplication');
      } catch (e) {
        console.error("Failed to parse pending loan data", e);
      }
    }
  }, [applicationForm]);

  async function onApplicationSubmit(values: z.infer<typeof applicationSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const fullName = user.displayName || user.email || "Customer";
      await upsertCustomer(firestore, user.uid, { name: fullName, phone: values.phone, idNumber: values.idNumber });
      
      const interestRate = (values.loanType === 'Individual & Business Loan') ? 5 : 10;
      const { instalmentAmount, totalRepayableAmount } = calculateAmortization(values.loanAmount, interestRate, values.numberOfInstalments, values.paymentFrequency);

      const loanApplicationData = {
        customerId: user.uid,
        customerName: fullName,
        customerPhone: values.phone,
        alternativeNumber: values.alternativeNumber || "",
        idNumber: values.idNumber,
        disbursementDate: new Date(),
        principalAmount: values.loanAmount,
        interestRate: interestRate, 
        registrationFee: 0,
        processingFee: 0,
        carTrackInstallationFee: 0,
        chargingCost: 0,
        numberOfInstalments: values.numberOfInstalments, 
        paymentFrequency: values.paymentFrequency,
        status: 'application' as const,
        loanType: values.loanType,
        instalmentAmount: instalmentAmount, 
        totalRepayableAmount: totalRepayableAmount, 
        totalPaid: 0,
        comments: `Application for ${values.loanType} from web portal.`
      };
      
      await addLoan(firestore, loanApplicationData);
      toast({ title: "Application Submitted", description: "Our team will review your application and get back to you." });
      applicationForm.reset();
    } catch (e: any) { 
        toast({ variant: 'destructive', title: 'Failed', description: e.message }); 
    } finally { 
        setIsSubmitting(false); 
    }
  }

  const getNextDueDate = (loan: Loan) => {
      try {
          const dDate = loan.disbursementDate?.seconds 
            ? new Date(loan.disbursementDate.seconds * 1000) 
            : (loan.disbursementDate ? new Date(loan.disbursementDate as any) : new Date());
          
          if (isNaN(dDate.getTime())) return null;

          const paidInstalments = Math.floor((loan.totalPaid || 0) / (loan.instalmentAmount || 1));
          const nextIdx = paidInstalments + 1;
          
          if (loan.paymentFrequency === 'daily') return addDays(dDate, nextIdx);
          if (loan.paymentFrequency === 'weekly') return addWeeks(dDate, nextIdx);
          return addMonths(dDate, nextIdx);
      } catch (e) {
          return null;
      }
  };

  const getStatusConfig = (status: string, nextDue: Date | null) => {
      const today = startOfToday();
      if (status === 'paid') return { label: 'PAID', color: 'bg-muted text-muted-foreground border-muted-foreground/20', icon: <CheckCircle2 className="h-3 w-3" /> };
      if (status === 'application') return { label: 'PENDING APPROVAL', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="h-3 w-3" /> };
      if (status === 'rejected') return { label: 'REJECTED', color: 'bg-red-100 text-red-700 border-red-200', icon: <AlertCircle className="h-3 w-3" /> };
      
      if (nextDue && isBefore(nextDue, today)) return { label: 'OVERDUE', color: 'bg-red-600 text-white border-red-700 shadow-sm shadow-red-500/20', icon: <AlertCircle className="h-3 w-3" /> };
      if (status === 'due') return { label: 'DUE SOON', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Clock className="h-3 w-3" /> };
      
      return { label: 'ACTIVE', color: 'bg-[#27AE60] text-white border-[#27AE60]/20 shadow-sm shadow-[#27AE60]/20', icon: <CheckCircle2 className="h-3 w-3" /> };
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB] pb-24">
      {/* Header */}
      <header className="px-6 pt-8 pb-4 flex flex-col items-center gap-1 relative bg-white border-b border-muted">
        <div className="absolute left-6 top-10 flex items-center justify-center w-10 h-10 rounded-full bg-muted overflow-hidden">
            <User className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-black text-[#1B2B33] tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">{greeting}, <span className="font-bold text-[#1B2B33]">{firstName}</span></p>
        <div className="absolute right-6 top-10">
            <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-6 w-6" />
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center bg-red-500 text-white text-[10px]">7</Badge>
            </Button>
        </div>
      </header>

      <main className="p-6 space-y-8 max-w-lg mx-auto">
        {/* Main Account Card */}
        <div className="relative group">
            <Card className="bg-[#1B2B33] text-white rounded-[2.5rem] p-8 border-none shadow-2xl overflow-hidden min-h-[220px] flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-60">
                        {customerProfile?.name || firstName.toUpperCase()}
                    </span>
                    <MoreHorizontal className="h-6 w-6 opacity-60" />
                </div>
                <div>
                    <p className="text-sm opacity-60 mb-1">Balance</p>
                    <p className="text-4xl font-black">KES. {((customerLoans && customerLoans[0]?.principalAmount) || 0).toLocaleString()}.00</p>
                </div>
                <div className="flex justify-between items-end">
                    <p className="font-mono text-sm opacity-60">{customerProfile?.accountNumber || '1000000151'}</p>
                    <span className="text-xs font-bold opacity-60">Current Account</span>
                </div>
                {/* Decorative circle */}
                <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            </Card>
            <div className="flex justify-center gap-1.5 mt-4">
                <div className="w-4 h-1.5 bg-red-500 rounded-full" />
                <div className="w-1.5 h-1.5 bg-muted-foreground/20 rounded-full" />
            </div>
        </div>

        {/* Action Grid */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-6">
            <div className="grid grid-cols-5 gap-2">
                <ActionIcon icon={<PiggyBank className="h-5 w-5" />} label="Save" />
                <ActionIcon icon={<CreditCard className="h-5 w-5" />} label="Loan" active />
                <ActionIcon icon={<ArrowUpRight className="h-5 w-5" />} label="Transfer" />
                <ActionIcon icon={<Receipt className="h-5 w-5" />} label="Invoice" />
                <ActionIcon icon={<Smartphone className="h-5 w-5" />} label="Bills" badge="Soon" />
            </div>
        </Card>

        {/* Explore Section */}
        <section className="space-y-4">
            <h3 className="text-xl font-black flex items-center gap-2">
                Explore Your Next Steps <span className="text-xl">🔥</span>
            </h3>
            <div className="overflow-x-auto pb-4 -mx-6 px-6 no-scrollbar flex gap-4">
                <ExploreCard 
                    title="silatech" 
                    subtitle="Savings" 
                    desc="Start your deposits today." 
                    buttonText="Top Up (Ksh 1000.0)"
                    image="https://picsum.photos/seed/silatech/400/300"
                    color="bg-[#00897B]"
                />
                <ExploreCard 
                    title="Business" 
                    subtitle="Loans" 
                    desc="Fuel your growth." 
                    buttonText="Apply Now"
                    image="https://picsum.photos/seed/bizloan/400/300"
                    color="bg-[#5BA9D0]"
                />
            </div>
        </section>

        {/* My Loans Section (Existing functionality adapted) */}
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-black">My Active Loans</h3>
                <Button variant="link" size="sm" className="text-[#5BA9D0] font-bold p-0 h-auto">View All</Button>
            </div>
            {loansLoading ? (
                <div className="flex items-center justify-center p-8 bg-white rounded-3xl border border-dashed"><Loader2 className="h-6 w-6 animate-spin text-[#5BA9D0]" /></div>
            ) : (customerLoans && customerLoans.length > 0) ? (
                <div className="space-y-4">
                    {customerLoans.slice(0, 2).map(loan => {
                        const balance = (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0);
                        const nextDue = getNextDueDate(loan);
                        const status = getStatusConfig(loan.status, nextDue);
                        return (
                            <Card key={loan.id} className="rounded-3xl border-none shadow-md bg-white overflow-hidden p-5 flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${status.color.split(' ')[0]} bg-opacity-10 text-opacity-100`}>
                                    <Wallet className="h-6 w-6" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-[#1B2B33]">Loan #{loan.loanNumber}</p>
                                    <p className="text-xs text-muted-foreground">Bal: Ksh {balance.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <Badge className={`rounded-full text-[10px] uppercase font-black px-2 py-0 ${status.color}`}>
                                        {status.label}
                                    </Badge>
                                    {loan.status !== 'paid' && (
                                        <Button variant="ghost" size="sm" onClick={() => setShowPaymentInstructions(true)} className="h-8 text-[#5BA9D0] font-bold text-xs p-0 mt-1 block ml-auto">Pay Now</Button>
                                    )}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed flex flex-col items-center">
                    <PlusCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground font-medium">No active loans found.</p>
                    <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => setActiveTab('Loan')}>Apply Now</Button>
                </div>
            )}
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-muted px-6 flex items-center justify-between z-40">
          <NavItem icon={<Home className="h-6 w-6" />} label="Home" active={activeTab === 'Home'} onClick={() => setActiveTab('Home')} />
          <NavItem icon={<Users className="h-6 w-6" />} label="Community" active={activeTab === 'Community'} onClick={() => setActiveTab('Community')} />
          
          {/* FAB Center */}
          <div className="relative -top-10 flex flex-col items-center">
              <div className="absolute -inset-2 bg-red-100 rounded-full blur-xl opacity-50" />
              <Button className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-xl shadow-red-200 border-none flex items-center justify-center transition-transform hover:scale-110 active:scale-95">
                  <Bot className="h-8 w-8 text-white" />
              </Button>
          </div>

          <NavItem icon={<CreditCard className="h-6 w-6" />} label="Cards" active={activeTab === 'Cards'} onClick={() => setActiveTab('Cards')} />
          <NavItem icon={<User className="h-6 w-6" />} label="Profile" active={activeTab === 'Profile'} onClick={() => setActiveTab('Profile')} />
      </nav>

      {/* Reused Payment Instructions Dialog */}
      <Dialog open={showPaymentInstructions} onOpenChange={setShowPaymentInstructions}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl p-8">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-[#1B2B33]">How to Pay</DialogTitle>
                  <DialogDescription className="font-medium">Please use the details below to make your repayment via M-Pesa.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                  <div className="bg-[#5BA9D0]/5 border-2 border-[#5BA9D0]/10 rounded-2xl p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-[#5BA9D0]/10 pb-3">
                          <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Paybill Number</span>
                          <span className="text-xl font-black text-[#5BA9D0]">522522</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#5BA9D0]/10 pb-3">
                          <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Account Number</span>
                          <span className="text-xl font-black text-[#5BA9D0]">1347823360</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                          <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Reference</span>
                          <span className="text-sm font-bold bg-white px-2 py-1 rounded border border-[#1B2B33]/10">Your National ID</span>
                      </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-2 font-medium bg-[#F8FAFB] p-4 rounded-xl border border-muted">
                      <p>1. Go to M-Pesa Menu &gt; Lipa na M-Pesa</p>
                      <p>2. Select Pay Bill and enter the Business No. above</p>
                      <p>3. Enter the Account No. and your Loan ID or National ID</p>
                      <p>4. Enter the amount and your M-Pesa PIN</p>
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={() => setShowPaymentInstructions(false)} className="w-full h-12 rounded-xl font-black bg-[#1B2B33] hover:bg-[#1B2B33]/90 text-white border-none">I Have Paid</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionIcon({ icon, label, badge, active = false }: { icon: React.ReactNode, label: string, badge?: string, active?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-2">
            <div className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${active ? 'bg-red-500 text-white' : 'bg-muted/50 text-[#1B2B33] hover:bg-muted'}`}>
                {icon}
                {badge && (
                    <div className="absolute -top-1 -right-1 bg-red-200 text-red-600 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border border-white">
                        {badge}
                    </div>
                )}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-tight ${badge ? 'text-muted-foreground/50' : 'text-[#1B2B33]'}`}>{label}</span>
        </div>
    );
}

function ExploreCard({ title, subtitle, desc, buttonText, image, color }: any) {
    return (
        <Card className={`min-w-[280px] h-40 rounded-[2.5rem] border-none shadow-lg overflow-hidden flex relative ${color}`}>
            <div className="w-1/2 p-6 flex flex-col justify-between text-white relative z-10">
                <div className="space-y-0.5">
                    <h4 className="text-lg font-black leading-tight">{title}</h4>
                    <p className="text-xs font-bold opacity-80">{subtitle}</p>
                </div>
                <Button className="w-full h-8 text-[10px] font-black rounded-full bg-white text-[#1B2B33] border-none hover:bg-white/90">
                    {buttonText}
                </Button>
                <p className="text-[8px] opacity-60 absolute bottom-2 left-6">T&Cs apply</p>
            </div>
            <div className="w-1/2 relative">
                <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" />
                {/* Visual gradient overlay to blend into the color side */}
                <div className={`absolute inset-y-0 left-0 w-8 ${color} blur-md -ml-4`} />
            </div>
        </Card>
    );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-red-500' : 'text-muted-foreground hover:text-[#1B2B33]'}`}
        >
            <div className="relative">
                {icon}
                {active && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-1 bg-red-500 rounded-full" />}
            </div>
            <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
        </button>
    );
}
