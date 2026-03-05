'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format, addDays, addWeeks, addMonths, differenceInDays } from "date-fns";
import { PlusCircle, Loader2, AlertCircle, History, Info } from "lucide-react";
import { arrayUnion, increment, doc, collection } from 'firebase/firestore';

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { addFinanceEntry, updateLoan, rolloverLoan, addPenaltyToLoan, updateFinanceEntry } from '@/lib/firestore';
import { EditableFinanceReportTab } from './components/editable-finance-report-tab';
import { InvestorsPortfolioTab } from './components/investors-portfolio-tab';
import { StaffPortfoliosTab } from './components/staff-portfolios-tab';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateInterestForOneInstalment, calculateAmortization } from '@/lib/utils';

const addFinanceEntrySchema = z.object({
  type: z.enum(['receipt', 'payout', 'expense']),
  date: z.string().min(1),
  amount: z.coerce.number().min(0.01),
  transactionFee: z.coerce.number().optional(),
  description: z.string().optional(),
  loanId: z.string().optional(),
  expenseCategory: z.enum(['facilitation_commission', 'office_purchase', 'other']).optional(),
  receiptCategory: z.enum(['loan_repayment', 'upfront_fees', 'investment', 'other']).optional(),
  payoutCategory: z.enum(['loan_disbursement', 'investor_withdrawal', 'other']).optional(),
});

interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  disbursementDate: any;
  principalAmount: number;
  interestRate?: number;
  totalRepayableAmount: number;
  totalPaid: number;
  totalPenalties?: number;
  instalmentAmount: number;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  numberOfInstalments: number;
  registrationFee: number;
  processingFee: number;
  carTrackInstallationFee: number;
  chargingCost: number;
  status: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  payments?: { paymentId: string; date: any; amount: number; }[];
  penalties?: any[];
}

interface FinanceEntry {
  id: string;
  type: string;
  date: any;
  amount: number;
  transactionFee?: number;
  description: string;
  loanId?: string;
  expenseCategory?: string;
  receiptCategory?: string;
  payoutCategory?: string;
}

