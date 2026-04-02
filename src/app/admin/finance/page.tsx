'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format, addMonths } from "date-fns";
import { PlusCircle, Loader2, Pencil, Trash2, FileBarChart, Search, X, History, Info, Settings2, Wallet, ArrowDownLeft, ArrowUpRight, ReceiptText, HandCoins } from "lucide-react";

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { addFinanceEntry, updateLoan, rolloverLoan, updateFinanceEntry, deleteFinanceEntry, deleteLoan, addLoan, addCustomer } from '@/lib/firestore';
import { EditableFinanceReportTab } from './components/editable-finance-report-tab';
import { InvestorsPortfolioTab } from './components/investors-portfolio-tab';
import { StaffPortfoliosTab } from './components/staff-portfolios-tab';
import { PortfolioReportsTab } from './components/portfolio-reports-tab';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateAmortization } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const editLoanSchema = z.object({
  principalAmount: z.coerce.number().min(1, 'Principal is required.'),
  registrationFee: z.coerce.number().min(0),
  processingFee: z.coerce.number().min(0),
  carTrackInstallationFee: z.coerce.number().min(0),
  chargingCost: z.coerce.number().min(0),
  numberOfInstalments: z.coerce.number().int().min(1),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  assignedStaffId: z.string().min(1, 'Assign staff.'),
  disbursementDate: z.string().min(1, 'Date is required.'),
  firstPaymentDate: z.string().min(1, 'Payment date required.'),
  totalRepayableAmount: z.coerce.number().min(0, 'Total to pay is required.'),
});

const financeEntrySchema = z.object({
    type: z.enum(['receipt', 'payout', 'expense']),
    amount: z.coerce.number().min(1, 'Amount must be greater than 0'),
    date: z.string().min(1, 'Date is required'),
    description: z.string().min(3, 'Provide a clear description'),
    category: z.string().min(1, 'Select a category'),
});

interface Payment {
    paymentId: string;
    amount: number;
    date: { seconds: number; nanoseconds: number } | Date;
    recordedBy?: string;
}

interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  disbursementDate: any;
  firstPaymentDate?: any;
  principalAmount: number;
  registrationFee?: number;
  processingFee?: number;
  carTrackInstallationFee?: number;
  chargingCost?: number;
  interestRate?: number;
  numberOfInstalments: number;
  instalmentAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  totalPenalties?: number;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  status: string;
  payments?: Payment[];
}

