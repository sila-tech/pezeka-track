'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns";
import { PlusCircle, Loader2, Pencil, Trash2, FileBarChart, Search, X, History, Info } from "lucide-react";

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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

interface Payment {
    paymentId: string;
    amount: number;
    date: { seconds: number; nanoseconds: number } | Date;
    recordedBy?: string;
}

interface Loan {
  id: string;
  loanNumber: string;
  customerName: string;
  customerPhone: string;
  assignedStaffName?: string;
  disbursementDate: any;
  principalAmount: number;
  registrationFee?: number;
  processingFee?: number;
  carTrackInstallationFee?: number;
  chargingCost?: number;
  numberOfInstalments: number;
  instalmentAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  totalPenalties?: number;
  status: string;
  payments?: Payment[];
}

export default function FinancePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lbSearch, setLbSearch] = useState('');
  const [lbStatus, setLbStatus] = useState('all');
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState<Loan | null>(null);

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isAuthorized = user?.role === 'finance' || user?.email === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';

  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<any>(isAuthorized ? 'financeEntries' : null);
  const { data: staffList } = useCollection<any>(isAuthorized ? 'users' : null);

  const financialData = useMemo(() => {
    const receipts: any[] = [];
    const payouts: any[] = [];
    if (!loans || !financeEntries) return { allReceipts: [], allPayouts: [] };
    
    financeEntries.forEach(e => {
        if (e.type === 'receipt') receipts.push(e);
        else payouts.push(e);
    });

    return { allReceipts: receipts, allPayouts: payouts };
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

  if (userLoading || loansLoading || financeEntriesLoading) return <div className="flex h-full w-full items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAuthorized) return <div className="p-12 text-center font-bold">Access Denied</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Finance Ledger</h1>
      </div>
      
      <Tabs defaultValue="loanbook" className="w-full">
          <TabsList className="mb-4">
              <TabsTrigger value="loanbook">Internal Loan Book</TabsTrigger>
              <TabsTrigger value="reports">Portfolio Reports</TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
              <TabsTrigger value="payouts">Payouts & Expenses</TabsTrigger>
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
                  <CardContent className="p-0">
                      {/* Fixed height container with native scroll to prevent auto-scrolling issues */}
                      <div className="h-[65vh] w-full overflow-auto border-t">
                          <Table className="min-w-[2500px] border-separate border-spacing-0">
                              <TableHeader className="bg-muted/50 sticky top-0 z-40">
                                  <TableRow>
                                      <TableHead className="sticky left-0 bg-muted/50 z-50 w-[200px] border-r">Client Name</TableHead>
                                      <TableHead className="w-[150px]">Phone</TableHead>
                                      <TableHead className="w-[150px]">Staff</TableHead>
                                      <TableHead className="w-[120px]">Loan No.</TableHead>
                                      <TableHead className="w-[120px]">Date</TableHead>
                                      <TableHead className="text-right w-[140px]">Principal</TableHead>
                                      <TableHead className="text-right w-[120px]">Reg Fee</TableHead>
                                      <TableHead className="text-right w-[120px]">Proc Fee</TableHead>
                                      <TableHead className="text-right w-[140px] bg-blue-50/50">Take Home</TableHead>
                                      <TableHead className="text-right w-[120px]">Car Track</TableHead>
                                      <TableHead className="text-right w-[120px]">Charging</TableHead>
                                      <TableHead className="text-center w-[120px]">Instalments</TableHead>
                                      <TableHead className="text-right w-[140px]">Inst. Amt</TableHead>
                                      <TableHead className="text-right w-[140px]">Amt to Pay</TableHead>
                                      <TableHead className="text-right w-[140px] text-green-600">Paid Amt</TableHead>
                                      <TableHead className="text-right w-[140px] text-destructive">Balance</TableHead>
                                      <TableHead className="text-right w-[120px]">Penalties</TableHead>
                                      <TableHead className="text-right w-[140px]">Exp. Interest</TableHead>
                                      <TableHead className="text-right w-[140px] bg-green-50/50">Exp. Income</TableHead>
                                      <TableHead className="text-center w-[120px] sticky right-0 bg-muted/50 z-50 border-l">History</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {filteredLoanBook.map(loan => {
                                      const dDate = loan.disbursementDate?.seconds 
                                        ? new Date(loan.disbursementDate.seconds * 1000) 
                                        : (loan.disbursementDate ? new Date(loan.disbursementDate as any) : new Date());
                                      
                                      const regFee = Number(loan.registrationFee) || 0;
                                      const procFee = Number(loan.processingFee) || 0;
                                      const trackFee = Number(loan.carTrackInstallationFee) || 0;
                                      const chargeFee = Number(loan.chargingCost) || 0;
                                      const totalFees = regFee + procFee + trackFee + chargeFee;
                                      const takeHome = loan.principalAmount - totalFees;
                                      
                                      const interest = loan.totalRepayableAmount - loan.principalAmount;
                                      const totalIncome = interest + totalFees;
                                      const balance = loan.totalRepayableAmount - loan.totalPaid;

                                      return (
                                          <TableRow key={loan.id} className="hover:bg-muted/30 transition-colors group">
                                              <TableCell className="font-bold sticky left-0 bg-background group-hover:bg-muted/30 transition-colors z-30 border-r">{loan.customerName}</TableCell>
                                              <TableCell className="text-xs">{loan.customerPhone}</TableCell>
                                              <TableCell className="text-xs italic">{loan.assignedStaffName || 'Unassigned'}</TableCell>
                                              <TableCell className="font-mono text-[10px]">{loan.loanNumber}</TableCell>
                                              <TableCell className="text-xs">{isNaN(dDate.getTime()) ? 'N/A' : format(dDate, 'dd/MM/yy')}</TableCell>
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
                                                  <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => setSelectedLoanForHistory(loan)}
                                                  >
                                                      <History className="h-4 w-4 text-primary" />
                                                  </Button>
                                              </TableCell>
                                          </TableRow>
                                      );
                                  })}
                              </TableBody>
                          </Table>
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="reports"><PortfolioReportsTab loans={loans} /></TabsContent>
          <TabsContent value="receipts"><EditableFinanceReportTab title="Receipts" description="Incoming cash flow." entries={financialData.allReceipts} loading={financeEntriesLoading} /></TabsContent>
          <TabsContent value="payouts"><EditableFinanceReportTab title="Payouts" description="Outgoing cash flow." entries={financialData.allPayouts} loading={financeEntriesLoading} /></TabsContent>
          <TabsContent value="investors"><InvestorsPortfolioTab /></TabsContent>
          <TabsContent value="staff"><StaffPortfoliosTab loans={loans} staffList={staffList}/></TabsContent>
      </Tabs>

      {/* Repayment History Dialog */}
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
