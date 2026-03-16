'use client';
import { useUser, useCollection, useFirestore, useDoc, useAppUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Bell, 
  SendHorizontal, 
  Banknote, 
  Landmark, 
  Briefcase, 
  Folder,
  Home,
  Plus,
  User,
  CreditCard,
  Wallet,
  ArrowRightLeft,
  LayoutGrid
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { collection, query, where } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [activeTab, setActiveTab] = useState('Home');

  const { data: customerProfile } = useDoc<Customer>(user ? `customers/${user.uid}` : null);

  const customerLoansQuery = useMemo(() => {
    if (userLoading || !firestore || !user?.uid) return null;
    return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [firestore, user?.uid, userLoading]);

  const { data: customerLoans, loading: loansLoading } = useCollection<Loan>(customerLoansQuery);

  const fullName = useMemo(() => {
      return customerProfile?.name || user?.displayName || "Valued Customer";
  }, [customerProfile, user]);

  const initials = useMemo(() => {
      return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }, [fullName]);

  const activeLoans = useMemo(() => 
    customerLoans?.filter(l => l.status !== 'application' && l.status !== 'paid' && l.status !== 'rejected') || [], 
  [customerLoans]);

  const pendingApplications = useMemo(() => 
    customerLoans?.filter(l => l.status === 'application') || [], 
  [customerLoans]);

  const totalBalance = useMemo(() => {
      return activeLoans.reduce((acc, loan) => acc + (loan.totalRepayableAmount - loan.totalPaid), 0);
  }, [activeLoans]);

  return (
    <div className="min-h-screen bg-[#0A1128] text-white pb-24 font-sans selection:bg-[#5BA9D0]/30 flex flex-col">
      {/* Header Section */}
      <header className="px-6 pt-12 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-[#5BA9D0]">
                <AvatarFallback className="bg-[#16213E] text-[#5BA9D0] font-black">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1">
                <span className="text-lg font-bold">Hello</span>
                <span className="text-lg">👋</span>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <button className="text-white/80 hover:text-white transition-colors">
                <Search className="h-6 w-6" />
            </button>
            <div className="relative">
                <button className="text-white/80 hover:text-white transition-colors">
                    <Bell className="h-6 w-6" />
                </button>
                <div className="absolute top-0 right-0 h-2.5 w-2.5 bg-[#27AE60] rounded-full border-2 border-[#0A1128]"></div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 space-y-8 flex-1">
        {/* Balance Card - Themed Gradient */}
        <div className="relative overflow-hidden rounded-[2.5rem] p-8 min-h-[220px] bg-gradient-to-br from-[#5BA9D0] to-[#005C97] shadow-2xl shadow-[#005C97]/20 flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Total Balance</p>
                    <h2 className="text-4xl font-black text-white">KES {totalBalance.toLocaleString()}</h2>
                </div>
                <CreditCard className="h-10 w-10 text-white/40" />
            </div>
            
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Account Holder</p>
                    <p className="text-sm font-black uppercase">{fullName}</p>
                </div>
                <div className="text-right space-y-1">
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Credit Limit</p>
                    <p className="text-sm font-black">KES 0</p>
                </div>
            </div>
            
            {/* Decorative background shapes */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute top-0 left-0 w-20 h-20 bg-white/5 rounded-full blur-2xl"></div>
        </div>

        {/* Action Grid */}
        <div className="flex justify-between items-center px-2">
            <ActionCircle icon={<SendHorizontal className="h-6 w-6 text-[#5BA9D0]" />} label="Send" />
            <ActionCircle icon={<Wallet className="h-6 w-6 text-[#5BA9D0]" />} label="Pay" />
            <ActionCircle icon={<Landmark className="h-6 w-6 text-[#5BA9D0]" />} label="Loans" />
            <ActionCircle icon={<Briefcase className="h-6 w-6 text-[#5BA9D0]" />} label="Biz" />
            <ActionCircle icon={<Folder className="h-6 w-6 text-[#5BA9D0]" />} label="Invest" />
        </div>

        {/* Loan Applications Section */}
        <section className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-tight">Loan Applications</h3>
            {pendingApplications.length === 0 ? (
                <div className="bg-[#16213E]/40 border border-white/5 rounded-3xl p-8 text-center">
                    <p className="text-[#8FBED1] text-sm italic">No pending applications.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {pendingApplications.map(loan => (
                        <div key={loan.id} className="bg-[#16213E]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex items-center justify-between group transition-all hover:bg-[#1B2B33]">
                            <div className="space-y-1">
                                <p className="font-black text-base">{loan.loanType || 'Quick Pesa'}</p>
                                <p className="text-[#8FBED1] text-xs font-bold">Amount: KES {loan.principalAmount.toLocaleString()}</p>
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
            <h3 className="text-lg font-bold text-white tracking-tight">Active Loans</h3>
            {activeLoans.length === 0 ? (
                <div className="bg-[#16213E]/40 border border-white/5 rounded-3xl p-8 text-center">
                    <p className="text-[#8FBED1] text-sm italic">No active loans found.</p>
                </div>
            ) : (
                <div className="space-y-3 pb-10">
                    {activeLoans.map(loan => (
                        <div key={loan.id} className="bg-[#16213E]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex items-center justify-between group transition-all hover:bg-[#1B2B33]">
                            <div className="space-y-1">
                                <p className="font-black text-base">{loan.loanType || 'Quick Pesa'}</p>
                                <p className="text-[#8FBED1] text-xs font-bold">Balance: KES {(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}</p>
                            </div>
                            <div className="bg-[#27AE60]/20 text-[#27AE60] text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider border border-[#27AE60]/30">
                                Active
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
      </main>

      {/* Fixed Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#0A1128]/95 backdrop-blur-md border-t border-white/5 px-10 flex items-center justify-between z-50">
          <NavItem 
            icon={<Home className="h-6 w-6" />} 
            label="Home" 
            active={activeTab === 'Home'} 
            onClick={() => setActiveTab('Home')} 
          />
          <NavItem 
            icon={<Plus className="h-6 w-6" />} 
            label="Apply" 
            active={activeTab === 'Apply'} 
            onClick={() => {
                setActiveTab('Apply');
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

function ActionCircle({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <button className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-[#16213E] border border-white/5 flex items-center justify-center transition-all group-active:scale-90 group-hover:bg-[#1B2B33] shadow-lg">
                {icon}
            </div>
            <span className="text-[11px] font-bold text-[#8FBED1]">{label}</span>
        </button>
    );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-center gap-1.5 transition-all outline-none relative ${active ? 'text-[#5BA9D0]' : 'text-white/40 hover:text-white/60'}`}
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