export default function FinancePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lbSearch, setLbSearch] = useState('');
  const [lbStatus, setLbStatus] = useState('all');
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState<Loan | null>(null);
  const [selectedLoanForEdit, setSelectedLoanForEdit] = useState<Loan | null>(null);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isAuthorized = user?.role === 'finance' || user?.email === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2' || user?.uid === 'Z8gkNLZEVUWbsooR8R7OuHxApB62';

  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<any>(isAuthorized ? 'financeEntries' : null);
  const { data: staffList } = useCollection<any>(isAuthorized ? 'users' : null);

  const editForm = useForm<z.infer<typeof editLoanSchema>>({
    resolver: zodResolver(editLoanSchema),
  });

  const entryForm = useForm<z.infer<typeof financeEntrySchema>>({
      resolver: zodResolver(financeEntrySchema),
      defaultValues: {
          type: 'receipt',
          date: format(new Date(), 'yyyy-MM-dd'),
          amount: 0,
          description: '',
          category: 'other'
      }
  });

  const financialData = useMemo(() => {
    const receipts: any[] = [];
    const payouts: any[] = [];
    const expenses: any[] = [];
    if (!loans || !financeEntries) return { allReceipts: [], allPayouts: [], allExpenses: [] };
    
    financeEntries.forEach(e => {
        if (e.type === 'receipt') {
            receipts.push(e);
        } else if (e.type === 'payout') {
            payouts.push(e);
        } else if (e.type === 'expense') {
            expenses.push(e);
        }
    });

    return { allReceipts: receipts, allPayouts: payouts, allExpenses: expenses };
  }, [loans, financeEntries]);

  const filteredLoanBook = useMemo(() => {
      if (!loans) return [];
      return loans.filter(loan => {
          if (loan.status === 'application' || loan.status === 'rejected') return false;
          const searchMatch = !lbSearch || 
            loan.customerName.toLowerCase().includes(lbSearch.toLowerCase()) || 
            loan.customerPhone.includes(lbSearch) ||
            loan.loanNumber.toLowerCase().includes(lbSearch.toLowerCase());
          const statusMatch = lbStatus === 'all' || loan.status === lbStatus;
          return searchMatch && statusMatch;
      }).sort((a, b) => {
          const t1 = a.disbursementDate?.seconds || 0;
          const t2 = b.disbursementDate?.seconds || 0;
          return t2 - t1;
      });
  }, [loans, lbSearch, lbStatus]);

  const handleEditClick = (loan: Loan) => {
    setSelectedLoanForEdit(loan);
    const dDate = loan.disbursementDate?.seconds 
        ? new Date(loan.disbursementDate.seconds * 1000) 
        : (loan.disbursementDate ? new Date(loan.disbursementDate as any) : new Date());
    
    const fDate = loan.firstPaymentDate?.seconds
        ? new Date(loan.firstPaymentDate.seconds * 1000)
        : (loan.firstPaymentDate ? new Date(loan.firstPaymentDate as any) : addMonths(dDate, 1));

    editForm.reset({
        principalAmount: loan.principalAmount || 0,
        registrationFee: loan.registrationFee || 0,
        processingFee: loan.processingFee || 0,
        carTrackInstallationFee: loan.carTrackInstallationFee || 0,
        chargingCost: loan.chargingCost || 0,
        numberOfInstalments: loan.numberOfInstalments || 1,
        paymentFrequency: loan.paymentFrequency || 'monthly',
        assignedStaffId: loan.assignedStaffId || '',
        disbursementDate: isNaN(dDate.getTime()) ? format(new Date(), 'yyyy-MM-dd') : format(dDate, 'yyyy-MM-dd'),
        firstPaymentDate: isNaN(fDate.getTime()) ? format(addMonths(new Date(), 1), 'yyyy-MM-dd') : format(fDate, 'yyyy-MM-dd'),
        totalRepayableAmount: loan.totalRepayableAmount || 0,
    });
  };

  async function onEditSubmit(values: z.infer<typeof editLoanSchema>) {
    if (!selectedLoanForEdit) return;
    setIsSubmitting(true);
    try {
        const staff = staffList?.find(s => (s.uid || s.id) === values.assignedStaffId);
        const instalmentAmount = values.numberOfInstalments > 0 ? values.totalRepayableAmount / values.numberOfInstalments : 0;

        const updateData = {
            ...values,
            disbursementDate: new Date(values.disbursementDate),
            firstPaymentDate: new Date(values.firstPaymentDate),
            assignedStaffName: staff?.name || staff?.email || "Unknown",
            instalmentAmount,
        };

        await updateLoan(firestore, selectedLoanForEdit.id, updateData);
        toast({ title: 'Record Updated', description: `Loan #${selectedLoanForEdit.loanNumber} has been updated.` });
        setSelectedLoanForEdit(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  async function onEntrySubmit(values: z.infer<typeof financeEntrySchema>) {
      setIsSubmitting(true);
      try {
          const entryData: any = {
              type: values.type,
              amount: values.amount,
              date: new Date(values.date),
              description: values.description,
              recordedBy: user?.name || user?.email || 'Admin',
          };

          if (values.type === 'receipt') {
              entryData.receiptCategory = values.category;
          } else if (values.type === 'payout') {
              entryData.payoutCategory = values.category;
          } else if (values.type === 'expense') {
              entryData.expenseCategory = values.category;
          }

          await addFinanceEntry(firestore, entryData);
          toast({ title: 'Entry Recorded', description: 'The cash flow ledger has been updated.' });
          entryForm.reset();
          setIsAddEntryOpen(false);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
      } finally {
          setIsSubmitting(false);
      }
  }

  if (userLoading || loansLoading || financeEntriesLoading) return <div className="flex h-full w-full items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAuthorized) return <div className="p-12 text-center font-bold">Access Denied</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Finance Ledger</h1>
        <Dialog open={isAddEntryOpen} onOpenChange={setIsAddEntryOpen}>
            <DialogTrigger asChild>
                <Button className="h-11 font-bold shadow-md">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Add Finance Entry
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Record Financial Transaction</DialogTitle>
                    <DialogDescription>Manually record non-automated income, capital movement, or operational expenses.</DialogDescription>
                </DialogHeader>
                <Form {...entryForm}>
                    <form onSubmit={entryForm.handleSubmit(onEntrySubmit)} className="space-y-4 pt-4">
                        <FormField control={entryForm.control} name="type" render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel>Transaction Flow</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-4">
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="receipt" /></FormControl>
                                            <FormLabel className="font-bold text-green-600 flex items-center gap-1 cursor-pointer"><ArrowDownLeft className="h-3 w-3" /> Receipt (In)</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="payout" /></FormControl>
                                            <FormLabel className="font-bold text-destructive flex items-center gap-1 cursor-pointer"><HandCoins className="h-3 w-3" /> Payout (Capital)</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="expense" /></FormControl>
                                            <FormLabel className="font-bold text-orange-600 flex items-center gap-1 cursor-pointer"><ReceiptText className="h-3 w-3" /> Expense (Op)</FormLabel>
                                        </FormItem>
                                    </RadioGroup>
                                </FormControl>
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={entryForm.control} name="amount" render={({ field }) => (
                                <FormItem><FormLabel>Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={entryForm.control} name="date" render={({ field }) => (
                                <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>

                        <FormField control={entryForm.control} name="category" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {entryForm.watch('type') === 'receipt' && (
                                            <>
                                                <SelectItem value="loan_repayment">Loan Repayment (Manual)</SelectItem>
                                                <SelectItem value="upfront_fees">Upfront Fees (Appraisal/Proc)</SelectItem>
                                                <SelectItem value="registration_fee">Onboarding / Registration Fee</SelectItem>
                                                <SelectItem value="penalty_payment">Penalty Collection</SelectItem>
                                                <SelectItem value="investor_deposit">Investor Deposit</SelectItem>
                                                <SelectItem value="other">Other Inflow / Misc Income</SelectItem>
                                            </>
                                        )}
                                        {entryForm.watch('type') === 'payout' && (
                                            <>
                                                <SelectItem value="loan_disbursement">Loan Disbursement (Manual)</SelectItem>
                                                <SelectItem value="investor_withdrawal">Investor Withdrawal</SelectItem>
                                                <SelectItem value="capital_transfer">General Capital Transfer</SelectItem>
                                                <SelectItem value="other">Other Capital Outflow</SelectItem>
                                            </>
                                        )}
                                        {entryForm.watch('type') === 'expense' && (
                                            <>
                                                <SelectItem value="facilitation_commission">Staff Commission / Facilitation</SelectItem>
                                                <SelectItem value="office_purchase">Office / Utility / Supply Expense</SelectItem>
                                                <SelectItem value="rent_lease">Office Rent / Lease</SelectItem>
                                                <SelectItem value="marketing_sales">Marketing & Sales Expense</SelectItem>
                                                <SelectItem value="other">Other Operational Expense</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={entryForm.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Notes / Description</FormLabel><FormControl><Textarea placeholder="Details of the entry..." {...field} /></FormControl><FormMessage /></FormItem>
                        )} />

                        <DialogFooter>
                            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                                Save Entry
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>
      
      <Tabs defaultValue="loanbook" className="w-full">
          <TabsList className="mb-4 flex flex-wrap h-auto">
              <TabsTrigger value="loanbook">Internal Loan Book</TabsTrigger>
              <TabsTrigger value="reports">Portfolio Reports</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow Ledger</TabsTrigger>
              <TabsTrigger value="receipts">Receipts (In)</TabsTrigger>
              <TabsTrigger value="payouts">Payouts (Capital)</TabsTrigger>
              <TabsTrigger value="expenses">Expenses (Ops)</TabsTrigger>
              <TabsTrigger value="investors">Investors</TabsTrigger>
              <TabsTrigger value="staff">Staff Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="loanbook">
              <Card>
                  <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <CardTitle>Internal Loan Book</CardTitle>
                            <CardDescription>Comprehensive ledger of all active and historical loans.</CardDescription>
                          </div>
                          <div className="flex gap-2">
                              <div className="relative">
                                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input placeholder="Search client, phone or LN..." value={lbSearch} onChange={(e) => setLbSearch(e.target.value)} className="w-[250px] pl-8" />
                              </div>
                              <Select value={lbStatus} onValueChange={setLbStatus}>
                                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="all">All Status</SelectItem>
                                      <SelectItem value="active">Active</SelectItem>
                                      <SelectItem value="due">Due</SelectItem>
                                      <SelectItem value="overdue">Overdue</SelectItem>
                                      <SelectItem value="paid">Paid</SelectItem>
                                      <SelectItem value="rollover">Rollover</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="p-0 border-t">
                      <div className="relative">
                          <ScrollArea className="w-full">
                              <div className="h-[65vh] w-full">
                                  <Table className="min-w-[3000px] border-separate border-spacing-0">
                                      <TableHeader className="bg-muted/50 sticky top-0 z-40">
                                          <TableRow>
                                              <TableHead className="sticky left-0 bg-muted/50 z-50 w-[220px] border-r">Client Name</TableHead>
                                              <TableHead className="w-[150px]">Phone</TableHead>
                                              <TableHead className="w-[150px]">Staff</TableHead>
                                              <TableHead className="w-[120px]">Loan No.</TableHead>
                                              <TableHead className="w-[120px]">Disb. Date</TableHead>
                                              <TableHead className="w-[120px] text-primary">First Pay</TableHead>
                                              <TableHead className="text-right w-[140px]">Principal</TableHead>
                                              <TableHead className="text-right w-[120px]">Reg Fee</TableHead>
                                              <TableHead className="text-right w-[120px]">Proc Fee</TableHead>
                                              <TableHead className="text-right w-[140px] bg-blue-50/50">Take Home</TableHead>
                                              <TableHead className="text-right w-[140px]">Car Track</TableHead>
                                              <TableHead className="text-right w-[140px]">Charging</TableHead>
                                              <TableHead className="text-center w-[120px]">Instalments</TableHead>
                                              <TableHead className="text-right w-[140px]">Inst. Amt</TableHead>
                                              <TableHead className="text-right w-[140px]">Amount to Pay</TableHead>
                                              <TableHead className="text-right w-[140px] text-green-600">Paid Amount</TableHead>
                                              <TableHead className="text-right w-[140px] text-destructive">Balance</TableHead>
                                              <TableHead className="text-right w-[120px]">Penalties</TableHead>
                                              <TableHead className="text-right w-[140px]">Exp. Interest</TableHead>
                                              <TableHead className="text-right w-[140px] bg-green-50/50">Exp. Income</TableHead>
                                              <TableHead className="text-center w-[120px] sticky right-0 bg-muted/50 z-50 border-l">Actions</TableHead>
                                          </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {filteredLoanBook.map(loan => {
                                              const dDate = loan.disbursementDate?.seconds 
                                                ? new Date(loan.disbursementDate.seconds * 1000) 
                                                : (loan.disbursementDate ? new Date(loan.disbursementDate as any) : new Date());
                                              
                                              const fDate = loan.firstPaymentDate?.seconds
                                                ? new Date(loan.firstPaymentDate.seconds * 1000)
                                                : (loan.firstPaymentDate ? new Date(loan.firstPaymentDate as any) : null);

                                              const regFee = Number(loan.registrationFee) || 0;
                                              const procFee = Number(loan.processingFee) || 0;
                                              const trackFee = Number(loan.carTrackInstallationFee) || 0;
                                              const chargeFee = Number(loan.chargingCost) || 0;
                                              const totalFees = regFee + procFee + trackFee + chargeFee;
                                              const takeHome = loan.principalAmount - totalFees;
                                              
                                              const interest = (loan.totalRepayableAmount || 0) - loan.principalAmount - (loan.totalPenalties || 0);
                                              const totalIncome = interest + totalFees;
                                              const balance = (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0);

                                              return (
                                                  <TableRow key={loan.id} className="hover:bg-muted/30 transition-colors group">
                                                      <TableCell className="font-bold sticky left-0 bg-background group-hover:bg-muted/30 transition-colors z-30 border-r">{loan.customerName}</TableCell>
                                                      <TableCell className="text-xs">{loan.customerPhone}</TableCell>
                                                      <TableCell className="text-xs italic">{loan.assignedStaffName || 'Unassigned'}</TableCell>
                                                      <TableCell className="font-mono text-[10px]">{loan.loanNumber}</TableCell>
                                                      <TableCell className="text-xs">{isNaN(dDate.getTime()) ? 'N/A' : format(dDate, 'dd/MM/yy')}</TableCell>
                                                      <TableCell className="text-xs font-bold text-primary">{fDate && !isNaN(fDate.getTime()) ? format(fDate, 'dd/MM/yy') : 'N/A'}</TableCell>
                                                      <TableCell className="text-right font-medium">{loan.principalAmount.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right text-muted-foreground">{regFee.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right text-muted-foreground">{procFee.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right font-bold bg-blue-50/30 text-blue-700">{takeHome.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right text-muted-foreground">{trackFee.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right text-muted-foreground">{chargeFee.toLocaleString()}</TableCell>
                                                      <TableCell className="text-center">{loan.numberOfInstalments}</TableCell>
                                                      <TableCell className="text-right">{loan.instalmentAmount.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right font-semibold">{loan.totalRepayableAmount.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right text-green-600 font-medium">{loan.totalPaid.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right font-black text-destructive">{balance.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right text-orange-600">{loan.totalPenalties?.toLocaleString() || '0'}</TableCell>
                                                      <TableCell className="text-right font-medium">{interest.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right font-black bg-green-50/30 text-green-700">{totalIncome.toLocaleString()}</TableCell>
                                                      <TableCell className="text-center sticky right-0 bg-background group-hover:bg-muted/30 transition-colors z-30 border-l">
                                                          <div className="flex items-center justify-center gap-1">
                                                              <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-8 w-8 p-0"
                                                                onClick={() => handleEditClick(loan)}
                                                              >
                                                                  <Pencil className="h-4 w-4 text-primary" />
                                                              </Button>
                                                              <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-8 w-8 p-0"
                                                                onClick={() => setSelectedLoanForHistory(loan)}
                                                              >
                                                                  <History className="h-4 w-4 text-muted-foreground" />
                                                              </Button>
                                                          </div>
                                                      </TableCell>
                                                  </TableRow>
                                              );
                                          })}
                                      </TableBody>
                                  </Table>
                              </div>
                              <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="reports"><PortfolioReportsTab loans={loans} /></TabsContent>
          <TabsContent value="cashflow"><EditableFinanceReportTab title="Cash Flow Ledger" description="Comprehensive record of all incoming and outgoing funds." entries={financeEntries} loading={financeEntriesLoading} /></TabsContent>
          <TabsContent value="receipts"><EditableFinanceReportTab title="Receipts" description="Incoming revenue and capital injections." entries={financialData.allReceipts} loading={financeEntriesLoading} /></TabsContent>
          <TabsContent value="payouts"><EditableFinanceReportTab title="Capital Payouts" description="Primary capital leaving the business (Disbursements/Withdrawals)." entries={financialData.allPayouts} loading={financeEntriesLoading} /></TabsContent>
          <TabsContent value="expenses"><EditableFinanceReportTab title="Operational Expenses" description="Staff commissions, office costs, and facilitation fees." entries={financialData.allExpenses} loading={financeEntriesLoading} /></TabsContent>
          <TabsContent value="investors"><InvestorsPortfolioTab /></TabsContent>
          <TabsContent value="staff"><StaffPortfoliosTab loans={loans} staffList={staffList}/></TabsContent>
      </Tabs>

      <Dialog open={!!selectedLoanForEdit} onOpenChange={(o) => !o && setSelectedLoanForEdit(null)}>
          <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                  <DialogTitle>Edit Ledger Entry: {selectedLoanForEdit?.customerName}</DialogTitle>
                  <DialogDescription>Modify primary financial data and repayment day.</DialogDescription>
              </DialogHeader>
              <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={editForm.control} name="disbursementDate" render={({field}) => (
                              <FormItem><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field}/></FormControl></FormItem>
                          )} />
                          <FormField control={editForm.control} name="firstPaymentDate" render={({field}) => (
                              <FormItem><FormLabel className="text-primary font-bold">First Payment Date</FormLabel><FormControl><Input type="date" {...field} className="border-primary/30"/></FormControl></FormItem>
                          )} />
                          <FormField control={editForm.control} name="assignedStaffId" render={({field}) => (
                              <FormItem className="col-span-2">
                                  <FormLabel>Staff Member</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Select staff"/></SelectTrigger></FormControl>
                                      <SelectContent>{staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}</SelectContent>
                                  </Select>
                              </FormItem>
                          )} />
                          <FormField control={editForm.control} name="principalAmount" render={({field}) => (<FormItem><FormLabel>Principal</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                          <FormField control={editForm.control} name="registrationFee" render={({field}) => (<FormItem><FormLabel>Reg Fee</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                          <FormField control={editForm.control} name="processingFee" render={({field}) => (<FormItem><FormLabel>Proc Fee</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                          <FormField control={editForm.control} name="carTrackInstallationFee" render={({field}) => (<FormItem><FormLabel>Car Track Fee</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                          <FormField control={editForm.control} name="chargingCost" render={({field}) => (<FormItem><FormLabel>Charging Cost</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                          <FormField control={editForm.control} name="numberOfInstalments" render={({field}) => (<FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                          <FormField control={editForm.control} name="paymentFrequency" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Frequency</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Frequency" /></SelectTrigger></FormControl>
                                      <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                                  </Select>
                              </FormItem>
                          )} />
                          <FormField control={editForm.control} name="totalRepayableAmount" render={({field}) => (
                              <FormItem className="col-span-2">
                                  <FormLabel className="font-bold text-primary">Total Repayable (Override)</FormLabel>
                                  <FormControl><Input type="number" {...field} className="font-bold border-primary/50 bg-primary/5"/></FormControl>
                                  <FormDescription className="text-[10px]">Enter the total amount the client should pay (Principal + Total Interest).</FormDescription>
                              </FormItem>
                          )} />
                      </div>
                      <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setSelectedLoanForEdit(null)}>Cancel</Button>
                          <Button type="submit" disabled={isSubmitting}>
                              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Settings2 className="mr-2 h-4 w-4"/>}
                              Update Ledger
                          </Button>
                      </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLoanForHistory} onOpenChange={(open) => !open && setSelectedLoanForHistory(null)}>
          <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                  <DialogTitle>Repayment History</DialogTitle>
                  <DialogDescription>
                      Payment log for {selectedLoanForHistory?.customerName} (Loan #{selectedLoanForHistory?.loanNumber})
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                      <div>
                          <p className="text-muted-foreground">Total Repayable</p>
                          <p className="font-bold">Ksh {selectedLoanForHistory?.totalRepayableAmount.toLocaleString()}</p>
                      </div>
                      <div>
                          <p className="text-muted-foreground">Total Paid</p>
                          <p className="font-bold text-green-600">Ksh {selectedLoanForHistory?.totalPaid.toLocaleString()}</p>
                      </div>
                  </div>
                  <ScrollArea className="h-64 border rounded-md">
                      <Table>
                          <TableHeader className="bg-muted/50 sticky top-0">
                              <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Amount (Ksh)</TableHead>
                                  <TableHead>Recorded By</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {(!selectedLoanForHistory?.payments || selectedLoanForHistory.payments.length === 0) ? (
                                  <TableRow>
                                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">No payments recorded.</TableCell>
                                  </TableRow>
                              ) : (
                                  [...selectedLoanForHistory.payments].sort((a,b) => {
                                      const t1 = (a.date as any)?.seconds || 0;
                                      const t2 = (b.date as any)?.seconds || 0;
                                      return t2 - t1;
                                  }).map((p, i) => {
                                      const pDate = (p.date as any)?.seconds 
                                          ? new Date((p.date as any).seconds * 1000) 
                                          : (p.date instanceof Date ? p.date : new Date());
                                      return (
                                          <TableRow key={p.paymentId || i}>
                                              <TableCell className="text-xs">{format(pDate, 'dd/MM/yyyy HH:mm')}</TableCell>
                                              <TableCell className="font-bold text-green-600">{p.amount.toLocaleString()}</TableCell>
                                              <TableCell className="text-[10px] italic">{p.recordedBy || 'System'}</TableCell>
                                          </TableRow>
                                      )
                                  })
                              )}
                          </TableBody>
                      </Table>
                  </ScrollArea>
              </div>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
