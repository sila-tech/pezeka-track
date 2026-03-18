'use client';

import { useMemo, useState } from 'react';
import { useAppUser, useCollection, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, UserCheck, Send, MessageSquare, Briefcase, CalendarDays, ExternalLink, ArrowRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { addDays, addWeeks, addMonths, differenceInDays, format, startOfToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { addLoan, addFollowUpNoteToLoan } from '@/lib/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

interface FollowUpNote {
    noteId: string;
    date: { seconds: number; nanoseconds: number } | Date;
    staffName: string;
    staffId: string;
    content: string;
}

interface DashboardLoan {
  id: string;
  loanNumber: string;
  customerName: string;
  customerPhone: string;
  accountNumber?: string; // Member Number
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
  disbursementDate: { seconds: number; nanoseconds: number } | any;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  numberOfInstalments: number;
  instalmentAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  principalAmount: number;
  idNumber?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  followUpNotes?: FollowUpNote[];
}

const staffLoanSchema = z.object({
  amount: z.coerce.number().min(1000, "Minimum application is Ksh 1,000"),
  idNumber: z.string().min(5, "ID Number is required."),
  alternativeNumber: z.string().optional(),
  reason: z.string().min(10, "Please provide a brief reason for the loan request."),
});

const followUpNoteSchema = z.object({
    content: z.string().min(5, "Note must be at least 5 characters long."),
});

export default function Dashboard() {
  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isStaffLoanOpen, setIsStaffLoanOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLoanForNotes, setSelectedLoanForNotes] = useState<DashboardLoan | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);

  const isAuthorized = user ? (user.email?.toLowerCase() === 'simon@pezeka.com' || user.role?.toLowerCase() === 'staff' || user.role?.toLowerCase() === 'finance' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2') : false;
  
  const { data: loans, loading: loansLoading } = useCollection<DashboardLoan>(isAuthorized ? 'loans' : null);

  const staffLoanForm = useForm<z.infer<typeof staffLoanSchema>>({
    resolver: zodResolver(staffLoanSchema),
    defaultValues: { amount: 0, reason: '', idNumber: '', alternativeNumber: '' },
  });

  const noteForm = useForm<z.infer<typeof followUpNoteSchema>>({
      resolver: zodResolver(followUpNoteSchema),
      defaultValues: { content: '' },
  });

  async function onStaffLoanSubmit(values: z.infer<typeof staffLoanSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const loanData = {
        customerId: user.uid,
        customerName: user.name || user.email?.split('@')[0] || "Staff",
        customerPhone: "Internal Staff",
        accountNumber: "STAFF",
        disbursementDate: new Date(),
        principalAmount: values.amount,
        interestRate: 0, 
        registrationFee: 0,
        processingFee: 0,
        carTrackInstallationFee: 0,
        chargingCost: 0,
        numberOfInstalments: 1,
        paymentFrequency: 'monthly' as const,
        status: 'application' as const,
        loanType: 'Staff Loan',
        instalmentAmount: values.amount,
        totalRepayableAmount: values.amount,
        totalPaid: 0,
        idNumber: values.idNumber,
        alternativeNumber: values.alternativeNumber || "",
        comments: `Staff Loan Application: ${values.reason}`,
      };
      await addLoan(firestore, loanData);
      toast({ title: "Application Submitted" });
      staffLoanForm.reset();
      setIsStaffLoanOpen(false);
    } catch (e: any) { toast({ variant: "destructive", title: "Failed", description: e.message }); } finally { setIsSubmitting(false); }
  }

  async function onAddNoteSubmit(values: z.infer<typeof followUpNoteSchema>) {
      if (!selectedLoanForNotes || !user) return;
      setIsAddingNote(true);
      try {
          await addFollowUpNoteToLoan(firestore, selectedLoanForNotes.id, { content: values.content, staffName: user.name || user.email?.split('@')[0] || "Staff", staffId: user.uid });
          toast({ title: "Note Added" });
          noteForm.reset();
      } catch (e: any) { toast({ variant: 'destructive', title: 'Action Failed', description: e.message }); } finally { setIsAddingNote(false); }
  }

  const myPortfolio = useMemo(() => {
      if (!loans || !user) return [];
      return loans.filter(loan => 
          loan.assignedStaffId === user.uid && 
          loan.status !== 'application' && 
          loan.status !== 'rejected' &&
          loan.status !== 'rollover'
      );
  }, [loans, user]);

  const stats = useMemo(() => {
    if (!loans) return { disbursedCount: 0 };
    let disbursedCount = 0;
    loans.forEach(loan => {
        if (loan.status !== 'application' && loan.status !== 'rejected') {
            disbursedCount++;
        }
    });
    return { disbursedCount };
  }, [loans]);

  const myPortfolioStats = useMemo(() => {
      const activeLoans = myPortfolio.filter(l => l.status !== 'paid' && l.status !== 'rollover');
      const totalDisbursed = myPortfolio.reduce((acc, l) => acc + (Number(l.principalAmount) || 0), 0);
      const totalCollected = myPortfolio.reduce((acc, l) => acc + (Number(l.totalPaid) || 0), 0);
      return { activeCount: activeLoans.length, totalDisbursed, totalCollected };
  }, [myPortfolio]);

  const dueLoans = useMemo(() => {
    if (!loans) return [];
    const today = startOfToday();
    
    return loans.filter(loan => 
        loan.status !== 'paid' && 
        loan.status !== 'application' && 
        loan.status !== 'rejected' &&
        loan.status !== 'rollover'
    ).map(loan => {
        let dDate: Date;
        if (loan.disbursementDate?.seconds) dDate = new Date(loan.disbursementDate.seconds * 1000);
        else if (loan.disbursementDate instanceof Date) dDate = loan.disbursementDate;
        else dDate = loan.disbursementDate ? new Date(loan.disbursementDate) : new Date();

        if (isNaN(dDate.getTime())) dDate = new Date();
        
        const paidInstalments = Math.floor((loan.totalPaid || 0) / (loan.instalmentAmount || 1));
        const allInstalmentsPaid = (loan.totalPaid || 0) >= (loan.totalRepayableAmount || 0) || (loan.numberOfInstalments > 0 && paidInstalments >= loan.numberOfInstalments);
        
        let nextDueDate: Date;
        if (allInstalmentsPaid) {
            nextDueDate = new Date(8640000000000000); 
        } else {
            const nextIdx = paidInstalments + 1;
            if (loan.paymentFrequency === 'daily') nextDueDate = addDays(dDate, nextIdx);
            else if (loan.paymentFrequency === 'weekly') nextDueDate = addWeeks(dDate, nextIdx);
            else nextDueDate = addMonths(dDate, nextIdx);
        }

        return { ...loan, nextDueDate };
      }).filter(loan => {
          const daysUntil = differenceInDays(loan.nextDueDate, today);
          const offset = loan.paymentFrequency === 'monthly' ? 7 : 2;
          return daysUntil <= offset;
      }).sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
  }, [loans]);

  const dailyDue = useMemo(() => dueLoans.filter(l => l.paymentFrequency === 'daily'), [dueLoans]);
  const weeklyDue = useMemo(() => dueLoans.filter(l => l.paymentFrequency === 'weekly'), [dueLoans]);

  const newApplications = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => loan.status === 'application').sort((a, b) => {
        const tsA = a.disbursementDate?.seconds || 0;
        const tsB = b.disbursementDate?.seconds || 0;
        return tsB - tsA;
    });
  }, [loans]);
  
  if (userLoading || loansLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name || user?.email?.split('@')[0] || 'Admin'}!</h1>
        <Dialog open={isStaffLoanOpen} onOpenChange={setIsStaffLoanOpen}>
          <DialogTrigger asChild><Button variant="secondary"><UserCheck className="mr-2 h-4 w-4" />Staff Loan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Staff Loan Application</DialogTitle>
              <DialogDescription>Apply for an internal staff credit facility.</DialogDescription>
            </DialogHeader>
            <Form {...staffLoanForm}>
              <ScrollArea className="max-h-[70vh] pr-4">
                <form id="staff-loan-form" onSubmit={staffLoanForm.handleSubmit(onStaffLoanSubmit)} className="space-y-4 py-2">
                  <FormField control={staffLoanForm.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={staffLoanForm.control} name="idNumber" render={({ field }) => (
                      <FormItem><FormLabel>ID Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={staffLoanForm.control} name="alternativeNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alt. Phone</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                      </FormItem>
                    )}/>
                  </div>
                  <FormField control={staffLoanForm.control} name="reason" render={({ field }) => (
                    <FormItem><FormLabel>Reason</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )}/>
                </form>
              </ScrollArea>
              <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="staff-loan-form" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit</Button></DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {(user?.role?.toLowerCase() === 'staff' || user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2') && (
          <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> My Portfolio Summary</h3>
              <div className="grid gap-4 md:grid-cols-3">
                  <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Assigned</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{myPortfolioStats.activeCount}</div></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Disbursed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">Ksh {myPortfolioStats.totalDisbursed.toLocaleString()}</div></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Collected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">Ksh {myPortfolioStats.totalCollected.toLocaleString()}</div></CardContent></Card>
              </div>
          </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         {(user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.role?.toLowerCase() === 'finance' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2') && (
           <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Realized Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">Ksh 0</div></CardContent></Card>
         )}
         <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Loans Disbursed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.disbursedCount || 0}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col h-[600px]">
            <CardHeader className="pb-2">
                <CardTitle>Due Loans & Follow-ups</CardTitle>
                <CardDescription>Accounts requiring immediate attention.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <Tabs defaultValue="all" className="h-full flex flex-col">
                    <div className="px-6 pb-2">
                        <TabsList className="grid grid-cols-3 w-full">
                            <TabsTrigger value="all" className="text-xs">All Due ({dueLoans.length})</TabsTrigger>
                            <TabsTrigger value="daily" className="text-xs">Daily ({dailyDue.length})</TabsTrigger>
                            <TabsTrigger value="weekly" className="text-xs">Weekly ({weeklyDue.length})</TabsTrigger>
                        </TabsList>
                    </div>
                    
                    <div className="flex-1 overflow-hidden">
                        <TabsContent value="all" className="h-full m-0 p-0">
                            {dueLoans.length === 0 ? (<div className="p-6"><Alert><AlertTitle>No Due Payments</AlertTitle></Alert></div>) : (
                                <ScrollArea className="h-full">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card z-10">
                                            <TableRow>
                                                <TableHead>Customer Identity</TableHead>
                                                <TableHead>Member No</TableHead>
                                                <TableHead>Next Due</TableHead>
                                                <TableHead className="text-right">Due Amt</TableHead>
                                                <TableHead className="text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dueLoans.map((loan) => {
                                                const daysDue = differenceInDays(loan.nextDueDate, startOfToday());
                                                return (
                                                    <TableRow key={loan.id}>
                                                        <TableCell>
                                                            <div className="font-bold text-xs">{loan.customerName}</div>
                                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">Ph: {loan.customerPhone}</div>
                                                            <div className="text-[10px] text-muted-foreground font-medium uppercase">ID: {loan.idNumber || 'N/A'}</div>
                                                        </TableCell>
                                                        <TableCell className="text-xs font-bold text-primary">{loan.accountNumber || 'N/A'}</TableCell>
                                                        <TableCell>
                                                            <div className="text-xs font-semibold">{format(loan.nextDueDate, 'dd/MM/yy')}</div>
                                                            <Badge variant={daysDue < 0 ? 'destructive' : 'secondary'} className="text-[9px]">{daysDue < 0 ? `LATE ${Math.abs(daysDue)}d` : (daysDue === 0 ? 'TODAY' : `In ${daysDue}d`)}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-xs text-blue-600">Ksh {(loan.instalmentAmount || 0).toLocaleString()}</TableCell>
                                                        <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => setSelectedLoanForNotes(loan)}><MessageSquare className="h-4 w-4 text-blue-600" /></Button></TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            )}
                        </TabsContent>
                        <TabsContent value="daily" className="h-full m-0 p-0">
                            {dailyDue.length === 0 ? (<div className="p-6"><Alert><AlertTitle>No Daily Payments</AlertTitle></Alert></div>) : (
                                <ScrollArea className="h-full">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card z-10">
                                            <TableRow>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Member No</TableHead>
                                                <TableHead>Next Due</TableHead>
                                                <TableHead className="text-right">Due Amt</TableHead>
                                                <TableHead className="text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dailyDue.map((loan) => (
                                                <TableRow key={loan.id}>
                                                    <TableCell><div className="font-medium text-xs">{loan.customerName}</div></TableCell>
                                                    <TableCell className="text-xs font-bold">{loan.accountNumber}</TableCell>
                                                    <TableCell><div className="text-xs font-semibold">{format(loan.nextDueDate, 'dd/MM/yy')}</div></TableCell>
                                                    <TableCell className="text-right font-bold text-xs">Ksh {(loan.instalmentAmount || 0).toLocaleString()}</TableCell>
                                                    <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => setSelectedLoanForNotes(loan)}><MessageSquare className="h-4 w-4 text-blue-600" /></Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            )}
                        </TabsContent>
                        <TabsContent value="weekly" className="h-full m-0 p-0">
                            {weeklyDue.length === 0 ? (<div className="p-6"><Alert><AlertTitle>No Weekly Payments</AlertTitle></Alert></div>) : (
                                <ScrollArea className="h-full">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card z-10">
                                            <TableRow>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Member No</TableHead>
                                                <TableHead>Next Due</TableHead>
                                                <TableHead className="text-right">Due Amt</TableHead>
                                                <TableHead className="text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {weeklyDue.map((loan) => (
                                                <TableRow key={loan.id}>
                                                    <TableCell><div className="font-medium text-xs">{loan.customerName}</div></TableCell>
                                                    <TableCell className="text-xs font-bold">{loan.accountNumber}</TableCell>
                                                    <TableCell><div className="text-xs font-semibold">{format(loan.nextDueDate, 'dd/MM/yy')}</div></TableCell>
                                                    <TableCell className="text-right font-bold text-xs">Ksh {(loan.instalmentAmount || 0).toLocaleString()}</TableCell>
                                                    <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => setSelectedLoanForNotes(loan)}><MessageSquare className="h-4 w-4 text-blue-600" /></Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>

        <Card className="flex flex-col h-[600px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>New Applications</CardTitle>
                    <CardDescription>Latest customer self-submissions.</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/admin/loans">
                        Review All <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                {newApplications.length === 0 ? (
                    <div className="p-6 text-center">
                        <Alert><AlertTitle>No Pending Applications</AlertTitle></Alert>
                    </div>
                ) : (
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Identity & Phone</TableHead>
                                    <TableHead>Member No</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {newApplications.map((loan) => (
                                    <TableRow key={loan.id} className="group">
                                        <TableCell>
                                            <div className="font-bold text-xs">{loan.customerName}</div>
                                            <div className="text-[10px] text-muted-foreground">Ph: {loan.customerPhone}</div>
                                            <div className="text-[10px] text-muted-foreground">ID: {loan.idNumber || 'N/A'}</div>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-primary">{loan.accountNumber || 'N/A'}</TableCell>
                                        <TableCell className="text-right font-bold text-xs tabular-nums text-green-600">
                                            KES {(loan.principalAmount || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                                <Link href="/admin/loans">
                                                    <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedLoanForNotes} onOpenChange={(open) => !open && setSelectedLoanForNotes(null)}>
          <DialogContent className="sm:max-w-md">
              {selectedLoanForNotes && (
                  <>
                    <DialogHeader>
                        <DialogTitle className="text-lg">Follow-up: {selectedLoanForNotes.customerName}</DialogTitle>
                        <DialogDescription>Record customer interactions and check recent history.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <Form {...noteForm}>
                            <form onSubmit={noteForm.handleSubmit(onAddNoteSubmit)} className="space-y-2">
                                <FormField control={noteForm.control} name="content" render={({field}) => (<FormItem><FormControl><Textarea placeholder="Notes..." className="h-16 text-sm" {...field} value={field.value ?? ''} /></FormControl></FormItem>)}/>
                                <Button type="submit" className="w-full" size="sm" disabled={isAddingNote}>Save Note</Button>
                            </form>
                        </Form>
                        <ScrollArea className="h-48 border rounded-md p-3">
                            {(!selectedLoanForNotes.followUpNotes || selectedLoanForNotes.followUpNotes.length === 0) ? (<p className="text-xs text-muted-foreground text-center py-8 italic">No interactions.</p>) : (
                                <div className="space-y-3">{[...selectedLoanForNotes.followUpNotes].reverse().map((note, index) => {
                                        let nDate: Date;
                                        if ((note.date as any)?.seconds) nDate = new Date((note.date as any).seconds * 1000);
                                        else if (note.date instanceof Date) nDate = note.date;
                                        else nDate = note.date ? new Date(note.date) : new Date();

                                        return (
                                            <div key={note.noteId || index} className="bg-muted/50 p-2 rounded border text-xs"><div className="flex justify-between items-center mb-1"><span className="font-bold">{note.staffName}</span><span className="text-[9px]">{isNaN(nDate.getTime()) ? 'N/A' : format(nDate, 'dd/MM HH:mm')}</span></div><p className="italic">"{note.content}"</p></div>
                                        );
                                    })}</div>
                            )}
                        </ScrollArea>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="outline" size="sm" className="w-full">Close</Button></DialogClose></DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>
    </div>
  );
}
