'use client';

import { useState, useMemo } from 'react';
import { useCollection, useAppUser } from '@/firebase';
import { Bot, Sparkles, AlertCircle, Clock, ChevronRight, Loader2, RefreshCw, UserCheck, Users } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getStaffAIAdvice } from '@/app/actions/ai-actions';
import { differenceInDays, differenceInMonths, startOfToday, addDays, addWeeks, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Loan {
  id: string;
  loanNumber: string;
  customerName: string;
  principalAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  instalmentAmount: number;
  status: string;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  firstPaymentDate?: any;
  disbursementDate?: any;
  followUpNotes?: any[];
}

export function AINotificationBell() {
  const { user } = useAppUser();
  const { data: loans, loading: loansLoading } = useCollection<Loan>('loans');
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [isAnalyzing, setIsUpdating] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);

  const activeLoans = useMemo(() => {
    if (!loans) return [];
    const today = startOfToday();
    
    return loans.filter(l => 
        l.status !== 'paid' && 
        l.status !== 'application' && 
        l.status !== 'rejected' &&
        l.status !== 'rollover'
    ).map(loan => {
        let baseDate: Date;
        if (loan.firstPaymentDate?.seconds) {
            baseDate = new Date(loan.firstPaymentDate.seconds * 1000);
        } else {
            const dDate = loan.disbursementDate?.seconds 
                ? new Date(loan.disbursementDate.seconds * 1000) 
                : new Date();
            
            if (loan.paymentFrequency === 'daily') baseDate = addDays(dDate, 1);
            else if (loan.paymentFrequency === 'weekly') baseDate = addWeeks(dDate, 1);
            else baseDate = addMonths(dDate, 1);
        }

        const instalmentAmt = loan.instalmentAmount || 1;
        const totalPaid = loan.totalPaid || 0;
        const actualInstalmentsPaid = totalPaid / instalmentAmt;

        let cyclesPassed = 0;
        if (loan.paymentFrequency === 'daily') cyclesPassed = differenceInDays(today, baseDate);
        else if (loan.paymentFrequency === 'weekly') cyclesPassed = Math.floor(differenceInDays(today, baseDate) / 7);
        else if (loan.paymentFrequency === 'monthly') cyclesPassed = differenceInMonths(today, baseDate);

        const expectedByNow = cyclesPassed < 0 ? 0 : cyclesPassed;
        const arrearsCount = Math.max(0, expectedByNow - actualInstalmentsPaid);
        const remainingBalance = Math.max(0, (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0));
        const arrearsBalance = Math.min(arrearsCount * instalmentAmt, remainingBalance);

        return { ...loan, arrearsCount, arrearsBalance };
    });
  }, [loans]);

  const fetchAIAdvice = async () => {
    if (!user) return;
    setIsUpdating(true);
    
    // We must ensure the objects passed to the Server Action are "plain"
    // Firestore Timestamps are class instances and cause serialization errors in Next.js Server Actions.
    const plainLoans = activeLoans.slice(0, 15).map(l => ({
        customerName: l.customerName || 'Valued Member',
        loanNumber: l.loanNumber || 'N/A',
        status: l.status || 'active',
        arrearsBalance: Number(l.arrearsBalance) || 0,
        followUpNotes: (l.followUpNotes || []).map((n: any) => ({
            content: String(n.content || ''),
            staffName: String(n.staffName || 'Staff'),
            // Map the date to a plain object containing only primitives
            date: n.date?.seconds ? { seconds: n.date.seconds, nanoseconds: n.date.nanoseconds } : null
        }))
    }));

    try {
        const role = user.role === 'finance' ? 'finance' : 'staff';
        const name = user.name || user.email?.split('@')[0] || 'Admin';
        const result = await getStaffAIAdvice(plainLoans, { name, role });
        if (result.success) {
            setAiResponse(result);
            setLastAnalysis(new Date());
        }
    } catch (err) {
        console.error("AI Analysis Error:", err);
    } finally {
        setIsUpdating(false);
    }
  };

  const alertCount = aiResponse?.alerts?.length || 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group" onClick={() => !lastAnalysis && fetchAIAdvice()}>
          <Bot className={cn("h-5 w-5 transition-colors", alertCount > 0 ? "text-[#5BA9D0]" : "text-muted-foreground")} />
          {alertCount > 0 && (
            <Badge
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[8px] bg-[#5BA9D0]"
            >
              {alertCount}
            </Badge>
          )}
          <Sparkles className="absolute -top-1 -left-1 h-3 w-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 overflow-hidden rounded-2xl border-none shadow-2xl" align="end">
        <div className="bg-[#1B2B33] p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="bg-[#5BA9D0]/20 p-1.5 rounded-lg">
                    <Bot className="h-5 w-5 text-[#5BA9D0]" />
                </div>
                <h4 className="text-base font-black tracking-tight">Pezeka AI Advisor</h4>
            </div>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10" 
                onClick={(e) => { e.stopPropagation(); fetchAIAdvice(); }}
                disabled={isAnalyzing}
            >
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          {aiResponse?.greeting && (
              <div className="mt-4 space-y-1">
                  <p className="text-sm font-bold text-white/90">{aiResponse.greeting}</p>
                  <p className="text-xs text-white/60 italic leading-relaxed">{aiResponse.summary}</p>
              </div>
          )}
        </div>

        <ScrollArea className="h-[400px] bg-white">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
                <Bot className="h-12 w-12 text-[#5BA9D0] animate-bounce" />
                <div>
                    <p className="text-sm font-black text-[#1B2B33]">Analyzing Team Activity...</p>
                    <p className="text-xs text-muted-foreground mt-1">Reviewing follow-ups and customer responses.</p>
                </div>
            </div>
          ) : !aiResponse ? (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center text-muted-foreground">
              <Clock className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm font-medium">Click the refresh icon to start daily analysis.</p>
            </div>
          ) : (
            <div className="divide-y divide-muted">
              {user?.role === 'finance' && aiResponse.teamProgress && (
                  <div className="p-4 bg-blue-50/50">
                      <h5 className="text-[10px] font-black uppercase text-blue-600 mb-3 flex items-center gap-2">
                          <Users className="h-3 w-3" /> Team Intelligence
                      </h5>
                      <div className="space-y-2">
                          {aiResponse.teamProgress.map((prog: string, idx: number) => (
                              <p key={idx} className="text-xs text-[#1B2B33] leading-relaxed border-l-2 border-blue-200 pl-3">
                                  {prog}
                              </p>
                          ))}
                      </div>
                  </div>
              )}

              {aiResponse.alerts?.length > 0 && (
                  <div className="p-4 bg-amber-50/20">
                      <h5 className="text-[10px] font-black uppercase text-amber-600 mb-3 flex items-center gap-2">
                          <AlertCircle className="h-3 w-3" /> Priority Follow-ups
                      </h5>
                      <div className="space-y-4">
                        {aiResponse.alerts.map((alert: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 group">
                                <div className={cn(
                                    "mt-0.5 rounded-full p-1.5 shrink-0",
                                    alert.urgency === 'high' ? "bg-red-100 text-red-600" : 
                                    alert.urgency === 'medium' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                                )}>
                                    <UserCheck className="h-3 w-3" />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Loan {alert.loanNumber}</span>
                                        <Badge variant="outline" className={cn(
                                            "text-[8px] uppercase font-black px-1.5 py-0 h-4",
                                            alert.urgency === 'high' ? "border-red-200 text-red-600" : "border-muted text-muted-foreground"
                                        )}>
                                            {alert.urgency}
                                        </Badge>
                                    </div>
                                    <p className="text-sm font-black text-[#1B2B33] leading-tight">{alert.title}</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                                </div>
                            </div>
                        ))}
                      </div>
                  </div>
              )}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-4 bg-muted/30 border-t flex items-center justify-between">
            <span className="text-[9px] font-bold text-muted-foreground italic">
                {lastAnalysis ? `Analysis as of ${format(lastAnalysis, 'p')}` : 'Ready to analyze'}
            </span>
            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest text-[#5BA9D0] hover:bg-[#5BA9D0]/10" asChild>
                <Link href="/admin/loans">
                    Go to Portfolio <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
            </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
