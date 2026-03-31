'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection } from '@/firebase';
import { Bot, Sparkles, AlertCircle, Clock, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getStaffAIAdvice } from '@/app/actions/ai-actions';
import { differenceInDays, startOfToday, addDays, addWeeks, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';

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
  const { data: loans, loading: loansLoading } = useCollection<Loan>('loans');
  const [aiAlerts, setAiAlerts] = useState<any[]>([]);
  const [isAnalyzing, setIsUpdating] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);

  const dueLoans = useMemo(() => {
    if (!loans) return [];
    const today = startOfToday();
    
    return loans.filter(l => 
        l.status !== 'paid' && 
        l.status !== 'application' && 
        l.status !== 'rejected' &&
        l.status !== 'rollover'
    ).map(loan => {
        let baseDate: Date;
        if (loan.firstPaymentDate?.seconds) baseDate = new Date(loan.firstPaymentDate.seconds * 1000);
        else if (loan.disbursementDate?.seconds) baseDate = new Date(loan.disbursementDate.seconds * 1000);
        else baseDate = new Date();

        const instalmentAmt = loan.instalmentAmount || 1;
        const totalPaid = loan.totalPaid || 0;
        const actualInstalmentsPaid = totalPaid / instalmentAmt;

        let cyclesPassed = 0;
        if (loan.paymentFrequency === 'daily') cyclesPassed = differenceInDays(today, baseDate);
        else if (loan.paymentFrequency === 'weekly') cyclesPassed = Math.floor(differenceInDays(today, baseDate) / 7);
        else if (loan.paymentFrequency === 'monthly') {
            cyclesPassed = (today.getFullYear() - baseDate.getFullYear()) * 12 + (today.getMonth() - baseDate.getMonth());
        }

        const expectedByNow = cyclesPassed < 0 ? 0 : cyclesPassed + 1;
        const arrearsCount = Math.max(0, expectedByNow - actualInstalmentsPaid);
        const remainingBalance = Math.max(0, (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0));
        const arrearsBalance = Math.min(arrearsCount * instalmentAmt, remainingBalance);

        return { ...loan, arrearsCount, arrearsBalance };
    }).filter(l => l.arrearsCount > 0 || (l.followUpNotes && l.followUpNotes.length > 0));
  }, [loans]);

  const fetchAIAdvice = async () => {
    if (dueLoans.length === 0) return;
    setIsUpdating(true);
    const result = await getStaffAIAdvice(dueLoans.slice(0, 10)); // Analyze top 10 relevant loans
    if (result.success) {
        setAiAlerts(result.alerts);
        setLastAnalysis(new Date());
    }
    setIsUpdating(false);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group" onClick={() => !lastAnalysis && fetchAIAdvice()}>
          <Bot className={cn("h-5 w-5 transition-colors", aiAlerts.length > 0 ? "text-[#5BA9D0]" : "text-muted-foreground")} />
          {aiAlerts.length > 0 && (
            <Badge
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[8px] bg-[#5BA9D0]"
            >
              {aiAlerts.length}
            </Badge>
          )}
          <Sparkles className="absolute -top-1 -left-1 h-3 w-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 overflow-hidden rounded-2xl border-none shadow-2xl" align="end">
        <div className="bg-[#1B2B33] p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="bg-[#5BA9D0]/20 p-1.5 rounded-lg">
                    <Bot className="h-4 w-4 text-[#5BA9D0]" />
                </div>
                <h4 className="text-sm font-bold tracking-tight">Pezeka AI Assistant</h4>
            </div>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10" 
                onClick={(e) => { e.stopPropagation(); fetchAIAdvice(); }}
                disabled={isAnalyzing}
            >
                {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-[10px] text-white/40 mt-1 uppercase font-black tracking-widest">Actionable Insights</p>
        </div>

        <ScrollArea className="h-[350px] bg-white">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                <div className="relative">
                    <Bot className="h-10 w-10 text-[#5BA9D0] animate-bounce" />
                    <Sparkles className="absolute -top-2 -right-2 h-4 w-4 text-amber-400 animate-pulse" />
                </div>
                <div>
                    <p className="text-sm font-bold text-[#1B2B33]">Analyzing Promises...</p>
                    <p className="text-xs text-muted-foreground mt-1">Checking follow-up notes and payment schedules.</p>
                </div>
            </div>
          ) : aiAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-xs font-medium">No urgent AI alerts at this time.</p>
              <p className="text-[10px] mt-1 italic">Click refresh to scan recent notes.</p>
            </div>
          ) : (
            <div className="divide-y divide-muted">
              {aiAlerts.map((alert, i) => (
                <div key={i} className="p-4 hover:bg-muted/30 transition-colors group">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                        "mt-0.5 rounded-full p-1.5",
                        alert.urgency === 'high' ? "bg-red-100 text-red-600" : 
                        alert.urgency === 'medium' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                    )}>
                        <AlertCircle className="h-3 w-3" />
                    </div>
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Loan {alert.loanNumber}</span>
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
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-3 bg-muted/30 border-t flex items-center justify-between">
            <span className="text-[9px] font-bold text-muted-foreground italic">
                {lastAnalysis ? `Last updated: ${lastAnalysis.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not yet analyzed'}
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] font-black uppercase tracking-widest text-[#5BA9D0] hover:bg-[#5BA9D0]/10">
                View Loan Book <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
