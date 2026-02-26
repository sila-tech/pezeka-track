'use client';

import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, getDaysInMonth, differenceInDays } from 'date-fns';

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { applyInterestToPortfolio, processWithdrawal, rejectWithdrawal, deleteInvestor, approveDeposit, rejectDeposit } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, PenSquare, Trash2, Check, X, Calculator } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface InterestEntry {
  entryId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
  description?: string;
}

interface Withdrawal {
  withdrawalId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
  status: 'pending' | 'processed' | 'rejected';
}

interface Deposit {
  depositId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
}

interface Investor {
  id: string;
  uid: string;
  name: string;
  email: string;
  totalInvestment: number;
  totalWithdrawn: number;
  currentBalance: number;
  interestRate?: number;
  createdAt: { seconds: number; nanoseconds: number };
  interestEntries?: InterestEntry[];
  withdrawals?: Withdrawal[];
  deposits?: Deposit[];
}

export function InvestorsPortfolioTab() {
  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [manageInvestorOpen, setManageInvestorOpen] = useState(false);
  const [deleteInvestorOpen, setDeleteInvestorOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [investorToDelete, setInvestorToDelete] = useState<Investor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthorized = user ? (user.email === 'simon@pezeka.com' || user.role === 'finance') : false;

  const { data: investors, loading: investorsLoading } = useCollection<Investor>(isAuthorized ? 'investors' : null);

  const isLoading = userLoading || investorsLoading;

  const handleManageClick = (investor: Investor) => {
    setSelectedInvestor(investor);
    setManageInvestorOpen(true);
  };
  
  const handleApplyInterest = async () => {
    if (!selectedInvestor || !monthlyInterest) return;
    setIsSubmitting(true);
    try {
        const description = `Monthly interest for ${format(new Date(), 'MMMM yyyy')}`;
        await applyInterestToPortfolio(firestore, selectedInvestor.id, monthlyInterest, description);
        toast({ title: 'Interest Applied', description: `Ksh ${monthlyInterest.toLocaleString()} applied to ${selectedInvestor.name}'s portfolio.`});
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not apply interest.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleProcessWithdrawal = async (withdrawalId: string) => {
    if (!selectedInvestor) return;
    setIsSubmitting(true);
    try {
      await processWithdrawal(firestore, selectedInvestor.id, withdrawalId);
      toast({ title: 'Withdrawal Processed', description: "The withdrawal has been marked as processed and the balance updated."});
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Processing Failed', description: e.message || 'Could not process withdrawal.'});
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const handleRejectWithdrawal = async (withdrawalId: string) => {
     if (!selectedInvestor) return;
    setIsSubmitting(true);
    try {
      await rejectWithdrawal(firestore, selectedInvestor.id, withdrawalId);
      toast({ title: 'Withdrawal Rejected', description: "The withdrawal request has been rejected."});
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: e.message || 'Could not reject withdrawal.'});
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleApproveDeposit = async (depositId: string) => {
    if (!selectedInvestor) return;
    setIsSubmitting(true);
    try {
        await approveDeposit(firestore, selectedInvestor.id, depositId);
        toast({ title: 'Deposit Approved', description: "The deposit has been approved and the investor's balance updated." });
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Approval Failed', description: e.message || 'Could not approve deposit.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleRejectDeposit = async (depositId: string) => {
    if (!selectedInvestor) return;
    setIsSubmitting(true);
    try {
        await rejectDeposit(firestore, selectedInvestor.id, depositId);
        toast({ title: 'Deposit Rejected', description: "The deposit notification has been rejected." });
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Action Failed', description: e.message || 'Could not reject deposit.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (investor: Investor) => {
    setInvestorToDelete(investor);
    setDeleteInvestorOpen(true);
  };
  
  async function confirmDelete() {
    if (!investorToDelete) return;
    setIsSubmitting(true);
    try {
        await deleteInvestor(firestore, investorToDelete.id);
        toast({ title: 'Portfolio Deleted', description: `The portfolio for ${investorToDelete.name} has been removed.` });
        setDeleteInvestorOpen(false);
        setInvestorToDelete(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not delete the portfolio.' });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const sortedInvestors = useMemo(() => {
      return investors ? [...investors].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)) : [];
  }, [investors]);
  
  const portfolioTotals = useMemo(() => {
    if (!sortedInvestors) return { initial: 0, balance: 0, withdrawn: 0 };
    return sortedInvestors.reduce((acc, investor) => {
        acc.initial += (investor.totalInvestment || 0);
        acc.balance += (investor.currentBalance || 0);
        acc.withdrawn += (investor.totalWithdrawn || 0);
        return acc;
    }, { initial: 0, balance: 0, withdrawn: 0 });
  }, [sortedInvestors]);

  const monthlyInterest = useMemo(() => {
    if (!selectedInvestor || !selectedInvestor.interestRate) return 0;
    
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);
    const daysInMonth = getDaysInMonth(now);
    const monthlyRate = selectedInvestor.interestRate / 100;

    // Calculate basis: Starting Balance (Balance before current month's new deposits)
    // For simplicity, we calculate interest per day for every basis shift.
    
    let totalInterest = 0;
    
    // 1. Initial basis (current balance minus this month's approved deposits)
    const approvedThisMonth = (selectedInvestor.deposits || [])
        .filter(d => d.status === 'approved')
        .filter(d => {
            const date = new Date((d.date as any).seconds * 1000);
            return date >= startOfCurrentMonth && date <= endOfCurrentMonth;
        });
    
    const initialBasis = selectedInvestor.currentBalance - approvedThisMonth.reduce((acc, d) => acc + d.amount, 0);
    
    // Interest on the initial basis for the whole month
    totalInterest += initialBasis * monthlyRate;

    // 2. Add pro-rated interest for each new deposit made this month
    approvedThisMonth.forEach(deposit => {
        const depositDate = new Date((deposit.date as any).seconds * 1000);
        const daysRemaining = differenceInDays(endOfCurrentMonth, depositDate) + 1;
        const proRatedInterest = (deposit.amount * monthlyRate) * (daysRemaining / daysInMonth);
        totalInterest += proRatedInterest;
    });

    return totalInterest;
  }, [selectedInvestor]);

  const hasInterestBeenAppliedThisMonth = useMemo(() => {
    if (!selectedInvestor?.interestEntries || selectedInvestor.interestEntries.length === 0) return false;
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);
    return selectedInvestor.interestEntries.some(entry => {
        const entryDate = new Date((entry.date as any).seconds * 1000);
        return entryDate >= startOfCurrentMonth && entryDate <= endOfCurrentMonth;
    });
  }, [selectedInvestor?.interestEntries]);

  const statementEntries = useMemo(() => {
    if (!selectedInvestor) return [];
    const allTransactions: any[] = [];
    
    if (selectedInvestor.createdAt) {
        allTransactions.push({
            date: new Date((selectedInvestor.createdAt as any).seconds * 1000),
            description: 'Investment',
            amount: selectedInvestor.totalInvestment || 0,
            type: 'credit'
        });
    }

    (selectedInvestor.deposits || []).filter(d => d.status === 'approved').forEach(d => {
        allTransactions.push({
            date: new Date((d.date as any).seconds * 1000),
            description: 'Subsequent Investment',
            amount: d.amount,
            type: 'credit'
        });
    });

    (selectedInvestor.interestEntries || []).forEach(i => {
        allTransactions.push({
            date: new Date((i.date as any).seconds * 1000),
            description: i.description || 'Monthly Interest',
            amount: i.amount,
            type: 'credit'
        });
    });

    (selectedInvestor.withdrawals || []).filter(w => w.status === 'processed').forEach(w => {
        allTransactions.push({
            date: new Date((w.date as any).seconds * 1000),
            description: 'Withdrawal',
            amount: w.amount,
            type: 'debit'
        });
    });

    allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = 0;
    return allTransactions.map(t => {
        if (t.type === 'credit') {
            balance += t.amount;
        } else {
            balance -= t.amount;
        }
        return { ...t, balance };
    }).reverse();
  }, [selectedInvestor]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Investment Portfolios</CardTitle>
            <CardDescription>Track investment portfolios, withdrawals, and accumulated interest.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : !sortedInvestors || sortedInvestors.length === 0 ? (
              <Alert>
                  <AlertTitle>No Portfolios Found</AlertTitle>
                  <AlertDescription>Go to the Investors page to add a new portfolio.</AlertDescription>
              </Alert>
          ) : (
            <ScrollArea className="h-[60vh]">
              <Table>
                  <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                          <TableHead>Portfolio Holder</TableHead>
                          <TableHead className="text-right">Investment (Ksh)</TableHead>
                          <TableHead className="text-right">Withdrawals (Ksh)</TableHead>
                          <TableHead className="text-right">Current Balance (Ksh)</TableHead>
                          <TableHead className="text-right">Total Interest (Ksh)</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {sortedInvestors.map(investor => {
                          const totalInterest = (investor.interestEntries || []).reduce((acc, i) => acc + i.amount, 0);
                          return (
                              <TableRow key={investor.id}>
                                  <TableCell className="font-medium">{investor.name}</TableCell>
                                  <TableCell className="text-right">{(investor.totalInvestment || 0).toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-destructive">{(investor.totalWithdrawn || 0).toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-bold">{(investor.currentBalance || 0).toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-green-600">{totalInterest.toLocaleString()}</TableCell>
                                  <TableCell className="text-center">
                                      <Button variant="ghost" size="sm" onClick={() => handleManageClick(investor)}>
                                          <PenSquare className="mr-2 h-4 w-4" /> Manage
                                      </Button>
                                      {isAuthorized && (
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(investor)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                  </TableCell>
                              </TableRow>
                          )
                      })}
                  </TableBody>
                   <TableRow className="font-bold bg-muted/50 sticky bottom-0">
                        <TableCell>Totals</TableCell>
                        <TableCell className="text-right">{(portfolioTotals.initial || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-destructive">{(portfolioTotals.withdrawn || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{(portfolioTotals.balance || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600">{((portfolioTotals.balance + portfolioTotals.withdrawn - portfolioTotals.initial) || 0).toLocaleString()}</TableCell>
                        <TableCell />
                    </TableRow>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={manageInvestorOpen} onOpenChange={setManageInvestorOpen}>
          <DialogContent className="sm:max-w-4xl">
              {selectedInvestor && (
                  <>
                    <DialogHeader>
                        <DialogTitle>Manage Portfolio: {selectedInvestor.name}</DialogTitle>
                        <DialogDescription>Apply pro-rated interest, approve transactions, and review history.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] pr-4">
                      <div className="space-y-6 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4"/> Monthly Interest</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2 rounded-md bg-muted p-4">
                                        <div className="flex justify-between"><span className="text-sm">Rate</span><span className="font-bold">{(selectedInvestor.interestRate || 0)}%</span></div>
                                        <div className="flex justify-between"><span className="text-sm">Basis & Pro-rating</span><span className="text-xs text-muted-foreground">Accounts for mid-month deposits</span></div>
                                        <div className="flex justify-between border-t pt-2"><span className="text-sm">Suggested Amount</span><span className="font-bold text-green-600">Ksh {monthlyInterest.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                    </div>
                                    {hasInterestBeenAppliedThisMonth ? (
                                        <Badge className="w-full justify-center h-10">Interest Already Applied This Month</Badge>
                                    ) : (
                                        <Button onClick={handleApplyInterest} disabled={isSubmitting || monthlyInterest <= 0} className="w-full">
                                            {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                                            Apply for {format(new Date(), 'MMMM')}
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="text-sm">Pending Actions</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <ScrollArea className="h-[150px]">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground">New Deposits</p>
                                            {selectedInvestor.deposits?.filter(d => d.status === 'pending').map(d => (
                                                <div key={d.depositId} className="flex items-center justify-between p-2 border rounded-md text-sm">
                                                    <span>Ksh {d.amount.toLocaleString()}</span>
                                                    <div className="flex gap-1">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleApproveDeposit(d.depositId)} disabled={isSubmitting}><Check className="h-4 w-4 text-green-600"/></Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRejectDeposit(d.depositId)} disabled={isSubmitting}><X className="h-4 w-4 text-destructive"/></Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {selectedInvestor.deposits?.filter(d => d.status === 'pending').length === 0 && <p className="text-xs text-muted-foreground italic">No pending deposits</p>}
                                            
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground mt-4">Withdrawal Requests</p>
                                            {selectedInvestor.withdrawals?.filter(w => w.status === 'pending').map(w => (
                                                <div key={w.withdrawalId} className="flex items-center justify-between p-2 border rounded-md text-sm">
                                                    <span>Ksh {w.amount.toLocaleString()}</span>
                                                    <div className="flex gap-1">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleProcessWithdrawal(w.withdrawalId)} disabled={isSubmitting}><Check className="h-4 w-4 text-green-600"/></Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRejectWithdrawal(w.withdrawalId)} disabled={isSubmitting}><X className="h-4 w-4 text-destructive"/></Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {selectedInvestor.withdrawals?.filter(w => w.status === 'pending').length === 0 && <p className="text-xs text-muted-foreground italic">No pending withdrawals</p>}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                        <Card>
                            <CardHeader><CardTitle className="text-sm">Transaction Ledger</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {statementEntries.map((e, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{format(e.date, 'dd/MM/yy')}</TableCell>
                                                <TableCell className="text-xs">{e.description}</TableCell>
                                                <TableCell className={`text-right font-medium ${e.type === 'credit' ? 'text-green-600' : 'text-destructive'}`}>
                                                    {e.type === 'credit' ? '+' : '-'}{e.amount.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-bold tabular-nums">{e.balance.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                      </div>
                    </ScrollArea>
                    <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteInvestorOpen} onOpenChange={setDeleteInvestorOpen}>
          <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete Portfolio?</AlertDialogTitle><AlertDialogDescription>This action is irreversible.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setInvestorToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
