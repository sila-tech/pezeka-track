'use client';

import { useUser, useFirestore, useDoc, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp,
  ChevronLeft,
  Loader2,
  Users,
  Zap,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowDownCircle,
  Sparkles,
  Plus,
  User,
  Home,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  requestDeposit, 
  requestWithdrawal, 
  ensureInvestorProfile, 
  submitInvestmentApplication 
} from '@/lib/firestore';

const INVEST_TC = `Terms and Conditions — Pezeka Investment Portfolio

1. Investment starts accruing interest upon Finance team verification and approval.
2. Returns are calculated at 30% per annum, compounded daily on the approved balance.
3. Minimum investment is Ksh 500. Additional top-ups must also meet this minimum.
4. Withdrawal requests are subject to a processing period of up to 5 business days.
5. Pezeka Credit is not a bank. Investments are not covered by the Deposit Protection Fund.
6. This product is not guaranteed capital protection. Returns are subject to business performance.
7. By proceeding, you confirm you have read and understood these terms.`;

type InvestStep = 'info' | 'tc' | 'apply' | 'calculator' | 'deposit' | 'deposit_confirm' | 'withdraw';

export default function InvestPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [investStep, setInvestStep] = useState<InvestStep>('info');
  const [tcAgreed, setTcAgreed] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmittingInvest, setIsSubmittingInvest] = useState(false);
  const [investType, setInvestType] = useState<'Individual' | 'Group' | 'Chama'>('Individual');
  const [calcPrincipal, setCalcPrincipal] = useState('5000');
  const [calcMonths, setCalcMonths] = useState(12);

  const { data: customerProfile, loading: profileLoading } = useDoc<any>(user ? `customers/${user.uid}` : null);
  const { data: investorProfile, loading: investorLoading } = useDoc<any>(user ? `investors/${user.uid}` : null);
  const { data: investmentApplication } = useDoc<any>(user ? `investmentApplications/${user.uid}` : null);

  const fullName = useMemo(() => {
    const profileName = customerProfile?.name;
    const authName = user?.displayName;
    const isPlaceholder = (n: string | null | undefined) => 
        !n || n.toLowerCase().includes('pezeka') || n.toLowerCase().includes('valued member');
    if (profileName && !isPlaceholder(profileName)) return profileName;
    if (authName && !isPlaceholder(authName)) return authName;
    return "Member";
  }, [customerProfile, user]);

  const handleApplyInvestment = async () => {
    if (!user || !firestore) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 500) {
      toast({ variant: 'destructive', title: 'Minimum 500 Ksh required' });
      return;
    }

    setIsSubmittingInvest(true);
    try {
      await submitInvestmentApplication(firestore, {
        uid: user.uid,
        name: fullName,
        email: user.email || customerProfile?.email || '',
        phone: customerProfile?.phone || user.phoneNumber || '',
        type: investType,
        amount: amount
      });
      toast({ title: 'Application Submitted!', description: 'Your investment application has been sent for review.' });
      setInvestStep('info');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmittingInvest(false);
    }
  };

  const handleDepositNotify = async () => {
    if (!user || !firestore) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 500) {
      toast({ variant: 'destructive', title: 'Minimum 500 Ksh required' });
      return;
    }
    setIsSubmittingInvest(true);
    try {
      await ensureInvestorProfile(
        firestore,
        user.uid,
        fullName,
        user.email || customerProfile?.email || ''
      );
      await requestDeposit(firestore, user.uid, amount);
      toast({ title: 'Deposit Noted!', description: 'Finance will verify and approve. Interest starts upon approval.' });
      setInvestStep('deposit_confirm');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmittingInvest(false);
    }
  };

  const handleWithdrawRequest = async () => {
    if (!user || !firestore) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Enter a valid amount' });
      return;
    }
    if (amount > (investorProfile?.currentBalance || 0)) {
      toast({ variant: 'destructive', title: 'Insufficient balance' });
      return;
    }
    setIsSubmittingInvest(true);
    try {
      await requestWithdrawal(firestore, user.uid, amount);
      toast({ title: 'Withdrawal Requested', description: 'Your request will be processed within 5 business days.' });
      setWithdrawAmount('');
      setInvestStep('info');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSubmittingInvest(false);
    }
  };

  if (userLoading || profileLoading || investorLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 text-[#0078D4] animate-spin" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading Portfolio...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] text-[#1B2B33] font-sans flex flex-col relative overflow-x-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#0078D4]/5 rounded-full blur-[120px] -mr-48 -mt-48 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/5 rounded-full blur-[120px] -ml-48 -mb-48 pointer-events-none" />

      <header className="px-6 pt-12 pb-6 flex items-center gap-4 bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">
        <button 
            onClick={() => router.push('/account')}
            className="w-10 h-10 rounded-full bg-[#1B2B33]/5 flex items-center justify-center hover:bg-[#1B2B33]/10 transition-colors"
        >
            <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
            <h1 className="text-xl font-black text-[#1B2B33]">Pezeka Invest</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Wealth Management Dashboard</p>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 pb-24">
        <div className="max-w-md mx-auto space-y-6">
          
          {/* STEP: INFO / MAIN DASHBOARD */}
          {investStep === 'info' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <div className="bg-gradient-to-br from-[#1B2B33] to-[#0d4a5e] rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group border border-white/5">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>
                <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-3xl bg-green-400/20 border border-green-400/30 flex items-center justify-center shadow-inner">
                    <TrendingUp className="h-10 w-10 text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight">Wealth Growth</h2>
                    <p className="text-white/60 text-sm mt-2 max-w-[200px] mx-auto leading-relaxed">Earn 2.5% monthly compounding interest on your capital.</p>
                  </div>
                </div>
              </div>

              {investorProfile ? (
                <div className="bg-white rounded-[2.5rem] p-8 border shadow-xl shadow-blue-900/5 space-y-8">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Portfolio Status</span>
                    <Badge className="bg-green-100 text-green-700 border-none uppercase text-[8px] font-black px-3 py-1 rounded-full">Active</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Current Balance</p>
                      <p className="text-5xl font-black text-[#1B2B33] tabular-nums">KES {(investorProfile.currentBalance || 0).toLocaleString()}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-muted/50">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Total Invested</p>
                        <p className="text-xl font-black text-[#0078D4]">KES {(investorProfile.totalInvestment || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Monthly Gain</p>
                        <p className="text-xl font-black text-green-600">+2.5%</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 flex gap-4">
                    <Button className="flex-1 h-16 rounded-[1.5rem] bg-[#0078D4] hover:bg-[#006bbd] text-white font-black shadow-lg shadow-blue-500/20" onClick={() => setInvestStep('deposit')}>
                      <Plus className="h-5 w-5 mr-2" /> Top Up
                    </Button>
                    <Button variant="outline" className="flex-1 h-16 rounded-[1.5rem] font-black border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => setInvestStep('withdraw')}>
                      <ArrowDownCircle className="h-5 w-5 mr-2" /> Withdraw
                    </Button>
                  </div>
                </div>
              ) : investmentApplication?.status === 'pending' ? (
                <div className="bg-amber-50 border border-amber-100 rounded-[2.5rem] p-10 text-center space-y-6">
                  <div className="w-16 h-16 bg-amber-100/50 rounded-[1.5rem] flex items-center justify-center mx-auto border border-amber-200">
                    <Clock className="h-8 w-8 text-amber-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-amber-900">Application Under Review</h3>
                    <p className="text-sm text-amber-700 leading-relaxed font-medium">
                      Our finance team is reviewing your **{investmentApplication.investmentType}** investment request for **KES {investmentApplication.amount?.toLocaleString()}**. We&apos;ll notify you once it&apos;s approved.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white rounded-[2.5rem] p-8 border shadow-xl shadow-blue-900/5 space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-amber-100/50 border border-amber-200 flex items-center justify-center">
                        <Zap className="h-7 w-7 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-black text-xl">High-Yield Returns</p>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">30% Annual Growth</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                      Start your journey with Pezeka Investments. Earn **2.5% monthly interest** on your balance, compounded daily. Your money works for you while you focus on what matters.
                    </p>
                    <div className="space-y-3">
                      <Button variant="outline" className="w-full h-16 rounded-2xl border-[#0078D4] text-[#0078D4] font-black uppercase text-xs tracking-widest hover:bg-blue-50" onClick={() => setInvestStep('calculator')}>
                        <Sparkles className="h-4 w-4 mr-2" /> Interest Calculator
                      </Button>
                      <Button className="w-full h-16 rounded-2xl bg-[#1B2B33] hover:bg-[#0d2a33] text-white font-black text-lg shadow-xl shadow-blue-500/10" onClick={() => setInvestStep('tc')}>
                        Get Started Now
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP: CALCULATOR */}
          {investStep === 'calculator' && (
            <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
              <div className="bg-[#1B2B33] rounded-[2.5rem] p-8 text-white relative overflow-hidden border border-white/5">
                <button onClick={() => setInvestStep('info')} className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest mb-4 hover:text-white transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                </button>
                <h2 className="text-3xl font-black">Returns Calculator</h2>
                <p className="text-white/50 text-xs mt-1 font-bold">Visualize your wealth growth over time</p>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border shadow-xl shadow-blue-900/5 space-y-10">
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Initial Investment (Ksh)</label>
                    <Input 
                      type="number" 
                      value={calcPrincipal} 
                      onChange={(e) => setCalcPrincipal(e.target.value)}
                      className="h-20 rounded-[1.5rem] font-black text-3xl bg-[#F8FAFB] border-none focus-visible:ring-4 focus-visible:ring-[#0078D4]/20"
                    />
                  </div>
                  <div className="space-y-6">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Growth Duration</label>
                      <span className="text-2xl font-black text-[#0078D4]">{calcMonths} Months</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="60" 
                      value={calcMonths} 
                      onChange={(e) => setCalcMonths(parseInt(e.target.value))}
                      className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-[#0078D4]"
                    />
                    <div className="flex justify-between text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                      <span>1 Month</span>
                      <span>5 Years</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1B2B33] rounded-[2rem] p-8 text-white space-y-6 shadow-2xl relative overflow-hidden border border-white/5">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.05]"><TrendingUp className="h-32 w-32" /></div>
                  <div className="flex justify-between items-center pb-4 border-b border-white/10 relative z-10">
                    <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">Interest Earned</span>
                    <span className="text-2xl font-black text-green-400 tabular-nums">
                      + KES {( (parseFloat(calcPrincipal) || 0) * Math.pow(1 + 0.025, calcMonths) - (parseFloat(calcPrincipal) || 0) ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center relative z-10">
                    <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">Maturity Value</span>
                    <span className="text-4xl font-black tabular-nums">
                      KES {( (parseFloat(calcPrincipal) || 0) * Math.pow(1 + 0.025, calcMonths) ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                <Button className="w-full h-20 rounded-full bg-[#0078D4] hover:bg-[#006bbd] text-white font-black text-xl shadow-2xl shadow-blue-500/20 transition-all active:scale-95" onClick={() => setInvestStep('tc')}>
                  Proceed to Apply
                </Button>
              </div>
            </div>
          )}

          {/* STEP: T&C */}
          {investStep === 'tc' && (
            <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
              <div className="bg-[#1B2B33] rounded-[2.5rem] p-8 text-white border border-white/5">
                <button onClick={() => setInvestStep('info')} className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <h2 className="text-3xl font-black tracking-tight">Investment Terms</h2>
                <p className="text-white/50 text-xs mt-1 font-bold">Please review the commitment</p>
              </div>
              <div className="bg-white rounded-[2.5rem] p-8 border shadow-xl shadow-blue-900/5 space-y-8">
                <ScrollArea className="h-72 border rounded-[1.5rem] p-6 bg-[#F8FAFB] shadow-inner">
                  <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed font-medium">{INVEST_TC}</pre>
                </ScrollArea>
                <label className="flex items-start gap-4 cursor-pointer p-4 rounded-3xl bg-blue-50/50 border border-blue-100/50 transition-colors hover:bg-blue-50">
                  <Checkbox checked={tcAgreed} onCheckedChange={(v) => setTcAgreed(!!v)} className="mt-1 h-5 w-5 border-2 border-[#0078D4]" />
                  <span className="text-sm font-bold text-[#1B2B33] leading-snug">I have read and I agree to the Pezeka Investment Terms and Conditions.</span>
                </label>
                <Button
                  className="w-full h-20 rounded-full bg-[#1B2B33] hover:bg-[#0d2a33] text-white font-black text-xl disabled:opacity-30 shadow-xl shadow-[#1B2B33]/20 transition-all active:scale-95"
                  disabled={!tcAgreed}
                  onClick={() => { setDepositAmount(''); setInvestStep('apply'); }}
                >
                  Agree & Continue
                </Button>
              </div>
            </div>
          )}

          {/* STEP: APPLY */}
          {investStep === 'apply' && (
            <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
              <div className="bg-[#1B2B33] rounded-[2.5rem] p-8 text-white border border-white/5">
                <button onClick={() => setInvestStep('tc')} className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <h2 className="text-3xl font-black tracking-tight">New Application</h2>
                <p className="text-white/50 text-xs mt-1 font-bold">Configure your investment profile</p>
              </div>
              <div className="bg-white rounded-[2.5rem] p-8 border shadow-xl shadow-blue-900/5 space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Investment Structure</label>
                  <div className="grid grid-cols-3 gap-4">
                    {(['Individual', 'Group', 'Chama'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setInvestType(type)}
                        className={cn(
                          "flex flex-col items-center gap-3 p-6 rounded-[1.5rem] border-2 transition-all duration-300",
                          investType === type 
                            ? "bg-blue-50 border-[#0078D4] text-[#0078D4] scale-105 shadow-xl shadow-blue-500/10" 
                            : "bg-white border-muted text-muted-foreground hover:border-muted-foreground/30"
                        )}
                      >
                        {type === 'Individual' && <User className="h-7 w-7" />}
                        {type === 'Group' && <Users className="h-7 w-7" />}
                        {type === 'Chama' && <Home className="h-7 w-7" />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Initial Target (Ksh)</label>
                  <Input
                    type="number"
                    min={500}
                    placeholder="Min 500"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="h-20 rounded-[1.5rem] text-3xl font-black bg-[#F8FAFB] border-none focus-visible:ring-4 focus-visible:ring-[#0078D4]/20"
                  />
                </div>

                <div className="bg-blue-50/50 p-6 rounded-[1.5rem] border border-blue-100 flex gap-4">
                  <AlertCircle className="h-6 w-6 text-[#0078D4] shrink-0" />
                  <p className="text-[11px] text-blue-900 leading-relaxed font-bold uppercase tracking-tight">
                    This is a non-binding application. Finance will verify your eligibility within 24 hours.
                  </p>
                </div>

                <Button
                  className="w-full h-20 rounded-full bg-[#1B2B33] hover:bg-[#0d2a33] text-white font-black text-xl shadow-2xl shadow-blue-500/20 transition-all active:scale-95"
                  onClick={handleApplyInvestment}
                  disabled={isSubmittingInvest}
                >
                  {isSubmittingInvest ? <Loader2 className="h-7 w-7 animate-spin" /> : 'Confirm Application'}
                </Button>
              </div>
            </div>
          )}

          {/* STEP: DEPOSIT */}
          {investStep === 'deposit' && (
            <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
              <div className="bg-[#1B2B33] rounded-[2.5rem] p-8 text-white border border-white/5">
                <button onClick={() => setInvestStep('info')} className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <h2 className="text-3xl font-black tracking-tight">Top Up Portfolio</h2>
                <p className="text-white/50 text-xs mt-1 font-bold">Transfer funds via M-Pesa</p>
              </div>
              <div className="bg-white rounded-[2.5rem] p-8 border shadow-xl shadow-blue-900/5 space-y-8">
                <div className="bg-[#F8FAFB] rounded-[2rem] p-8 space-y-8 border border-muted/50 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.03]"><Zap className="h-24 w-24" /></div>
                  <div className="flex justify-between items-center relative z-10">
                    <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Paybill Number</span>
                    <span className="text-4xl font-black text-[#1B2B33]">522522</span>
                  </div>
                  <div className="flex justify-between items-center relative z-10">
                    <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Account Number</span>
                    <span className="text-2xl font-black text-[#0078D4]">1347823360</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Amount Sent (Ksh)</label>
                  <Input
                    type="number"
                    min={500}
                    placeholder="Min 500"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="h-20 rounded-[1.5rem] text-3xl font-black bg-[#F8FAFB] border-none focus-visible:ring-4 focus-visible:ring-[#0078D4]/20"
                  />
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                  <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-800 uppercase leading-tight">Admin will verify the transaction against M-Pesa records.</p>
                </div>
                <Button
                  className="w-full h-20 rounded-full bg-green-600 hover:bg-green-700 text-white font-black text-xl shadow-2xl shadow-green-600/20 transition-all active:scale-95"
                  onClick={handleDepositNotify}
                  disabled={isSubmittingInvest}
                >
                  {isSubmittingInvest ? <Loader2 className="h-7 w-7 animate-spin" /> : '✅ I have sent the funds'}
                </Button>
              </div>
            </div>
          )}

          {/* STEP: WITHDRAW */}
          {investStep === 'withdraw' && (
            <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
              <div className="bg-[#1B2B33] rounded-[2.5rem] p-8 text-white border border-white/5">
                <button onClick={() => setInvestStep('info')} className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <h2 className="text-3xl font-black tracking-tight">Withdraw Funds</h2>
                <p className="text-white/50 text-xs mt-1 font-bold">Processed directly to your M-Pesa</p>
              </div>
              <div className="bg-white rounded-[2.5rem] p-8 border shadow-xl shadow-blue-900/5 space-y-8">
                <div className="bg-red-50/50 rounded-[2rem] p-8 border border-red-100 flex flex-col items-center gap-3">
                  <span className="text-[11px] font-black uppercase text-red-600 tracking-widest">Available to Withdraw</span>
                  <span className="text-5xl font-black text-red-600 tabular-nums">KES {(investorProfile?.currentBalance || 0).toLocaleString()}</span>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Withdrawal Amount (Ksh)</label>
                  <Input
                    type="number"
                    min={1}
                    max={investorProfile?.currentBalance || 0}
                    placeholder="Enter amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="h-20 rounded-[1.5rem] text-3xl font-black bg-[#F8FAFB] border-none focus-visible:ring-4 focus-visible:ring-red-500/20"
                  />
                </div>
                <div className="p-5 rounded-[1.5rem] bg-[#F8FAFB] border flex gap-4">
                  <AlertCircle className="h-6 w-6 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-muted-foreground font-black uppercase leading-tight tracking-tighter">
                    Withdrawals are processed within 5 business days. A standard M-Pesa transaction fee may apply.
                  </p>
                </div>
                <Button
                  className="w-full h-20 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-black text-xl shadow-2xl shadow-orange-600/20 transition-all active:scale-95"
                  onClick={handleWithdrawRequest}
                  disabled={isSubmittingInvest}
                >
                  {isSubmittingInvest ? <Loader2 className="h-7 w-7 animate-spin" /> : 'Request Withdrawal'}
                </Button>
              </div>
            </div>
          )}

          {/* STEP: DEPOSIT CONFIRM */}
          {investStep === 'deposit_confirm' && (
            <div className="animate-in zoom-in duration-500 bg-white rounded-[3rem] p-12 text-center space-y-10 border shadow-2xl shadow-green-900/10 max-w-sm mx-auto">
              <div className="w-28 h-28 rounded-[3rem] bg-green-100 flex items-center justify-center mx-auto border-4 border-white shadow-xl shadow-green-500/20">
                <CheckCircle2 className="h-14 w-14 text-green-600" />
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-black text-[#1B2B33]">Request Sent!</h2>
                <p className="text-muted-foreground text-sm font-bold leading-relaxed px-4 uppercase tracking-tight">
                  Our finance team has been notified. We will verify your transaction and update your balance shortly.
                </p>
              </div>
              <div className="bg-[#F8FAFB] rounded-[2rem] p-8 border text-left shadow-inner">
                <p className="text-[11px] font-black uppercase text-muted-foreground tracking-widest mb-2 opacity-60">Amount Notified</p>
                <p className="text-4xl font-black text-green-600 tabular-nums">KES {parseFloat(depositAmount || '0').toLocaleString()}</p>
              </div>
              <Button className="w-full h-20 rounded-full bg-[#1B2B33] hover:bg-[#0d2a33] text-white font-black text-xl shadow-2xl shadow-blue-500/20 transition-all active:scale-95" onClick={() => router.push('/account')}>
                Back to Dashboard
              </Button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
