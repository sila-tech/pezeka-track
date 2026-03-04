'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { addDays, format } from 'date-fns';

export default function LoanCalculator() {
  const [amount, setAmount] = useState<number>(5000);
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const results = useMemo(() => {
    const principal = Number(amount) || 0;
    const appraisalFee = principal * 0.10;
    const interest = principal * 0.10;
    const totalRepayable = principal + interest;
    const amountReceived = principal - appraisalFee;
    
    let dueDate = '-';
    if (date) {
      try {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          dueDate = format(addDays(d, 30), 'PPP');
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
      effectiveRate: principal > 0 ? ((appraisalFee + interest) / principal) * 100 : 0
    };
  }, [amount, date]);

  return (
    <section id="calculator" className="w-full py-12 md:py-24 bg-white">
      <div className="container px-4 md:px-6">
        <div className="grid gap-0 lg:grid-cols-2 items-stretch bg-white rounded-3xl overflow-hidden shadow-2xl border border-primary/10">
          {/* Left Side: Inputs */}
          <div className="p-8 md:p-12 space-y-6 flex flex-col justify-center border-r border-muted">
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold tracking-tighter text-primary">
                Pezeka Loan Calculator <br/>Kenya 2025
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Calculate your 30-day Pezeka loan (10% interest + 10% appraisal fee) and 
                instantly see your repayment schedule. Enter your loan amount and date then tap "Calculate".
              </p>
            </div>
            
            <div className="text-sm text-muted-foreground bg-primary/5 p-4 rounded-lg border border-primary/10">
                <span className="font-bold text-primary">Pezeka Policy:</span> 30-day term. 10% interest rate. 10% appraisal fee (deducted from disbursement).
            </div>

            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="loan-amount" className="text-sm font-bold uppercase text-primary tracking-wide">Loan amount (KSH)</Label>
                <Input
                  id="loan-amount"
                  type="number"
                  placeholder="e.g. 5,000"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="h-14 text-xl border-2 focus:ring-primary rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-date" className="text-sm font-bold uppercase text-primary tracking-wide">Loan date</Label>
                <Input
                  id="loan-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-14 text-xl border-2 focus:ring-primary rounded-xl"
                />
              </div>
              <Button className="w-full h-14 text-lg font-bold shadow-lg transition-all active:scale-[0.98]">
                Calculate Pezeka Loan
              </Button>
            </div>
          </div>

          {/* Right Side: Results */}
          <div className="p-8 md:p-12 space-y-8 bg-primary text-primary-foreground flex flex-col justify-center">
            <div className="text-center space-y-2">
              <h2 className="text-5xl font-black tracking-tight">Loan Results</h2>
              <p className="text-primary-foreground/80 text-xl font-medium tracking-wide uppercase">Pezeka Loan (30 Days)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ResultCard label="Amount borrowed" value={`KES ${results.principal.toLocaleString()}`} />
              <ResultCard label="Appraisal fee (10%)" value={`KES ${results.appraisalFee.toLocaleString()}`} />
              <ResultCard label="Interest (10%)" value={`KES ${results.interest.toLocaleString()}`} />
              <ResultCard label="Total repayable" value={`KES ${results.totalRepayable.toLocaleString()}`} highlight />
              <ResultCard label="Amount you receive" value={`KES ${results.amountReceived.toLocaleString()}`} />
              <ResultCard label="Due date (30 days)" value={results.dueDate} />
              <div className="col-span-1 sm:col-span-2">
                <ResultCard label="Effective fee rate (%)" value={`${results.effectiveRate.toFixed(1)}%`} />
              </div>
            </div>

            <div className="text-center space-y-6 pt-6">
                <p className="text-xs text-primary-foreground/70 font-medium">
                    Total fees = appraisal fee + interest. Effective fee rate = total fees ÷ amount borrowed.
                </p>
                <Button variant="secondary" className="w-full h-16 rounded-full font-extrabold text-xl shadow-xl transition-all">
                    Email Me This Loan Summary
                </Button>
                <p className="text-xs text-primary-foreground/60 opacity-80">
                    We'll send a simple summary of your loan calculation to your email address.
                </p>
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
