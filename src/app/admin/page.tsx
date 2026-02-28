'use client';

import { useMemo, useState } from 'react';
import { useAppUser, useCollection, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bell, Loader2, TrendingUp, HandCoins, UserCheck, Send, MessageSquare, Plus, User, CheckCircle2, Briefcase } from 'lucide-react';
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
  totalRepayableAmount: number;
  totalPaid: number;
  principalAmount: number;
  registrationFee?: number;
  processingFee?: number;
  carTrackInstallationFee?: number;
  chargingCost?: number;
  loanType?: string;
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
  const isStaffMember = user?.role === 'staff' || user?.role === 'finance';

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
      toast({
        title: "Application Submitted",
        description: "Your staff loan application has been sent to Finance for review.",
      });
      staffLoanForm.reset();
      setIsStaffLoanOpen(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Application Failed",
        description: e.message || "Could not submit application.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onAddNoteSubmit(values: z.infer<typeof followUpNoteSchema>) {
      if (!selectedLoanForNotes || !user) return;
      setIsAddingNote(true);
      try {
          await addFollowUpNoteToLoan(firestore, selectedLoanForNotes.id, {
              content: values.content,
              staffName: user.name || user.email?.split('@')[0] || "Staff",
              staffId: user.uid,
          });
          toast({ title: "Note Added", description: "Follow-up note has been recorded." });
          noteForm.reset();
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
      } finally {
          setIsAddingNote(false);
      }
  }

  const myPortfolio = useMemo(() => {
      if (!loans || !user) return [];
      // Only show disbursed loans in the portfolio list
      return loans.filter(loan => 
        loan.assignedStaffId === user.uid && 
        loan.status !== 'application' && 
        loan.status !== 'rejected'
      );
  }, [loans, user]);

  const stats = useMemo(() => {
    if (!loans) return { realizedRevenue: 0, disbursedCount: 0 };
    
    let realizedRevenue = 0;
    let disbursedCount = 0;
    
    loans.forEach(loan => {
        if (loan.status !== 'application' && loan.status !== 'rejected') {
            disbursedCount++;
            const upfrontFees = (Number(loan.registrationFee) || 0) + 
                               (Number(loan.processingFee) || 0) + 
                               (Number(loan.carTrackInstallationFee) || 0) + 
                               (Number(loan.chargingCost) || 0);
            
            realizedRevenue += upfrontFees;
            if (loan.totalPaid > loan.principalAmount) {
                realizedRevenue += (loan.totalPaid - loan.principalAmount);
            }
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
    
    return loans
      .filter(loan => loan.status !== 'paid' && loan.status !== 'application' && loan.status !== 'rejected')
      .map(loan => {
        const disbursementDate = new Date(loan.disbursementDate.seconds * 1000);
        let endDate: Date;
        try {
            switch (loan.paymentFrequency) {
                case 'daily': endDate = addDays(disbursementDate, loan.numberOfInstalments); break;
                case 'weekly': endDate = addWeeks(disbursementDate, loan.numberOfInstalments); break;
                case 'monthly': endDate = addMonths(disbursementDate, loan.numberOfInstalments); break;
                default: endDate = new Date('invalid');
            }
        } catch(e) { endDate = new Date('invalid'); }
        return { ...loan, endDate };
      })
      .filter(loan => {
        if (!loan.endDate || loan.endDate.toString() === 'Invalid Date') return false;
        const daysUntilDue = differenceInDays(loan.endDate, today);
        // Identify any loan due within the next 7 days or overdue
        return daysUntilDue <= 7;
      })
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  }, [loans]);

  const newApplications = useMemo(() => {
    if (!loans) return [];
    return loans.filter(loan => loan.status === 'application').sort((a, b) => b.disbursementDate.seconds - a.disbursementDate.seconds);
  }, [loans]);
  
  const isLoading = userLoading || loansLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {user?.name || user?.email?.split('@')[0] || 'Admin'}!
        </h1>
        {isStaffMember && (
          <Dialog open={isStaffLoanOpen} onOpenChange={setIsStaffLoanOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <UserCheck className="mr-2 h-4 w-4" />
                Apply for Staff Loan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Staff Loan Application</DialogTitle>
                <DialogDescription>
                  Apply for an interest-free staff loan. Applications are reviewed by the Finance team.
                </DialogDescription>
              </DialogHeader>
              <Form {...staffLoanForm}>
                <form onSubmit={staffLoanForm.handleSubmit(onStaffLoanSubmit)} className="space-y-4 py-2">
                  <FormField
                    control={staffLoanForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Requested Amount (Ksh)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 5000" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={staffLoanForm.control}
                      name="idNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>National ID Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Your ID No." {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={staffLoanForm.control}
                      name="alternativeNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alt. Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Secondary contact" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={staffLoanForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason for Request</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Briefly describe why you need this loan..." {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit Internal Application
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {user?.role === 'staff' && (
          <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" /> My Portfolio Summary
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Assigned Loans</CardTitle></CardHeader>
                      <CardContent><div className="text-2xl font-bold">{myPortfolioStats.activeCount}</div></CardContent>
                  </Card>
                  <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Disbursed by Me</CardTitle></CardHeader>
                      <CardContent><div className="text-2xl font-bold">Ksh {myPortfolioStats.totalDisbursed.toLocaleString()}</div></CardContent>
                  </Card>
                  <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Collected by Me</CardTitle></CardHeader>
                      <CardContent><div className="text-2xl font-bold text-green-600">Ksh {myPortfolioStats.totalCollected.toLocaleString()}</div></CardContent>
                  </Card>
              </div>
          </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         {(user?.email === 'simon@pezeka.com' || user?.role === 'finance') && (
           <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Realized Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">Ksh {(stats?.realizedRevenue || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Fees and interest collected</p>
              </CardContent>
          </Card>
         )}
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loans Disbursed</CardTitle>
                <HandCoins className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats?.disbursedCount || 0}</div>
                 <p className="text-xs text-muted-foreground">Total historical count</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col h-[600px]">
            <CardHeader>
                <CardTitle>Due Loans & Follow-ups</CardTitle>
                <CardDescription>Accounts requiring attention. Click the interaction icon to add notes.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center p-8 h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : dueLoans.length === 0 ? (
                <Alert>
                    <Bell className="h-4 w-4" />
                    <AlertTitle>No Due Loans</AlertTitle>
                    <AlertDescription>All customer accounts are up to date.</AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-full">
                 <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Assigned</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dueLoans.map((loan) => {
                            const balance = loan.totalRepayableAmount - loan.totalPaid;
                            const daysDue = differenceInDays(loan.endDate, startOfToday());
                            
                            let statusVariant: "destructive" | "secondary" = daysDue <= 0 ? 'destructive' : 'secondary';

                            return (
                                <TableRow key={loan.id}>
                                    <TableCell className="font-medium">
                                      <div>{loan.customerName}</div>
                                      <div className="text-[10px] text-muted-foreground">{loan.customerPhone}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-xs">
                                            <User className="h-3 w-3" />
                                            <span>{loan.assignedStaffName || "Unassigned"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <div className="text-xs">{format(loan.endDate, 'MMM dd, yyyy')}</div>
                                        <Badge variant={statusVariant} className="text-[9px] h-4 py-0">
                                            {daysDue < 0 ? `Overdue ${Math.abs(daysDue)}d` : daysDue === 0 ? 'Today' : `In ${daysDue}d`}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-bold tabular-nums">Ksh {balance.toLocaleString()}</TableCell>
                                    <TableCell className="text-center">
                                      <Button variant="ghost" size="icon" onClick={() => setSelectedLoanForNotes(loan)}>
                                          <MessageSquare className="h-4 w-4 text-blue-600" />
                                      </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                </ScrollArea>
              )}
            </CardContent>
        </Card>

        {user?.role === 'staff' ? (
            <Card className="flex flex-col h-[600px]">
                <CardHeader>
                    <CardTitle>My Portfolio</CardTitle>
                    <CardDescription>Collection accounts assigned specifically to you.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {myPortfolio.map(loan => (
                                    <TableRow key={loan.id}>
                                        <TableCell>
                                            <div className="font-medium text-xs">{loan.customerName}</div>
                                            <div className="text-[10px] text-muted-foreground">Loan #{loan.loanNumber}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-xs">
                                            Ksh {(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="text-[10px]">{loan.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        ) : (
            <Card className="flex flex-col h-[600px]">
                <CardHeader>
                    <CardTitle>New Loan Applications</CardTitle>
                    <CardDescription>Recently applied loans, including internal staff applications.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-8 h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : newApplications.length === 0 ? (
                        <Alert>
                            <Bell className="h-4 w-4" />
                            <AlertTitle>No New Applications</AlertTitle>
                            <AlertDescription>There are currently no new loan applications to review.</AlertDescription>
                        </Alert>
                    ) : (
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {newApplications.map((loan) => (
                                        <TableRow key={loan.id}>
                                            <TableCell className="font-medium">
                                              <div>{loan.customerName}</div>
                                              <div className="text-[10px] text-muted-foreground">ID: {loan.idNumber || "N/A"}</div>
                                            </TableCell>
                                            <TableCell>
                                              {loan.loanType === 'Staff Loan' ? <Badge variant="outline">Staff Loan</Badge> : (loan.loanType || 'N/A')}
                                            </TableCell>
                                            <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'MMM dd, yyyy')}</TableCell>
                                            <TableCell className="text-right font-bold tabular-nums">Ksh {loan.principalAmount.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        )}
      </div>

      {/* Follow-up Notes Dialog */}
      <Dialog open={!!selectedLoanForNotes} onOpenChange={(open) => !open && setSelectedLoanForNotes(null)}>
          <DialogContent className="sm:max-w-md">
              {selectedLoanForNotes && (
                  <>
                    <DialogHeader>
                        <DialogTitle className="text-lg">Follow-up: {selectedLoanForNotes.customerName}</DialogTitle>
                        <DialogDescription className="text-xs">
                            Loan #{selectedLoanForNotes.loanNumber} | Balance: Ksh {(selectedLoanForNotes.totalRepayableAmount - selectedLoanForNotes.totalPaid).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div className="space-y-2">
                            <Form {...noteForm}>
                                <form onSubmit={noteForm.handleSubmit(onAddNoteSubmit)} className="space-y-2">
                                    <FormField control={noteForm.control} name="content" render={({field}) => (
                                        <FormItem>
                                            <FormControl><Textarea placeholder="What was agreed with the customer?" className="h-16 text-sm" {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <Button type="submit" className="w-full" size="sm" disabled={isAddingNote}>
                                        {isAddingNote ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-2 h-3 w-3" />}
                                        Save Note
                                    </Button>
                                </form>
                            </Form>
                        </div>
                        
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Recent Interactions</h4>
                            <ScrollArea className="h-48 border rounded-md p-3">
                                {(!selectedLoanForNotes.followUpNotes || selectedLoanForNotes.followUpNotes.length === 0) ? (
                                    <p className="text-xs text-muted-foreground text-center py-8 italic">No interactions recorded.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {[...selectedLoanForNotes.followUpNotes].sort((a, b) => {
                                            const dateA = a.date instanceof Date ? a.date.getTime() : (a.date as any).seconds * 1000;
                                            const dateB = b.date instanceof Date ? b.date.getTime() : (b.date as any).seconds * 1000;
                                            return dateB - dateA;
                                        }).map((note, index) => (
                                            <div key={note.noteId || index} className="bg-muted/50 p-2 rounded border text-xs leading-snug">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold flex items-center gap-1">
                                                        <User className="h-2 w-2" /> {note.staffName}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground">
                                                        {format(note.date instanceof Date ? note.date : new Date((note.date as any).seconds * 1000), 'dd/MM HH:mm')}
                                                    </span>
                                                </div>
                                                <p className="text-muted-foreground italic">"{note.content}"</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" size="sm" className="w-full">Close</Button></DialogClose>
                    </DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>
    </div>
  );
}