export default function FinancePage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [loanHistoryToShow, setLoanHistoryToShow] = useState<Loan | null>(null);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isSuperAdmin = user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
  const isFinance = user?.role?.toLowerCase() === 'finance';
  const isAuthorized = isSuperAdmin || isFinance;

  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<FinanceEntry>(isAuthorized ? 'financeEntries' : null);
  const { data: staffList } = useCollection<any>(isAuthorized ? 'users' : null);

  const financialData = useMemo(() => {
    const receipts: any[] = [];
    const payouts: any[] = [];
    if (!loans || !financeEntries) return { allReceipts: [], allPayouts: [] };
    
    loans.filter(l => l.status !== 'application' && l.status !== 'rejected').forEach(loan => {
        (loan.payments || []).forEach(p => receipts.push({ id: p.paymentId, date: p.date, amount: p.amount, description: `Repayment: Loan #${loan.loanNumber}`, receiptCategory: 'loan_repayment' }));
    });

    financeEntries.forEach(e => {
        if (e.type === 'receipt') receipts.push(e);
        else payouts.push(e);
    });
    return { allReceipts: receipts, allPayouts: payouts };
  }, [loans, financeEntries]);

  const addForm = useForm<z.infer<typeof addFinanceEntrySchema>>({
    resolver: zodResolver(addFinanceEntrySchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd'), amount: 0, type: 'receipt' }
  });

  const penaltyCalculation = useMemo(() => {
      if (!loanToEdit) return { dailyRate: 0, daysLate: 0, suggested: 0 };
      const oneInst = calculateInterestForOneInstalment(loanToEdit.principalAmount, loanToEdit.interestRate || 0, loanToEdit.numberOfInstalments, loanToEdit.paymentFrequency);
      const days = loanToEdit.paymentFrequency === 'monthly' ? 30 : (loanToEdit.paymentFrequency === 'weekly' ? 7 : 1);
      const dailyRate = oneInst / days;
      let dDate = loanToEdit.disbursementDate instanceof Date ? loanToEdit.disbursementDate : new Date((loanToEdit.disbursementDate as any).seconds * 1000);
      let due: Date;
      if (loanToEdit.paymentFrequency === 'monthly') due = addMonths(dDate, loanToEdit.numberOfInstalments);
      else if (loanToEdit.paymentFrequency === 'weekly') due = addWeeks(dDate, loanToEdit.numberOfInstalments);
      else due = addDays(dDate, loanToEdit.numberOfInstalments);
      const diff = differenceInDays(new Date(), due);
      return { daysLate: diff > 0 ? diff : 0, suggested: Math.round((diff > 0 ? diff : 0) * dailyRate) };
  }, [loanToEdit]);

  const authorizeSuggestedPenalty = () => {
      if (penaltyCalculation.suggested > 0 && loanToEdit) {
          addPenaltyToLoan(firestore, loanToEdit.id, { amount: penaltyCalculation.suggested, date: new Date(), description: "Late payment penalty" }).then(() => toast({ title: "Penalty Applied" }));
      }
  };

  async function onAddSubmit(values: z.infer<typeof addFinanceEntrySchema>) {
    setIsSubmitting(true);
    try {
      const data = { ...values, date: new Date(values.date) };
      if (editingEntry) await updateFinanceEntry(firestore, editingEntry.id, data);
      else await addFinanceEntry(firestore, data as any);
      setOpen(false); setEditingEntry(null); addForm.reset();
      toast({ title: editingEntry ? 'Entry Updated' : 'Entry Recorded' });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); } finally { setIsSubmitting(false); }
  }

  if (userLoading || loansLoading || financeEntriesLoading) return <div className="flex h-full w-full items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAuthorized) return <div className="p-12">Access Restricted</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Entry</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>New Finance Entry</DialogTitle></DialogHeader>
                  <Form {...addForm}>
                      <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                          <FormField control={addForm.control} name="type" render={({field}) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="receipt">Receipt</SelectItem><SelectItem value="payout">Payout</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select></FormItem>)}/>
                          <FormField control={addForm.control} name="amount" render={({field}) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl></FormItem>)}/>
                          <FormField control={addForm.control} name="date" render={({field}) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''}/></FormControl></FormItem>)}/>
                          <Button type="submit" className="w-full" disabled={isSubmitting}>Record</Button>
                      </form>
                  </Form>
              </DialogContent>
          </Dialog>
      </div>
      
      <Tabs defaultValue="loanbook" className="w-full">
          <TabsList className="mb-4">
              <TabsTrigger value="loanbook">Loan Book</TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
              <TabsTrigger value="investors">Investors</TabsTrigger>
              <TabsTrigger value="staff">Staff Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="loanbook">
              <Card>
                  <CardHeader>
                      <CardTitle>Internal Ledger (Loan Book)</CardTitle>
                      <CardDescription>Comprehensive tracking of all credit facilities, fees, and income.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                      <ScrollArea className="h-[65vh] w-full">
                          <Table className="min-w-[2200px]">
                              <TableHeader>
                                  <TableRow>
                                      <TableHead className="w-[150px]">Client Name</TableHead>
                                      <TableHead className="w-[120px]">Phone Number</TableHead>
                                      <TableHead className="w-[100px]">Loan No.</TableHead>
                                      <TableHead className="w-[100px]">Date</TableHead>
                                      <TableHead className="text-right">Principal</TableHead>
                                      <TableHead className="text-right">Reg. Fee</TableHead>
                                      <TableHead className="text-right">Proc. Fee</TableHead>
                                      <TableHead className="text-right font-bold text-primary">Take Home</TableHead>
                                      <TableHead className="text-right">Car Track</TableHead>
                                      <TableHead className="text-right">Charging Cost</TableHead>
                                      <TableHead className="text-center">Instalments</TableHead>
                                      <TableHead className="text-right">Inst. Amount</TableHead>
                                      <TableHead className="text-right">Amt to Pay</TableHead>
                                      <TableHead className="text-right text-green-600">Paid Amount</TableHead>
                                      <TableHead className="text-right font-bold">Balance</TableHead>
                                      <TableHead className="text-right text-destructive">Penalties</TableHead>
                                      <TableHead className="text-right">Exp. Interest</TableHead>
                                      <TableHead className="text-right font-bold">Exp. Income</TableHead>
                                      <TableHead className="text-center">History</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {loans?.filter(l => l.status !== 'application' && l.status !== 'rejected').map(loan => {
                                      const totalFees = (Number(loan.registrationFee) || 0) + (Number(loan.processingFee) || 0) + (Number(loan.carTrackInstallationFee) || 0) + (Number(loan.chargingCost) || 0);
                                      const takeHome = loan.principalAmount - totalFees;
                                      const balance = loan.totalRepayableAmount - loan.totalPaid;
                                      const expectedInterest = loan.totalRepayableAmount - (loan.totalPenalties || 0) - loan.principalAmount;
                                      const expectedIncome = expectedInterest + (Number(loan.registrationFee) || 0) + (Number(loan.processingFee) || 0);
                                      
                                      return (
                                          <TableRow key={loan.id} className="group">
                                              <TableCell className="font-medium">{loan.customerName}</TableCell>
                                              <TableCell>{loan.customerPhone}</TableCell>
                                              <TableCell>{loan.loanNumber}</TableCell>
                                              <TableCell>{format(new Date((loan.disbursementDate as any).seconds * 1000), 'dd/MM/yy')}</TableCell>
                                              <TableCell className="text-right">{loan.principalAmount.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.registrationFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.processingFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-bold text-primary">{takeHome.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.carTrackInstallationFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.chargingCost || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-center">{loan.numberOfInstalments} ({loan.paymentFrequency})</TableCell>
                                              <TableCell className="text-right">{loan.instalmentAmount.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{loan.totalRepayableAmount.toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-green-600 font-semibold">{loan.totalPaid.toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-bold">{balance.toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-destructive">{(loan.totalPenalties || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{expectedInterest.toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-bold">{expectedIncome.toLocaleString()}</TableCell>
                                              <TableCell className="text-center">
                                                  <Button variant="ghost" size="icon" onClick={() => setLoanHistoryToShow(loan)}>
                                                      <History className="h-4 w-4" />
                                                  </Button>
                                              </TableCell>
                                          </TableRow>
                                      );
                                  })}
                              </TableBody>
                          </Table>
                          <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="receipts"><EditableFinanceReportTab title="Receipts" description="Income transactions" entries={financialData.allReceipts} loading={false}/></TabsContent>
          <TabsContent value="payouts"><EditableFinanceReportTab title="Payouts" description="Outgoing transactions" entries={financialData.allPayouts} loading={false}/></TabsContent>
          <TabsContent value="investors"><InvestorsPortfolioTab/></TabsContent>
          <TabsContent value="staff"><StaffPortfoliosTab loans={loans} staffList={staffList}/></TabsContent>
      </Tabs>

      <Dialog open={!!loanHistoryToShow} onOpenChange={(open) => !open && setLoanHistoryToShow(null)}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Repayment History: {loanHistoryToShow?.loanNumber}</DialogTitle>
                  <DialogDescription>Full list of payments received for this facility.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-80 border rounded-md p-4">
                  {(!loanHistoryToShow?.payments || loanHistoryToShow.payments.length === 0) ? (
                      <p className="text-center py-12 text-muted-foreground text-sm">No payments recorded yet.</p>
                  ) : (
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {loanHistoryToShow.payments.map((p, i) => (
                                  <TableRow key={p.paymentId || i}>
                                      <TableCell>{format(new Date((p.date as any).seconds * 1000), 'PPP')}</TableCell>
                                      <TableCell className="text-right font-bold text-green-600">Ksh {p.amount.toLocaleString()}</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  )}
              </ScrollArea>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={!!loanToEdit} onOpenChange={(open) => !open && setLoanToEdit(null)}>
          <DialogContent className="sm:max-w-4xl">{loanToEdit && (
              <>
                <DialogHeader><DialogTitle>Manage Loan #{loanToEdit.loanNumber}</DialogTitle><DialogDescription>Adjust terms or record late penalties.</DialogDescription></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <Card><CardHeader><CardTitle className="text-sm">Late Penalty</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-orange-50 p-4 rounded text-sm">
                                <p>Days Late: {penaltyCalculation.daysLate}</p>
                                <p className="font-bold">Suggested: Ksh {penaltyCalculation.suggested}</p>
                            </div>
                            <Button className="w-full" disabled={penaltyCalculation.suggested <= 0} onClick={authorizeSuggestedPenalty}>Apply Penalty</Button>
                        </CardContent>
                    </Card>
                    <Card><CardHeader><CardTitle className="text-sm">Staff Assignment</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-sm mb-2">Assigned: {loanToEdit.assignedStaffName || 'None'}</div>
                            <Badge variant="outline">Update via Loans page</Badge>
                        </CardContent>
                    </Card>
                </div>
                <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
              </>
          )}</DialogContent>
      </Dialog>
    </div>
  );
}
