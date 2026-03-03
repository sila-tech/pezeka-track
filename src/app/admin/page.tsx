'use client';

import { useMemo, useState } from 'react';
import { useAppUser, useCollection, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, UserCheck, Send, MessageSquare, Briefcase, CalendarDays } from 'lucide-react';
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
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
  disbursementDate: { seconds: number; nanoseconds: number };
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

  const isAuthorized = user ? (user.email === 'simon@pezeka.com' || user.role === 'staff' || user.role === 'finance') : false;
  const isStaffMember = user?.role === 'staff' || user?.role === 'finance' || user?.email === 'simon@pezeka.com';

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
      return loans.filter(loan => loan.assignedStaffId === user.uid && loan.status !== 'application' && loan.status !== 'rejected');
  }, [loans, user]);

  const stats = useMemo(() => {
    if (!loans) return { realizedRevenue: 0, disbursedCount: 0 };
    let realizedRevenue = 0;
    let disbursedCount = 0;
    loans.forEach(loan => {
        if (loan.status !== 'application' && loan.status !== 'rejected') {
            disbursedCount++;
            realizedRevenue += (Number(loan.registrationFee) || 0) + (Number(loan.processingFee) || 0) + (Number(loan.carTrackInstallationFee) || 0) + (Number(loan.chargingCost) || 0);
            if (loan.totalPaid > loan.principalAmount) realizedRevenue += (loan.totalPaid - loan.principalAmount);
        }
    });
    return { realizedRevenue, disbursedCount };
  }, [loans]);

  const myPortfolioStats = useMemo(() => {
      const activeLoans = myPortfolio.filter(l => l.status !== 'paid');
      const totalDisbursed = myPortfolio.reduce((acc, l) => acc + (Number(l.principalAmount) || 0), 0);
      const totalCollected = myPortfolio.reduce((acc, l) => acc + (Number(l.totalPaid) || 0), 0);
      return { activeCount: activeLoans.length, totalDisbursed, totalCollected };
  }, [myPortfolio]);

  const dueLoans = useMemo(() => {
    if (!loans) return [];
    const today = startOfToday();
    
    return loans.filter(loan => loan.status !== 'paid' && loan.status !== 'application' && loan.status !== 'rejected').map(loan => {
        const dDate = new Date(loan.disbursementDate.seconds * 1000);
        
        const paidInstalments = Math.floor(loan.totalPaid / (loan.instalmentAmount || 1));
        const allInstalmentsPaid = loan.totalPaid >= loan.totalRepayableAmount || paidInstalments >= loan.numberOfInstalments;
        
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
    return loans.filter(loan => loan.status === 'application').sort((a, b) => b.disbursementDate.seconds - a.disbursementDate.seconds);
  }, [loans]);
  
  if (userLoading || loansLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name || user?.email?.split('@')[0] || 'Admin'}!</h1>
        {isStaffMember && (
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
                        <FormItem><FormLabel>Alt. Phone</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>
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
        )}
      </div>

      {(user?.role === 'staff' || user?.email === 'simon@pezeka.com') && (
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
         {(user?.email === 'simon@pezeka.com' || user?.role === 'finance') && (
           <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Realized Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">Ksh {(stats?.realizedRevenue || 0).toLocaleString()}</div></CardContent></Card>
         )}
         <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Loans Disbursed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.disbursedCount || 0}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col h-[600px]">
            <CardHeader className="pb-2">
                <CardTitle>Due Loans & Follow-ups</CardTitle>
                <CardDescription>Accounts requiring immediate attention based on frequency.</CardDescription>
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
                                                <TableHead>Customer</TableHead>
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
                                                            <div className="font-medium text-xs">{loan.customerName}</div>
                                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1"><CalendarDays className="h-2 w-2"/> {loan.paymentFrequency}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="text-xs font-semibold">{format(loan.nextDueDate, 'dd/MM/yy')}</div>
                                                            <Badge variant={daysDue < 0 ? 'destructive' : 'secondary'} className="text-[9px]">{daysDue < 0 ? `LATE ${Math.abs(daysDue)}d` : (daysDue === 0 ? 'TODAY' : `In ${daysDue}d`)}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-xs text-blue-600">Ksh {loan.instalmentAmount.toLocaleString()}</TableCell>
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
                                                <TableHead>Next Due</TableHead>
                                                <TableHead className="text-right">Instalment</TableHead>
                                                <TableHead className="text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dailyDue.map((loan) => (
                                                <TableRow key={loan.id}>
                                                    <TableCell><div className="font-medium text-xs">{loan.customerName}</div></TableCell>
                                                    <TableCell><div className="text-xs font-semibold">{format(loan.nextDueDate, 'dd/MM/yy')}</div></TableCell>
                                                    <TableCell className="text-right font-bold text-xs">Ksh {loan.instalmentAmount.toLocaleString()}</TableCell>
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
                                                <TableHead>Next Due</TableHead>
                                                <TableHead className="text-right">Instalment</TableHead>
                                                <TableHead className="text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {weeklyDue.map((loan) => (
                                                <TableRow key={loan.id}>
                                                    <TableCell><div className="font-medium text-xs">{loan.customerName}</div></TableCell>
                                                    <TableCell><div className="text-xs font-semibold">{format(loan.nextDueDate, 'dd/MM/yy')}</div></TableCell>
                                                    <TableCell className="text-right font-bold text-xs">Ksh {loan.instalmentAmount.toLocaleString()}</TableCell>
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

        {user?.role === 'staff' ? (
            <Card className="flex flex-col h-[600px]"><CardHeader><CardTitle>My Portfolio</CardTitle></CardHeader><CardContent className="flex-1 overflow-hidden"><ScrollArea className="h-full"><Table><TableHeader className="sticky top-0 bg-card z-10"><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader><TableBody>{myPortfolio.map(loan => (<TableRow key={loan.id}><TableCell><div className="font-medium text-xs">{loan.customerName}</div><div className="text-[9px] text-muted-foreground uppercase">{loan.paymentFrequency}</div></TableCell><TableCell className="text-right font-bold text-xs">Ksh {(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}</TableCell><TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{loan.status}</Badge></TableCell></TableRow>))}</TableBody></Table></ScrollArea></CardContent></Card>
        ) : (
            <Card className="flex flex-col h-[600px]"><CardHeader><CardTitle>New Applications</CardTitle></CardHeader><CardContent className="flex-1 overflow-hidden">
                    {newApplications.length === 0 ? (<Alert><AlertTitle>No New Applications</AlertTitle></Alert>) : (
                        <ScrollArea className="h-full"><Table><TableHeader className="sticky top-0 bg-card z-10"><TableRow><TableHead>Customer</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{newApplications.map((loan) => (<TableRow key={loan.id}><TableCell><div>{loan.customerName}</div></TableCell><TableCell>{loan.loanType}</TableCell><TableCell className="text-right font-bold">Ksh {loan.principalAmount.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></ScrollArea>
                    )}
                </CardContent></Card>
        )}
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
                                <div className="space-y-3">{[...selectedLoanForNotes.followUpNotes].reverse().map((note, index) => (
                                        <div key={note.noteId || index} className="bg-muted/50 p-2 rounded border text-xs"><div className="flex justify-between items-center mb-1"><span className="font-bold">{note.staffName}</span><span className="text-[9px]">{format(note.date instanceof Date ? note.date : new Date((note.date as any).seconds * 1000), 'dd/MM HH:mm')}</span></div><p className="italic">"{note.content}"</p></div>
                                    ))}</div>
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
