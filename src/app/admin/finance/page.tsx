'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format, addMonths } from "date-fns";
import { 
    PlusCircle, Loader2, Pencil, Trash2, FileBarChart, Search, X, 
    History, Info, Settings2, Wallet, ArrowDownLeft, ArrowUpRight, 
    ReceiptText, HandCoins, CheckCircle2, XCircle, ChevronRight,
    User, Phone, Calendar as CalendarIcon, Banknote, ShieldAlert,
    SlidersHorizontal
} from "lucide-react";

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogTrigger, DialogFooter, DialogClose, DialogDescription 
} from '@/components/ui/dialog';
import { 
    Form, FormControl, FormField, FormItem, FormLabel, 
    FormMessage, FormDescription 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { 
    addFinanceEntry, updateLoan, rolloverLoan, updateFinanceEntry, 
    deleteFinanceEntry, deleteLoan, addLoan, addCustomer, 
    approveExpenseRequest, rejectExpenseRequest 
} from '@/lib/firestore';
import { EditableFinanceReportTab } from './components/editable-finance-report-tab';
import { InvestorsPortfolioTab } from './components/investors-portfolio-tab';
import { StaffPortfoliosTab } from './components/staff-portfolios-tab';
import { PortfolioReportsTab } from './components/portfolio-reports-tab';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateAmortization } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

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
  const { data: expenseRequests, loading: requestsLoading } = useCollection<any>(isAuthorized ? 'expenseRequests' : null);

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
        if (e.type === 'receipt') receipts.push(e);
        else if (e.type === 'payout') payouts.push(e);
        else if (e.type === 'expense') expenses.push(e);
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
          
          const statusMatch = lbStatus === 'all' 
            ? (loan.status !== 'rollover') 
            : (loan.status === lbStatus);
            
          return searchMatch && statusMatch;
      }).sort((a, b) => {
          const t1 = a.disbursementDate?.seconds || 0;
          const t2 = b.disbursementDate?.seconds || 0;
          return t2 - t1;
      });
  }, [loans, lbSearch, lbStatus]);

  const pendingRequests = useMemo(() => {
      return (expenseRequests || []).filter(r => r.status === 'pending').sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [expenseRequests]);

  const handleApproveRequest = async (requestId: string) => {
      if (!user) return;
      setIsSubmitting(true);
      try {
          await approveExpenseRequest(firestore, requestId, { id: user.uid, name: user.name || user.email || 'Finance' });
          toast({ title: 'Request Approved', description: 'Expense recorded in ledger.' });
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Approval Failed', description: e.message });
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleRejectRequest = async (requestId: string) => {
      setIsSubmitting(true);
      try {
          await rejectExpenseRequest(firestore, requestId);
          toast({ title: 'Request Rejected' });
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleEditClick = (loan: Loan) => {
    setSelectedLoanForEdit(loan);
    const dDate = loan.disbursementDate?.seconds ? new Date(loan.disbursementDate.seconds * 1000) : (loan.disbursementDate ? new Date(loan.disbursementDate as any) : new Date());
    const fDate = loan.firstPaymentDate?.seconds ? new Date(loan.firstPaymentDate.seconds * 1000) : (loan.firstPaymentDate ? new Date(loan.firstPaymentDate as any) : addMonths(dDate, 1));

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
        const updateData = { ...values, disbursementDate: new Date(values.disbursementDate), firstPaymentDate: new Date(values.firstPaymentDate), assignedStaffName: staff?.name || staff?.email || "Unknown", instalmentAmount };
        await updateLoan(firestore, selectedLoanForEdit.id, updateData);
        toast({ title: 'Record Updated' });
        setSelectedLoanForEdit(null);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); } finally { setIsSubmitting(false); }
  }

  async function onEntrySubmit(values: z.infer<typeof financeEntrySchema>) {
      setIsSubmitting(true);
      try {
          const entryData: any = { type: values.type, amount: values.amount, date: new Date(values.date), description: values.description, recordedBy: user?.name || user?.email || 'Admin' };
          if (values.type === 'receipt') entryData.receiptCategory = values.category;
          else if (values.type === 'payout') entryData.payoutCategory = values.category;
          else if (values.type === 'expense') entryData.expenseCategory = values.category;
          await addFinanceEntry(firestore, entryData);
          toast({ title: 'Entry Recorded' });
          entryForm.reset();
          setIsAddEntryOpen(false);
      } catch (e: any) { toast({ variant: 'destructive', title: 'Action Failed', description: e.message }); } finally { setIsSubmitting(false); }
  }

  if (userLoading || loansLoading || financeEntriesLoading || requestsLoading) return <div className="flex h-full w-full items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAuthorized) return <div className="p-12 text-center font-bold">Access Denied</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Finance Ledger</h1>
        <Dialog open={isAddEntryOpen} onOpenChange={setIsAddEntryOpen}>
            <DialogTrigger asChild><Button className="h-11 font-bold shadow-md"><PlusCircle className="mr-2 h-5 w-5" />Add Finance Entry</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Record Financial Transaction</DialogTitle></DialogHeader>
                <Form {...entryForm}>
                    <form onSubmit={entryForm.handleSubmit(onEntrySubmit)} className="space-y-4 pt-4">
                        <FormField control={entryForm.control} name="type" render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel>Transaction Flow</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-4">
                                        <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="receipt" /></FormControl><FormLabel className="font-bold text-green-600 cursor-pointer">Receipt (In)</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="payout" /></FormControl><FormLabel className="font-bold text-destructive cursor-pointer">Payout (Capital)</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="expense" /></FormControl><FormLabel className="font-bold text-orange-600 cursor-pointer">Expense (Op)</FormLabel></FormItem>
                                    </RadioGroup>
                                </FormControl>
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={entryForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                            <FormField control={entryForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)}/>
                        </div>
                        <FormField control={entryForm.control} name="category" render={({ field }) => (
                            <FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl><SelectContent>
                                {entryForm.watch('type') === 'receipt' && (<><SelectItem value="loan_repayment">Loan Repayment</SelectItem><SelectItem value="upfront_fees">Upfront Fees</SelectItem><SelectItem value="registration_fee">Registration Fee</SelectItem><SelectItem value="penalty_payment">Penalty Collection</SelectItem><SelectItem value="investor_deposit">Investor Deposit</SelectItem><SelectItem value="other">Other Inflow</SelectItem></>)}
                                {entryForm.watch('type') === 'payout' && (<><SelectItem value="loan_disbursement">Loan Disbursement</SelectItem><SelectItem value="investor_withdrawal">Investor Withdrawal</SelectItem><SelectItem value="other">Other Payout</SelectItem></>)}
                                {entryForm.watch('type') === 'expense' && (<><SelectItem value="facilitation_commission">Staff Commission / Facilitation</SelectItem><SelectItem value="office_purchase">Office / Utility</SelectItem><SelectItem value="rent_lease">Rent / Lease</SelectItem><SelectItem value="other">Other Operational</SelectItem></>)}
                            </SelectContent></Select></FormItem>
                        )} />
                        <FormField control={entryForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Details..." {...field} /></FormControl></FormItem>)}/>
                        <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}Save Entry</Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>
      
      <Tabs defaultValue="loanbook" className="w-full">
          <TabsList className="mb-4 flex flex-wrap h-auto">
              <TabsTrigger value="loanbook">Loan Book</TabsTrigger>
              <TabsTrigger value="requests">Expense Requests {pendingRequests.length > 0 && <Badge variant="destructive" className="ml-2 h-4 w-4 p-0 flex items-center justify-center text-[8px]">{pendingRequests.length}</Badge>}</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
              <TabsTrigger value="payouts">Capital Payouts</TabsTrigger>
              <TabsTrigger value="expenses">Operational Expenses</TabsTrigger>
              <TabsTrigger value="investors">Investors</TabsTrigger>
              <TabsTrigger value="staff">Staff Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="loanbook">
              <Card>
                  <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                              <CardTitle>Master Loan Ledger</CardTitle>
                              <CardDescription>Comprehensive record of all disbursed credit facilities and their financial breakdown.</CardDescription>
                          </div>
                          <div className="flex gap-2">
                              <div className="relative">
                                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input placeholder="Search..." value={lbSearch} onChange={(e) => setLbSearch(e.target.value)} className="w-[250px] pl-8" />
                              </div>
                              <Select value={lbStatus} onValueChange={setLbStatus}>
                                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="all">Active Debt</SelectItem>
                                      <SelectItem value="active">Active</SelectItem>
                                      <SelectItem value="overdue">Overdue</SelectItem>
                                      <SelectItem value="paid">Paid</SelectItem>
                                      <SelectItem value="rollover">Rolled Over</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="p-0 border-t">
                      <ScrollArea className="w-full">
                          <div className="h-[65vh] w-full">
                              <Table className="min-w-[2400px] border-collapse">
                                  <TableHeader className="bg-muted/50 sticky top-0 z-40">
                                      <TableRow className="bg-muted/80 backdrop-blur-sm">
                                          <TableHead className="sticky left-0 bg-muted/95 border-r w-[200px] z-50">Client Name</TableHead>
                                          <TableHead>Phone</TableHead>
                                          <TableHead>Staff</TableHead>
                                          <TableHead>Loan No.</TableHead>
                                          <TableHead>Disb. Date</TableHead>
                                          <TableHead className="text-primary font-bold">First Pay</TableHead>
                                          <TableHead className="text-right">Principal</TableHead>
                                          <TableHead className="text-right">Reg Fee</TableHead>
                                          <TableHead className="text-right">Proc Fee</TableHead>
                                          <TableHead className="text-right bg-blue-50/50">Take Home</TableHead>
                                          <TableHead className="text-right">Car Track</TableHead>
                                          <TableHead className="text-right">Charging</TableHead>
                                          <TableHead className="text-center">Instalments</TableHead>
                                          <TableHead className="text-right">Inst. Amt</TableHead>
                                          <TableHead className="text-right font-bold">Amount to Pay</TableHead>
                                          <TableHead className="text-right text-green-600">Paid Amount</TableHead>
                                          <TableHead className="text-right text-destructive font-black">Balance</TableHead>
                                          <TableHead className="text-right text-orange-600">Penalties</TableHead>
                                          <TableHead className="text-right bg-green-50/50">Exp. Interest</TableHead>
                                          <TableHead className="text-right bg-green-100/50">Exp. Income</TableHead>
                                          <TableHead className="sticky right-0 bg-muted/95 border-l w-[80px] z-50 text-center">Actions</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {filteredLoanBook.length === 0 ? (
                                          <TableRow>
                                              <TableCell colSpan={21} className="text-center py-12 text-muted-foreground italic">
                                                  No matching loans found in the book.
                                              </TableCell>
                                          </TableRow>
                                      ) : (
                                          filteredLoanBook.map(loan => {
                                              const regFee = Number(loan.registrationFee) || 0;
                                              const procFee = Number(loan.processingFee) || 0;
                                              const trackFee = Number(loan.carTrackInstallationFee) || 0;
                                              const chargingFee = Number(loan.chargingCost) || 0;
                                              const totalFees = regFee + procFee + trackFee + chargingFee;
                                              const takeHome = Number(loan.principalAmount) - totalFees;
                                              
                                              const balance = Number(loan.totalRepayableAmount) - Number(loan.totalPaid);
                                              const interest = Number(loan.totalRepayableAmount) - Number(loan.principalAmount) - (Number(loan.totalPenalties) || 0);
                                              const totalIncome = interest + totalFees;

                                              const dDate = loan.disbursementDate?.seconds 
                                                ? new Date(loan.disbursementDate.seconds * 1000) 
                                                : (loan.disbursementDate instanceof Date ? loan.disbursementDate : new Date(loan.disbursementDate));

                                              const fDate = loan.firstPaymentDate?.seconds 
                                                ? new Date(loan.firstPaymentDate.seconds * 1000) 
                                                : (loan.firstPaymentDate instanceof Date ? loan.firstPaymentDate : (loan.firstPaymentDate ? new Date(loan.firstPaymentDate) : null));

                                              return (
                                                <TableRow key={loan.id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-bold sticky left-0 bg-background border-r z-30">{loan.customerName}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{loan.customerPhone}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1 text-[10px]">
                                                            <User className="h-3 w-3 text-muted-foreground" />
                                                            {loan.assignedStaffName || 'Unassigned'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-[10px]">{loan.loanNumber}</TableCell>
                                                    <TableCell className="text-[10px]">{isNaN(dDate.getTime()) ? 'N/A' : format(dDate, 'dd/MM/yy')}</TableCell>
                                                    <TableCell className="text-[10px] font-bold text-primary">{fDate && !isNaN(fDate.getTime()) ? format(fDate, 'dd/MM/yy') : 'N/A'}</TableCell>
                                                    <TableCell className="text-right font-medium text-xs">Ksh {loan.principalAmount.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-[10px]">{regFee.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-[10px]">{procFee.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right font-bold text-blue-600 bg-blue-50/20 text-xs">Ksh {takeHome.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-[10px]">{trackFee.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-[10px]">{chargingFee.toLocaleString()}</TableCell>
                                                    <TableCell className="text-center text-[10px]">{loan.numberOfInstalments} ({loan.paymentFrequency})</TableCell>
                                                    <TableCell className="text-right text-[10px]">{(loan.instalmentAmount || 0).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right font-bold text-xs">{loan.totalRepayableAmount.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-green-600 font-medium text-xs">{loan.totalPaid.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-destructive font-black text-xs">Ksh {balance.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-orange-600 text-[10px]">{(loan.totalPenalties || 0).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right font-medium text-green-700 bg-green-50/20 text-[10px]">Ksh {interest.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right font-black text-green-800 bg-green-100/20 text-xs">Ksh {totalIncome.toLocaleString()}</TableCell>
                                                    <TableCell className="sticky right-0 bg-background border-l z-30 text-center">
                                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(loan)}>
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                              )
                                          })
                                      )}
                                  </TableBody>
                              </Table>
                          </div>
                          <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="requests">
              <Card>
                  <CardHeader><CardTitle>Staff Facilitation Requests</CardTitle><CardDescription>Approve or reject staff expense submissions. Latest requests first.</CardDescription></CardHeader>
                  <CardContent>
                      <Table>
                          <TableHeader><TableRow><TableHead>Date</TableHead> <TableHead>Staff Member</TableHead><TableHead>Amount</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                          <TableBody>
                              {pendingRequests.length === 0 ? (
                                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No pending requests.</TableCell></TableRow>
                              ) : (
                                  pendingRequests.map(req => (
                                      <TableRow key={req.id}>
                                          <TableCell className="text-xs">{req.createdAt?.seconds ? format(new Date(req.createdAt.seconds * 1000), 'dd/MM/yyyy HH:mm') : '...'}</TableCell>
                                          <TableCell className="font-bold">{req.staffName}</TableCell>
                                          <TableCell className="font-black text-primary">Ksh {req.amount.toLocaleString()}</TableCell>
                                          <TableCell className="max-w-[300px] text-xs italic">"{req.description}"</TableCell>
                                          <TableCell className="text-right">
                                              <div className="flex justify-end gap-2">
                                                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproveRequest(req.id)} disabled={isSubmitting}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</Button>
                                                  <Button size="sm" variant="destructive" onClick={() => handleRejectRequest(req.id)} disabled={isSubmitting}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
                                              </div>
                                          </TableCell>
                                      </TableRow>
                                  ))
                              )}
                          </TableBody>
                      </Table>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="cashflow"><EditableFinanceReportTab title="Cash Flow" entries={financeEntries} loading={financeEntriesLoading} description="Unified transaction history." /></TabsContent>
          <TabsContent value="receipts"><EditableFinanceReportTab title="Receipts" entries={financialData.allReceipts} loading={financeEntriesLoading} description="Revenue and member inflows." /></TabsContent>
          <TabsContent value="payouts"><EditableFinanceReportTab title="Capital Payouts" entries={financialData.allPayouts} loading={financeEntriesLoading} description="Loan disbursements and withdrawals." /></TabsContent>
          <TabsContent value="expenses"><EditableFinanceReportTab title="Operational Expenses" entries={financialData.allExpenses} loading={financeEntriesLoading} description="Staff facilitation and office overhead." /></TabsContent>
          <TabsContent value="investors"><InvestorsPortfolioTab /></TabsContent>
          <TabsContent value="staff"><StaffPortfoliosTab loans={loans} staffList={staffList}/></TabsContent>
      </Tabs>

      {/* Edit Loan Dialog - UI Matching Request */}
      <Dialog open={!!selectedLoanForEdit} onOpenChange={(o) => !o && setSelectedLoanForEdit(null)}>
          <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-[1.5rem]">
              {selectedLoanForEdit && (
                  <>
                    <DialogHeader className="p-8 pb-4">
                        <DialogTitle className="text-2xl font-black text-[#1B2B33]">Edit Ledger Entry: {selectedLoanForEdit.customerName}</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-[#5BA9D0]">Modify primary financial data and repayment day.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[55vh] px-8">
                        <Form {...editForm}>
                            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6 pt-2 pb-8">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                                    <FormField control={editForm.control} name="disbursementDate" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-black text-[#1B2B33]">Disbursement Date</FormLabel>
                                            <FormControl><Input type="date" {...field} className="h-12 rounded-xl border-2 border-primary/20 focus:border-primary" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={editForm.control} name="firstPaymentDate" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-black text-[#5BA9D0]">First Payment Date</FormLabel>
                                            <FormControl><Input type="date" {...field} className="h-12 rounded-xl border-2 border-primary/10" /></FormControl>
                                        </FormItem>
                                    )} />
                                    
                                    <FormField control={editForm.control} name="assignedStaffId" render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel className="text-sm font-black text-[#1B2B33]">Staff Member</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 rounded-xl border-2 border-primary/10">
                                                        <SelectValue placeholder="Select staff member" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {staffList?.map(s => <SelectItem key={s.id} value={s.uid || s.id}>{s.name || s.email}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />

                                    <FormField control={editForm.control} name="principalAmount" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-black text-[#1B2B33]">Principal</FormLabel>
                                            <FormControl><Input type="number" {...field} className="h-12 rounded-xl bg-muted/30 border-none" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={editForm.control} name="registrationFee" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-black text-[#1B2B33]">Reg Fee</FormLabel>
                                            <FormControl><Input type="number" {...field} className="h-12 rounded-xl bg-muted/30 border-none" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={editForm.control} name="processingFee" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-black text-[#1B2B33]">Proc Fee</FormLabel>
                                            <FormControl><Input type="number" {...field} className="h-12 rounded-xl bg-muted/30 border-none" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={editForm.control} name="carTrackInstallationFee" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-black text-[#1B2B33]">Car Track Fee</FormLabel>
                                            <FormControl><Input type="number" {...field} className="h-12 rounded-xl bg-muted/30 border-none" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={editForm.control} name="chargingCost" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-black text-[#1B2B33]">Charging Cost</FormLabel>
                                            <FormControl><Input type="number" {...field} className="h-12 rounded-xl bg-muted/30 border-none" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={editForm.control} name="numberOfInstalments" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-black text-[#1B2B33]">Instalments</FormLabel>
                                            <FormControl><Input type="number" {...field} className="h-12 rounded-xl bg-muted/30 border-none" /></FormControl>
                                        </FormItem>
                                    )} />
                                    
                                    <FormField control={editForm.control} name="paymentFrequency" render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel className="text-sm font-black text-[#1B2B33]">Frequency</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 rounded-xl border-2 border-primary/10">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="daily">Daily</SelectItem>
                                                    <SelectItem value="weekly">Weekly</SelectItem>
                                                    <SelectItem value="monthly">Monthly</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />

                                    <FormField control={editForm.control} name="totalRepayableAmount" render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel className="text-sm font-black text-[#5BA9D0]">Total Repayable (Override)</FormLabel>
                                            <FormControl><Input type="number" {...field} className="h-14 rounded-xl border-2 border-primary/30 bg-primary/5 text-lg font-black" /></FormControl>
                                            <FormDescription className="text-[10px] font-medium leading-relaxed">Enter the total amount the client should pay (Principal + Total Interest).</FormDescription>
                                        </FormItem>
                                    )} />
                                </div>
                            </form>
                        </Form>
                    </ScrollArea>
                    <DialogFooter className="p-8 pt-4 bg-muted/10 border-t flex items-center justify-end gap-3">
                        <DialogClose asChild><Button variant="outline" className="h-12 px-8 rounded-xl font-bold">Cancel</Button></DialogClose>
                        <Button onClick={editForm.handleSubmit(onEditSubmit)} disabled={isSubmitting} className="h-12 px-8 rounded-xl font-bold bg-[#5BA9D0] hover:bg-[#5BA9D0]/90">
                            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <SlidersHorizontal className="mr-2 h-4 w-4" />}
                            Update Ledger
                        </Button>
                    </DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>
    </div>
  );
}
