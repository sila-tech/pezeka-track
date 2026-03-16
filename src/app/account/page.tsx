'use client';
import { useUser, useCollection, useFirestore, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { 
  PlusCircle, 
  Loader2, 
  Search, 
  Bell, 
  SendHorizontal, 
  Banknote, 
  Landmark, 
  Briefcase, 
  Folder,
  Home,
  Plus,
  CreditCard,
  ChevronRight,
  User,
  LayoutGrid,
  Wallet,
  ArrowRightLeft,
  BadgeCent
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

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
}

export default function AccountPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');

  const { data: customerProfile } = useDoc<Customer>(user ? `customers/${user.uid}` : null);

  const customerLoansQuery = useMemo(() => {
    if (userLoading || !firestore || !user?.uid) return null;
    return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [firestore, user?.uid, userLoading]);

  const { data: customerLoans, loading: loansLoading } = useCollection<Loan>(customerLoansQuery);

  const fullName = useMemo(() => {
      return customerProfile?.name || user?.displayName || "Valued Customer";
  }, [customerProfile, user]);

  const activeLoans = useMemo(() => 
    customerLoans?.filter(l => l.status !== 'application' && l.status !== 'paid' && l.status !== 'rejected') || [], 
  [customerLoans]);

  const totalBalance = useMemo(() => {
      return activeLoans.reduce((acc, loan) => acc + (loan.totalRepayableAmount - loan.totalPaid), 0);
  }, [activeLoans]);

  return (
    <div className="min-h-screen bg-[#0A1128] text-white pb-24 font-sans selection:bg-[#5BA9D0]/30">
      {/* Dynamic Gradient Top Section */}
      <div className="bg-gradient-to-b from-[#005C97] via-[#0A1128] to-[#0A1128] px-6 pt-12 pb-8">
        <div className="flex justify-between items-start mb-8">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold text-white leading-tight">Hi {fullName},</h1>
                <p className="text-[#8FBED1] text-sm font-medium">You're currently viewing:</p>
            </div>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10">
                    <Search className="h-5 w-5" />
                </div>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10">
                    <Bell className="h-5 w-5" />
                </div>
            </div>
        </div>

        {/* Main Status Card */}
        <div className="bg-[#16213E]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4CD964] to-[#27AE60] flex items-center justify-center shadow-lg shadow-green-500/20">
                    <Wallet className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                    <p className="text-[#8FBED1] text-xs font-bold uppercase tracking-widest mb-1">Total Loan Balance</p>
                    <h2 className="text-3xl font-black text-white">KES {totalBalance.toLocaleString()}</h2>
                </div>
            </div>
            <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-tighter text-[#8FBED1]">
                <span>Swipe down to refresh</span>
                <span className="text-white">Active Account</span>
            </div>
        </div>
      </div>

      <main className="px-6 space-y-10">
        {/* Action Grid Section */}
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">What would you like to do today:</h3>
                <Button variant="ghost" className="text-[#5BA9D0] bg-[#16213E] rounded-full px-4 h-8 text-xs font-bold hover:bg-[#16213E]/80">
                    Expand
                </Button>
            </div>
            <div className="grid grid-cols-4 gap-4">
                <DarkActionIcon icon={<SendHorizontal className="h-6 w-6" />} label="Send Money" />
                <DarkActionIcon icon={<Landmark className="h-6 w-6" />} label="Bank Transfer" />
                <DarkActionIcon icon={<SmartphoneIcon />} label="Mobile to Pesa" onClick={() => setShowPaymentInstructions(true)} />
                <DarkActionIcon icon={<BadgeCent className="h-6 w-6" />} label="Grow Balance" />
            </div>
        </section>

        {/* Loan Products Highlights */}
        <section className="space-y-6">
            <h3 className="text-lg font-bold text-white">Apply for Unsecured Loan</h3>
            <div className="grid grid-cols-2 gap-4">
                {/* Short Term Loan Card */}
                <button onClick={() => router.push('/account/apply')} className="bg-[#FFD700] p-5 rounded-[2rem] text-left relative overflow-hidden group transition-transform active:scale-95 flex flex-col justify-between h-40">
                    <div className="relative z-10">
                        <p className="text-[#1B2B33] font-black text-base">Short Term Loan</p>
                        <p className="text-[#1B2B33]/70 text-[10px] font-bold mt-1 leading-tight">Flexible loan options with quick approval</p>
                    </div>
                    <div className="flex justify-end items-center relative z-10">
                        <div className="w-8 h-8 rounded-full bg-[#1B2B33] flex items-center justify-center">
                            <ChevronRight className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    {/* Decorative Background Icon */}
                    <div className="absolute -bottom-2 -left-4 opacity-20 transform -rotate-12 group-hover:rotate-0 transition-transform">
                        <Banknote className="h-24 w-24 text-[#1B2B33]" />
                    </div>
                </button>

                {/* Long Term Loan Card */}
                <button onClick={() => router.push('/account/apply')} className="bg-[#A0E7E5] p-5 rounded-[2rem] text-left relative overflow-hidden group transition-transform active:scale-95 flex flex-col justify-between h-40">
                    <div className="relative z-10">
                        <p className="text-[#1B2B33] font-black text-base">Long Term Loan</p>
                        <p className="text-[#1B2B33]/70 text-[10px] font-bold mt-1 leading-tight">Finance big goals with loans up to KES 5M</p>
                    </div>
                    <div className="flex justify-end items-center relative z-10">
                        <div className="w-8 h-8 rounded-full bg-[#1B2B33] flex items-center justify-center">
                            <ChevronRight className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    {/* Decorative Background Icon */}
                    <div className="absolute -bottom-2 -left-4 opacity-20 transform -rotate-12 group-hover:rotate-0 transition-transform">
                        <Briefcase className="h-24 w-24 text-[#1B2B33]" />
                    </div>
                </button>
            </div>
        </section>

        {/* Discover Section */}
        <section className="space-y-6">
            <h3 className="text-lg font-bold text-white">Discover more products designed just for you</h3>
            <div className="grid grid-cols-2 gap-4 pb-10">
                <DiscoverCard 
                    title="Business Loans" 
                    subtitle="Scale your operations"
                    bg="bg-gradient-to-br from-[#FF8C00] to-[#FF4500]"
                />
                <DiscoverCard 
                    title="Protect your future" 
                    subtitle="Insurance solutions"
                    bg="bg-gradient-to-br from-[#4A90E2] to-[#357ABD]"
                />
            </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#0A1128] border-t border-white/5 px-8 flex items-center justify-between z-50">
          <NavItem icon={<LayoutGrid className="h-6 w-6" />} label="Dashboard" active={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} />
          <NavItem icon={<CreditCard className="h-6 w-6" />} label="Cards" active={activeTab === 'Cards'} onClick={() => setActiveTab('Cards')} />
          <NavItem icon={<ArrowRightLeft className="h-6 w-6" />} label="Payments" active={activeTab === 'Payments'} onClick={() => setActiveTab('Payments')} />
          <NavItem icon={<User className="h-6 w-6" />} label="Profile" active={activeTab === 'Profile'} onClick={() => setActiveTab('Profile')} />
      </nav>

      {/* Payment Instructions Dialog */}
      <Dialog open={showPaymentInstructions} onOpenChange={setShowPaymentInstructions}>
          <DialogContent className="bg-[#0A1128] border-white/10 text-white sm:max-w-md rounded-[2.5rem] p-8">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black">Repayment via M-Pesa</DialogTitle>
                  <DialogDescription className="text-[#8FBED1]">Fast settlement via Lipa na M-Pesa.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/5 pb-3">
                          <span className="text-[10px] font-black uppercase text-[#8FBED1] tracking-widest">Paybill</span>
                          <span className="text-xl font-black text-white">522522</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-3">
                          <span className="text-[10px] font-black uppercase text-[#8FBED1] tracking-widest">Account</span>
                          <span className="text-xl font-black text-white">1347823360</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                          <span className="text-[10px] font-black uppercase text-[#8FBED1] tracking-widest">Reference</span>
                          <span className="text-sm font-bold bg-white/10 px-3 py-1 rounded-lg">ID NUMBER</span>
                      </div>
                  </div>
                  <div className="text-xs text-[#8FBED1] space-y-2 font-medium bg-white/5 p-4 rounded-xl">
                      <p>1. Go to M-Pesa Menu &gt; Lipa na M-Pesa</p>
                      <p>2. Select Pay Bill and enter the Business No. above</p>
                      <p>3. Enter the Account No. and your ID Number</p>
                      <p>4. Enter the amount and your M-Pesa PIN</p>
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={() => setShowPaymentInstructions(false)} className="w-full h-14 rounded-2xl font-black bg-[#5BA9D0] hover:bg-[#4A98C0] text-white border-none shadow-lg shadow-[#5BA9D0]/20">I Have Paid</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

function DarkActionIcon({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
    return (
        <button 
            onClick={onClick}
            className="flex flex-col items-center gap-3 outline-none group"
        >
            <div className="w-16 h-16 rounded-2xl bg-[#16213E] text-white flex items-center justify-center transition-all group-hover:bg-[#1B2B33] border border-white/5 shadow-xl">
                {icon}
            </div>
            <span className="text-[10px] font-bold text-[#8FBED1] text-center leading-tight whitespace-pre-wrap">{label}</span>
        </button>
    );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-center gap-1.5 transition-all outline-none ${active ? 'text-[#00F5FF]' : 'text-white/40 hover:text-white/60'}`}
        >
            <div className={`transition-all ${active ? 'scale-110' : 'scale-100'}`}>
                {icon}
            </div>
            <span className={`text-[10px] font-bold tracking-tight uppercase ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
        </button>
    );
}

function DiscoverCard({ title, subtitle, bg }: { title: string, subtitle: string, bg: string }) {
    return (
        <div className={`${bg} rounded-[2rem] p-5 h-32 flex flex-col justify-end shadow-xl relative overflow-hidden group`}>
            <div className="relative z-10">
                <p className="text-white font-black text-sm">{title}</p>
                <p className="text-white/80 text-[10px] font-medium">{subtitle}</p>
            </div>
            <div className="absolute top-2 right-2 opacity-20 transform scale-150 group-hover:scale-125 transition-transform">
                <PlusCircle className="h-12 w-12 text-white" />
            </div>
        </div>
    )
}

function SmartphoneIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
            <path d="M12 18h.01"/>
        </svg>
    )
}
