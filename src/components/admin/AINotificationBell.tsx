'use client';

import { useState, useMemo } from 'react';
import { useAppUser } from '@/firebase';
import { useAdminLoans } from '@/context/AdminDataContext';
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
import { differenceInDays, differenceInMonths, startOfToday, addDays, addWeeks, addMonths, format } from 'date-fns';
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
  const { loans, loansLoading } = useAdminLoans();
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

        return { ...loan, arrearsCount, arrearsBalance, remainingBalance };
    });
  }, [loans]);

  const fetchAIAdvice = async () => {
    if (!user) return;
    setIsUpdating(true);
    
    // Sanitize data for Server Action — pass ALL notes with full ISO datetimes
    // so the AI can reason about broken time-relative promises (e.g. "will pay this evening")
    const plainLoans = activeLoans.slice(0, 15).map(l => ({
        customerName: l.customerName || 'Valued Member',
        loanNumber: l.loanNumber || 'N/A',
        status: l.status || 'active',
        arrearsBalance: Number(l.arrearsBalance) || 0,
        remainingBalance: Number(l.remainingBalance) || 0,
        followUpNotes: (l.followUpNotes || []).map((n: any) => ({
            content: String(n.content || ''),
            staffName: String(n.staffName || 'Staff'),
            // Send full ISO datetime (not just seconds object) so AI knows WHEN each note was written
            date: n.date?.seconds
                ? { seconds: n.date.seconds, nanoseconds: n.date.nanoseconds ?? 0 }
                : null,
        })),
    }));

    try {
        const u = user!;
        const role = u.role === 'finance' ? 'finance' : 'staff';
        const name = u.name || u.email?.split('@')[0] || 'Admin';
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
        </div>
 
        <ScrollArea className="h-[300px] bg-white">
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
                <div className="relative">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#5BA9D0] to-[#1B2B33] flex items-center justify-center shadow-lg shadow-blue-500/10">
                        <Bot className="h-8 w-8 text-white animate-pulse" />
                    </div>
                    <Badge className="absolute -top-2 -right-2 bg-amber-400 text-[8px] font-black text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider border-2 border-white shadow-md">Soon</Badge>
                </div>
                <div className="space-y-2">
                    <h5 className="text-lg font-black text-[#1B2B33]">Neural Insights</h5>
                    <p className="text-xs text-muted-foreground font-medium max-w-[200px] mx-auto">
                        Our AI advisor is currently undergoing advanced training to better support your credit team.
                    </p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 w-full">
                    <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-0.5">Status</p>
                    <p className="text-[11px] font-bold text-[#1B2B33]">Module optimization in progress... ⚙️</p>
                </div>
            </div>
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