'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { 
    applyInterestToPortfolio, approveDeposit, rejectDeposit, deleteInvestor
} from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, PenSquare, Check, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface InterestEntry { entryId: string; date: any; amount: number; description?: string; }
interface Withdrawal { withdrawalId: string; date: any; amount: number; status: 'pending' | 'processed' | 'rejected'; }
interface Deposit { depositId: string; date: any; amount: number; status: 'pending' | 'approved' | 'rejected'; }
interface Investor { id: string; uid: string; name: string; email: string; totalInvestment: number; totalWithdrawn: number; currentBalance: number; interestRate?: number; createdAt: any; interestEntries?: InterestEntry[]; withdrawals?: Withdrawal[]; deposits?: Deposit[]; }

const investorTermsSchema = z.object({ interestRate: z.coerce.number().min(0) });

export function InvestorsPortfolioTab() {
  const { user } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [manageInvestorOpen, setManageInvestorOpen] = useState(false);
  const [deleteInvestorOpen, setDeleteInvestorOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [investorToDelete, setInvestorToDelete] = useState<Investor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const termsForm = useForm<z.infer<typeof investorTermsSchema>>({ resolver: zodResolver(investorTermsSchema) });

  const isAuthorized = user ? (user.email?.toLowerCase() === 'simon@pezeka.com' || user.role?.toLowerCase() === 'finance') : false;
  const { data: investors, loading } = useCollection<Investor>(isAuthorized ? 'investors' : null);

  const monthlyInterest = useMemo(() => {
    if (!selectedInvestor || !selectedInvestor.interestRate) return 0;
    const rate = selectedInvestor.interestRate / 100;
    return selectedInvestor.currentBalance * rate;
  }, [selectedInvestor]);

  const handleApplyInterest = async () => {
    if (!selectedInvestor) return;
    setIsSubmitting(true);
    try {
        await applyInterestToPortfolio(firestore, selectedInvestor.id, monthlyInterest, `Monthly interest - ${format(new Date(), 'MMM yyyy')}`);
        toast({ title: 'Interest Applied' });
    } catch(e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); } finally { setIsSubmitting(false); }
  }

  const confirmDelete = async () => {
    if (!investorToDelete) return;
    setIsSubmitting(true);
    try { await deleteInvestor(firestore, investorToDelete.id); toast({ title: 'Deleted' }); setDeleteInvestorOpen(false); } catch(e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); } finally { setIsSubmitting(false); }
  }

  return (
    <>
      <Card><CardHeader><CardTitle>Portfolios</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
            <ScrollArea className="h-[60vh]"><Table>
                <TableHeader><TableRow><TableHead>Holder</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{investors?.map(inv => (
                    <TableRow key={inv.id}><TableCell>{inv.name}</TableCell><TableCell className="text-right font-bold">{inv.currentBalance.toLocaleString()}</TableCell><TableCell className="text-center"><Button variant="ghost" size="sm" onClick={() => { setSelectedInvestor(inv); termsForm.reset({ interestRate: inv.interestRate || 0 }); setManageInvestorOpen(true); }}><PenSquare className="h-4 w-4 mr-2"/>Manage</Button></TableCell></TableRow>
                ))}</TableBody>
                <TableFooter><TableRow className="bg-muted/50 font-bold"><TableCell colSpan={2} className="text-right">Total: Ksh {investors?.reduce((acc, i) => acc + i.currentBalance, 0).toLocaleString()}</TableCell><TableCell/></TableRow></TableFooter>
            </Table></ScrollArea>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={manageInvestorOpen} onOpenChange={setManageInvestorOpen}>
          <DialogContent className="sm:max-w-4xl">{selectedInvestor && (
              <>
                <DialogHeader><DialogTitle>Manage: {selectedInvestor.name}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <Card><CardHeader><CardTitle className="text-sm">Terms</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-muted p-4 rounded text-sm"><div className="flex justify-between"><span>Monthly Rate:</span><span>{selectedInvestor.interestRate}%</span></div><div className="flex justify-between font-bold border-t mt-2 pt-2"><span>Interest:</span><span>Ksh {monthlyInterest.toLocaleString()}</span></div></div>
                            <Button className="w-full" disabled={isSubmitting || monthlyInterest <= 0} onClick={handleApplyInterest}>Apply Interest</Button>
                        </CardContent>
                    </Card>
                    <Card><CardHeader><CardTitle className="text-sm">Requests</CardTitle></CardHeader>
                        <CardContent>
                            <Tabs defaultValue="deposits"><TabsList className="w-full"><TabsTrigger value="deposits" className="flex-1">Deposits</TabsTrigger><TabsTrigger value="withdrawals" className="flex-1">Withdrawals</TabsTrigger></TabsList>
                                <TabsContent value="deposits">
                                    <ScrollArea className="h-40">{selectedInvestor.deposits?.filter(d => d.status === 'pending').map(d => (
                                        <div key={d.depositId} className="flex justify-between items-center p-2 border-b text-sm"><span>Ksh {d.amount.toLocaleString()}</span><div className="flex gap-1"><Button size="icon" variant="ghost" className="text-green-600" onClick={() => approveDeposit(firestore, selectedInvestor.id, d.depositId)}><Check className="h-4 w-4"/></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => rejectDeposit(firestore, selectedInvestor.id, d.depositId)}><X className="h-4 w-4"/></Button></div></div>
                                    ))}</ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
                <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
              </>
          )}</DialogContent>
      </Dialog>

      <AlertDialog open={deleteInvestorOpen} onOpenChange={setDeleteInvestorOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Portfolio?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
