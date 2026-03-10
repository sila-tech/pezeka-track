'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, addWeeks, addMonths, format } from 'date-fns';

export default function LoanCalculator() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState<number>(5000);
  const [period, setPeriod] = useState<number>(1);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [loanType, setLoanType] = useState<string>('Quick Pesa');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    setMounted(true);
  }, []);

  const results = useMemo(() => {
    const principal = Number(amount) || 0;
    const n = Number(period) || 0;
    
    let interest = 0;
    let appraisalFee = principal * 0.10; // Standard 10% appraisal fee
    let amountReceived = 0;
    let totalRepayable = 0;

    // Determine Monthly Rate
    let monthlyRate = 0.10; // Default 10%
    if (loanType === 'Individual & Business Loan') {
        monthlyRate = 0.05; // Business is 5%
    }

    // Pro-rate interest based on frequency and period
    let numberOfMonths = 0;
    if (frequency === 'monthly') numberOfMonths = n;
    else if (frequency === 'weekly') numberOfMonths = n / 4;
    else if (frequency === 'daily') numberOfMonths = n / 28;

    interest = principal * monthlyRate * numberOfMonths;
    
    amountReceived = principal - appraisalFee;
    totalRepayable = principal + interest;

    const instalmentAmount = n > 0 ? totalRepayable / n : 0;
    
    let dueDate = '-';
    if (date && n > 0) {
      try {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          let finalDate: Date;
          if (frequency === 'monthly') finalDate = addMonths(d, n);
          else if (frequency === 'weekly') finalDate = addWeeks(d, n);
          else finalDate = addDays(d, n);
          dueDate = format(finalDate, 'PPP');
        }
      } catch (e) {
        dueDate = '-';
      }
    }

    return {
      principal,
      appraisalFee,
      interest,
      totalRepayable,
      amountReceived,
      dueDate,
      instalmentAmount,
    };
  }, [amount, period, frequency, date, loanType]);

  const handleApply = () => {
    const pendingApplication = {
      amount: results.principal,
      period: period,
      frequency: frequency,
      loanType: loanType
    };
    sessionStorage.setItem('pendingLoanApplication', JSON.stringify(pendingApplication));
    router.push('/customer-login');
  };

  if (!mounted) {
    return (
      <section id="calculator" className="w-full py-12 md:py-24 bg-white">
        <div className="container px-4 md:px-6">
          <div className="h-[600px] w-full animate-pulse bg-muted rounded-3xl" />
        </div>
      </section>
    );
  }

  return (
    <section id="calculator" className="w-full py-12 md:py-24 bg-white">
      <div className="container px-4 md:px-6">
        <div className="grid gap-0 lg:grid-cols-2 items-stretch bg-white rounded-3xl overflow-hidden shadow-2xl border border-primary/10">
          <div className="p-8 md:p-12 space-y-6 flex flex-col justify-center border-r border-muted">
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold tracking-tighter text-primary">
                Pezeka Loan Calculator
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Estimate your repayment schedule instantly. Choose a product and enter your details.
              </p>
            </div>
            
            <div className="text-sm text-muted-foreground bg-primary/5 p-4 rounded-lg border border-primary/10 space-y-1">
                <p><span className="font-bold text-primary">Quick Pesa / Salary Advance:</span> 10% Monthly Interest, 10% Appraisal (Upfront).</p>
                <p><span className="font-bold text-primary">Logbook Loan:</span> 10% Monthly Interest, 10% Appraisal (Upfront).</p>
                <p><span className="font-bold text-primary">Business Loan:</span> 5% Monthly Interest, 10% Appraisal (Upfront).</p>
            </div>

            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                  <Label htmlFor="loan-type" className="text-sm font-bold uppercase text-primary tracking-wide">Loan Product</Label>
                  <Select value={loanType} onValueChange={setLoanType}>
                      <SelectTrigger className="h-12 text-lg border-2 rounded-xl">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="Quick Pesa">Quick Pesa (10% Interest)</SelectItem>
                          <SelectItem value="Salary Advance Loan">Salary Advance (10% Interest)</SelectItem>
                          <SelectItem value="Individual & Business Loan">Business Loan (5% Interest)</SelectItem>
                          <SelectItem value="Logbook Loan">Logbook Loan (10% Interest)</SelectItem>
                      </SelectContent>
                  </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="loan-amount" className="text-sm font-bold uppercase text-primary tracking-wide">Loan amount (KSH)</Label>
                    <Input
                    id="loan-amount"
                    type="number"
                    placeholder="e.g. 5,000"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="h-12 text-lg border-2 focus:ring-primary rounded-xl"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="loan-date" className="text-sm font-bold uppercase text-primary tracking-wide">Start date</Label>
                    <Input
                    id="loan-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-12 text-lg border-2 focus:ring-primary rounded-xl"
                    />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="frequency" className="text-sm font-bold uppercase text-primary tracking-wide">Frequency</Label>
                    <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                        <SelectTrigger className="h-12 text-lg border-2 rounded-xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="period" className="text-sm font-bold uppercase text-primary tracking-wide">Number of {frequency}s</Label>
                    <Input
                    id="period"
                    type="number"
                    min="1"
                    value={period || ''}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                    className="h-12 text-lg border-2 focus:ring-primary rounded-xl"
                    />
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-12 space-y-8 bg-primary text-primary-foreground flex flex-col justify-center">
            <div className="text-center space-y-2">
              <h2 className="text-5xl font-black tracking-tight">Loan Results</h2>
              <p className="text-primary-foreground/80 text-xl font-medium tracking-wide uppercase">Your Estimated Schedule</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ResultCard label="Amount borrowed" value={`KES ${results.principal.toLocaleString()}`} />
              <ResultCard label="Appraisal Fee (10%)" value={`KES ${results.appraisalFee.toLocaleString()}`} />
              <ResultCard label="Interest Component" value={`KES ${results.interest.toLocaleString()}`} />
              <ResultCard label="Total to Repay" value={`KES ${results.totalRepayable.toLocaleString()}`} highlight />
              <ResultCard label={`${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Instalment`} value={`KES ${results.instalmentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <ResultCard label="Final Due Date" value={results.dueDate} />
              <div className="col-span-1 sm:col-span-2">
                <ResultCard label="Take-home Amount" value={`KES ${results.amountReceived.toLocaleString()}`} />
              </div>
            </div>

            <div className="text-center space-y-6 pt-6">
                <p className="text-xs text-primary-foreground/70 font-medium">
                    Calculations are based on selected product terms. Upfront deductions applied to take-home amount.
                </p>
                <Button onClick={handleApply} variant="secondary" className="w-full h-16 rounded-full font-extrabold text-xl shadow-xl transition-all">
                    Apply for this Loan
                </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-5 rounded-2xl border-2 ${highlight ? 'bg-primary-foreground/10 border-primary-foreground/20 shadow-inner' : 'bg-black/10 border-white/10'} transition-all hover:scale-[1.02]`}>
      <p className="text-[11px] uppercase font-black text-primary-foreground/60 mb-2 tracking-widest">{label}</p>
      <p className="text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}
