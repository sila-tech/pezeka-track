'use client';
import { useUser, useCollection, useFirestore, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { 
  PlusCircle, 
  Loader2, 
  Wallet, 
  Search, 
  Bell, 
  User, 
  SendHorizontal, 
  Banknote, 
  Landmark, 
  Briefcase, 
  Folder,
  Home,
  Plus,
  CreditCard,
  History
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
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
  const { toast } = useToast();
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  const { data: customerProfile } = useDoc<Customer>(user ? `customers/${user.uid}` : null);

  const customerLoansQuery = useMemo(() => {
    if (userLoading || !firestore || !user?.uid) return null;
    return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [firestore, user?.uid, userLoading]);

  const { data: customerLoans, loading: loansLoading } = useCollection<Loan>(customerLoansQuery);

  const firstName = useMemo(() => {
      const fullName = customerProfile?.name || user?.displayName;
      if (fullName) return fullName.split(' ')[0];
      return "User";
  }, [customerProfile, user]);

  const initials = firstName.charAt(0).toUpperCase();

  const applications = useMemo(() => 
    customerLoans?.filter(l => l.status === 'application') || [], 
  [customerLoans]);

  const activeLoans = useMemo(() => 
    customerLoans?.filter(l => l.status !== 'application' && l.status !== 'paid' && l.status !== 'rejected') || [], 
  [customerLoans]);

  const totalBalance = useMemo(() => {
      return activeLoans.reduce((acc, loan) => acc + (loan.totalRepayableAmount - loan.totalPaid), 0);
  }, [activeLoans]);

  return (
    <div className="min-h-screen bg-[#1B2B33] text-white pb-24 font-sans">
      {/* Header */}
      <header className="px-6 pt-10 pb-4 flex items-center justify-between sticky top-0 bg-[#1B2B33]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#5BA9D0] flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-[#5BA9D0]/20">
                {initials}
            </div>
            <div className="flex items-center gap-1">
                <span className="text-lg font-medium text-white/90">Hello</span>
                <span className="text-lg">👋</span>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <Search className="h-6 w-6 text-white/60" />
            <div className="relative">
                <Bell className="h-6 w-6 text-[#5BA9D0]" />
                <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-[#1B2B33]" />
            </div>
        </div>
      </header>

      <main className="p-6 space-y-8 max-w-lg mx-auto">
        {/* Balance Card */}
        <div className="relative">
            <div className="bg-gradient-to-br from-[#5BA9D0] to-[#4A98C0] rounded-[2rem] p-8 shadow-2xl relative overflow-hidden h-56 flex flex-col justify-between">
                <div>
                    <p className="text-white/80 text-sm font-medium">Total Balance</p>
                    <h2 className="text-4xl font-black mt-1">KES {totalBalance.toLocaleString()}</h2>
                </div>
                
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Account Holder</p>
                        <p className="text-sm font-bold uppercase">{customerProfile?.name || firstName}</p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Credit Limit</p>
                        <p className="text-sm font-bold">KES 0</p>
                    </div>
                </div>

                {/* Card Icon Overlay */}
                <div className="absolute top-8 right-8 opacity-20">
                    <CreditCard className="h-12 w-12" />
                </div>
            </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-5 gap-2 px-2">
            <ActionIcon icon={<SendHorizontal className="h-6 w-6" />} label="Send" />
            <ActionIcon icon={<Banknote className="h-6 w-6" />} label="Pay" onClick={() => setShowPaymentInstructions(true)} />
            <ActionIcon icon={<Landmark className="h-6 w-6" />} label="Loans" active />
            <ActionIcon icon={<Briefcase className="h-6 w-6" />} label="Biz" />
            <ActionIcon icon={<Folder className="h-6 w-6" />} label="Invest" />
        </div>

        {/* Loan Applications Section */}
        <section className="space-y-4">
            <h3 className="text-lg font-bold tracking-tight px-1">Loan Applications</h3>
            {loansLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-[#5BA9D0]" /></div>
            ) : applications.length > 0 ? (
                <div className="space-y-3">
                    {applications.map(loan => (
                        <div key={loan.id} className="bg-white/5 rounded-2xl p-5 flex items-center justify-between border border-white/5">
                            <div className="space-y-1">
                                <p className="font-bold text-white text-base">{loan.loanType || 'Quick Pesa'}</p>
                                <p className="text-xs text-white/40 font-medium">Amount: KES {loan.principalAmount.toLocaleString()}</p>
                            </div>
                            <Badge className="bg-[#FFECC7] text-[#855D10] border-none font-black text-[10px] px-3 py-1 rounded-lg uppercase tracking-wider">
                                PENDING
                            </Badge>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white/5 rounded-2xl p-8 text-center border border-dashed border-white/10">
                    <p className="text-xs text-white/40 font-medium">No pending applications.</p>
                </div>
            )}
        </section>

        {/* Active Loans Section */}
        <section className="space-y-4">
            <h3 className="text-lg font-bold tracking-tight px-1">Active Loans</h3>
            {loansLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-[#5BA9D0]" /></div>
            ) : activeLoans.length > 0 ? (
                <div className="space-y-3">
                    {activeLoans.map(loan => {
                        const balance = loan.totalRepayableAmount - loan.totalPaid;
                        return (
                            <div key={loan.id} className="bg-white/5 rounded-2xl p-5 flex items-center justify-between border border-white/5">
                                <div className="space-y-1">
                                    <p className="font-bold text-white text-base">Loan #{loan.loanNumber}</p>
                                    <p className="text-xs text-white/40 font-medium">Bal: KES {balance.toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge className="bg-[#27AE60]/20 text-[#27AE60] border-none font-black text-[9px] uppercase">
                                        ACTIVE
                                    </Badge>
                                    <Button variant="ghost" size="sm" onClick={() => setShowPaymentInstructions(true)} className="h-8 text-[#5BA9D0] font-black text-xs px-0 hover:bg-transparent">
                                        PAY NOW
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="bg-white/5 rounded-2xl p-8 text-center border border-dashed border-white/10">
                    <p className="text-xs text-white/40 font-medium">No active loans found.</p>
                </div>
            )}
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#1B2B33] border-t border-white/5 px-10 flex items-center justify-between z-50">
          <NavItem icon={<Home className="h-6 w-6" />} label="Home" active={activeTab === 'Home'} onClick={() => setActiveTab('Home')} />
          <NavItem icon={<Plus className="h-6 w-6" />} label="Apply" active={activeTab === 'Apply'} onClick={() => router.push('/account/apply')} />
          <NavItem icon={<User className="h-6 w-6" />} label="Profile" active={activeTab === 'Profile'} onClick={() => setActiveTab('Profile')} />
      </nav>

      {/* Payment Instructions Dialog */}
      <Dialog open={showPaymentInstructions} onOpenChange={setShowPaymentInstructions}>
          <DialogContent className="bg-[#1B2B33] border-white/10 text-white sm:max-w-md rounded-[2rem] p-8">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black">How to Pay</DialogTitle>
                  <DialogDescription className="text-white/60">Use M-Pesa to settle your balance.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4 text-sm font-medium">
                  <div className="bg-[#5BA9D0]/10 border border-[#5BA9D0]/20 rounded-2xl p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/5 pb-3">
                          <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Paybill</span>
                          <span className="text-xl font-black text-[#5BA9D0]">522522</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-3">
                          <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Account</span>
                          <span className="text-xl font-black text-[#5BA9D0]">1347823360</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                          <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Reference</span>
                          <span className="text-sm font-bold bg-[#1B2B33] px-3 py-1 rounded-lg">ID Number</span>
                      </div>
                  </div>
                  <div className="text-xs text-white/40 space-y-2 bg-[#1B2B33] p-4 rounded-xl border border-white/5 leading-relaxed font-medium">
                      <p>1. Go to M-Pesa &gt; Lipa na M-Pesa</p>
                      <p>2. Select Pay Bill & enter Business No.</p>
                      <p>3. Enter Account No. (see above)</p>
                      <p>4. Enter amount and M-Pesa PIN</p>
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={() => setShowPaymentInstructions(false)} className="w-full h-12 rounded-xl font-black bg-[#5BA9D0] hover:bg-[#4A98C0] text-white border-none shadow-lg shadow-[#5BA9D0]/20">I Have Paid</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionIcon({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button 
            onClick={onClick}
            className="flex flex-col items-center gap-3 outline-none group"
        >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${active ? 'bg-[#5BA9D0] text-white' : 'bg-white/5 text-[#5BA9D0] group-hover:bg-white/10'}`}>
                {icon}
            </div>
            <span className={`text-xs font-bold tracking-tight ${active ? 'text-white' : 'text-white/40'}`}>{label}</span>
        </button>
    );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-center gap-1.5 transition-all outline-none ${active ? 'text-[#5BA9D0]' : 'text-white/30 hover:text-white/60'}`}
        >
            <div className={`p-2 rounded-xl transition-all ${active ? 'bg-[#5BA9D0]/10' : 'bg-transparent'}`}>
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );
}
