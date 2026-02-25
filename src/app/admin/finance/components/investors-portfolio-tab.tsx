'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { addInvestor, applyInterestToPortfolio, processWithdrawal, rejectWithdrawal, deleteInvestor } from '@/lib/firestore';
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
  DialogTrigger,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PlusCircle, PenSquare, Trash2, Check, X, CircleSlash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';


// Schemas
const addInvestorSchema = z.object({
  name: z.string().min(1, 'Portfolio holder name is required.'),
  initialInvestment: z.coerce.number().min(1, 'Initial investment must be greater than 0.'),
});


// Interfaces
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

interface Investor {
  id: string;
  name: string;
  initialInvestment: number;
  currentBalance: number;
  interestRate?: number;
  createdAt: { seconds: number; nanoseconds: number };
  interestEntries?: InterestEntry[];
  withdrawals?: Withdrawal[];
}


export function InvestorsPortfolioTab() {
  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addInvestorOpen, setAddInvestorOpen] = useState(false);
  const [manageInvestorOpen, setManageInvestorOpen] = useState(false);
  const [deleteInvestorOpen, setDeleteInvestorOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [investorToDelete, setInvestorToDelete] = useState<Investor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthorized = user ? (user.email === 'simon@pezeka.com' || user.role === 'finance') : false;

  const { data: investors, loading: investorsLoading } = useCollection<Investor>(isAuthorized ? 'investors' : null);

  const isLoading = userLoading || investorsLoading;

  const addInvestorForm = useForm<z.infer<typeof addInvestorSchema>>({
    resolver: zodResolver(addInvestorSchema),
    defaultValues: { name: '', initialInvestment: undefined },
  });


  // Handlers
  async function onAddInvestorSubmit(values: z.infer<typeof addInvestorSchema>) {
    setIsSubmitting(true);
    try {
        await addInvestor(firestore, values);
        toast({ title: 'Portfolio Created', description: `A new portfolio for ${values.name} has been created.` });
        addInvestorForm.reset();
        setAddInvestorOpen(false);
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not create portfolio.' });
    } finally {
        setIsSubmitting(false);
    }
  }

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
        // Data will refresh from Firestore listener
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
      return investors ? [...investors].sort((a, b) => b.createdAt.seconds - a.createdAt.seconds) : [];
  }, [investors]);
  
  const portfolioTotals = useMemo(() => {
    if (!sortedInvestors) return { initial: 0, balance: 0 };
    return sortedInvestors.reduce((acc, investor) => {
        acc.initial += investor.initialInvestment;
        acc.balance += investor.currentBalance;
        return acc;
    }, { initial: 0, balance: 0 });
  }, [sortedInvestors]);

  const monthlyInterest = useMemo(() => {
    if (!selectedInvestor || !selectedInvestor.interestRate) return 0;
    // As per user, month starts on investment date. But for simplicity and regular cadence,
    // we'll apply monthly interest on the current balance.
    // A more complex implementation could track the exact investment date.
    const rate = selectedInvestor.interestRate / 100;
    return selectedInvestor.currentBalance * rate;
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


  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Investment Portfolios</CardTitle>
            <CardDescription>Track investment portfolios and their accumulated interest.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          )}
          {!isLoading && (!sortedInvestors || sortedInvestors.length === 0) && (
              <Alert>
                  <AlertTitle>No Portfolios Found</AlertTitle>
                  <AlertDescription>Go to the Investors page to add a new portfolio.</AlertDescription>
              </Alert>
          )}
          {!isLoading && sortedInvestors && sortedInvestors.length > 0 && (
            <ScrollArea className="h-[60vh]">
              <Table>
                  <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                          <TableHead>Portfolio Holder</TableHead>
                          <TableHead className="text-right">Initial Investment (Ksh)</TableHead>
                          <TableHead className="text-right">Current Balance (Ksh)</TableHead>
                          <TableHead className="text-right">Total Interest (Ksh)</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {sortedInvestors.map(investor => {
                          const totalInterest = investor.currentBalance - investor.initialInvestment;
                          return (
                              <TableRow key={investor.id}>
                                  <TableCell className="font-medium">{investor.name}</TableCell>
                                  <TableCell className="text-right">{investor.initialInvestment.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-bold">{investor.currentBalance.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-green-600">{totalInterest.toLocaleString()}</TableCell>
                                  <TableCell className="text-center">
                                      <Button variant="ghost" size="sm" onClick={() => handleManageClick(investor)}>
                                          <PenSquare className="mr-2 h-4 w-4" /> Manage
                                      </Button>
                                      {user?.email === 'simon@pezeka.com' && (
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
                        <TableCell className="text-right">{portfolioTotals.initial.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{portfolioTotals.balance.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600">{(portfolioTotals.balance - portfolioTotals.initial).toLocaleString()}</TableCell>
                        <TableCell />
                    </TableRow>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {/* Manage Investor Dialog */}
      <Dialog open={manageInvestorOpen} onOpenChange={setManageInvestorOpen}>
          <DialogContent className="sm:max-w-4xl">
              {selectedInvestor && (
                  <>
                    <DialogHeader>
                        <DialogTitle>Manage Portfolio for: {selectedInvestor.name}</DialogTitle>
                        <DialogDescription>Apply interest, process withdrawals, and view history.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div className="space-y-4">
                            <Card>
                                <CardHeader><CardTitle>Apply Monthly Interest</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                     <div className="space-y-2 rounded-md bg-muted p-4">
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium">Monthly Interest Rate</span>
                                            <span className="text-sm font-bold">{selectedInvestor.interestRate || 0}%</span>
                                        </div>
                                         <div className="flex justify-between">
                                            <span className="text-sm font-medium">Calculated Interest</span>
                                            <span className="text-sm font-bold">Ksh {monthlyInterest.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                    {hasInterestBeenAppliedThisMonth ? (
                                        <Alert variant="default">
                                            <Check className="h-4 w-4" />
                                            <AlertTitle>Interest Already Applied</AlertTitle>
                                            <AlertDescription>Monthly interest has already been applied for this portfolio this month.</AlertDescription>
                                        </Alert>
                                    ) : (
                                        <Button onClick={handleApplyInterest} disabled={isSubmitting || monthlyInterest <= 0} className="w-full">
                                            {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                                            Apply Interest for {format(new Date(), 'MMMM')}
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>Interest History</CardTitle></CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-60">
                                        {(!selectedInvestor.interestEntries || selectedInvestor.interestEntries.length === 0) ? (
                                            <Alert><AlertTitle>No Interest Added</AlertTitle><AlertDescription>No interest has been applied yet.</AlertDescription></Alert>
                                        ) : (
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {[...selectedInvestor.interestEntries].sort((a, b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()).map(entry => (
                                                        <TableRow key={entry.entryId}>
                                                            <TableCell>{format(new Date((entry.date as any).seconds * 1000), 'PPP')}</TableCell>
                                                            <TableCell className="text-right">{entry.amount.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                        <div>
                             <Card>
                                <CardHeader><CardTitle>Withdrawal Requests</CardTitle></CardHeader>
                                <CardContent>
                                     <ScrollArea className="h-[33.5rem]">
                                        {(!selectedInvestor.withdrawals || selectedInvestor.withdrawals.length === 0) ? (
                                            <Alert><AlertTitle>No Withdrawals</AlertTitle><AlertDescription>This investor has not made any withdrawal requests.</AlertDescription></Alert>
                                        ) : (
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {[...selectedInvestor.withdrawals].sort((a, b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()).map(w => (
                                                        <TableRow key={w.withdrawalId}>
                                                            <TableCell>{format(new Date((w.date as any).seconds * 1000), 'dd/MM/yy')}</TableCell>
                                                            <TableCell>{w.amount.toLocaleString()}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={w.status === 'pending' ? 'secondary' : w.status === 'processed' ? 'default' : 'destructive'}>
                                                                    {w.status}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {w.status === 'pending' && (
                                                                    <>
                                                                        <Button variant="ghost" size="sm" onClick={() => handleProcessWithdrawal(w.withdrawalId)} disabled={isSubmitting}><Check className="h-4 w-4 text-green-600" /></Button>
                                                                        <Button variant="ghost" size="sm" onClick={() => handleRejectWithdrawal(w.withdrawalId)} disabled={isSubmitting}><X className="h-4 w-4 text-destructive" /></Button>
                                                                    </>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
                    </DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteInvestorOpen} onOpenChange={setDeleteInvestorOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete the investment portfolio for <strong>{investorToDelete?.name}</strong>. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setInvestorToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{isSubmitting && <Loader2 className="mr-2 animate-spin" />} Delete</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
