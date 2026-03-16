'use client';
import { useUser, useAuth, useCollection, useFirestore, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, LogOut, Loader2, FileUp, History, CalendarDays, Wallet, ArrowRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { format, addDays, addWeeks, addMonths, isBefore, startOfToday } from 'date-fns';
import { collection, query, where } from 'firebase/firestore';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { addLoan, upsertCustomer } from '@/lib/firestore';
import { calculateAmortization } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';


interface Payment {
  paymentId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
}

interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  alternativeNumber?: string;
  idNumber?: string;
  loanType?: string;
  disbursementDate: { seconds: number, nanoseconds: number };
  principalAmount: number;
  interestRate?: number;
  registrationFee: number;
  processingFee: number;
  carTrackInstallationFee: number;
  chargingCost: number;
  numberOfInstalments: number;
  instalmentAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  payments?: Payment[];
  comments?: string;
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
}

interface Customer {
    id: string;
    accountNumber?: string;
    name: string;
    phone: string;
    email?: string;
}

const applicationSchema = z.object({
  loanType: z.string({ required_error: 'Please select a loan type.' }),
  loanAmount: z.coerce.number().min(1, 'Please enter a valid loan amount.'),
  numberOfInstalments: z.coerce.number().min(1, 'Please enter number of instalments.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  idNumber: z.string().min(5, 'Please enter a valid ID number.'),
  phone: z.string().min(10, 'Please enter a valid phone number.'),
  alternativeNumber: z.string().optional(),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions.' }),
  }),
});


export default function AccountPage() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState<Loan | null>(null);
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false);

  const { data: customerProfile, loading: profileLoading } = useDoc<Customer>(user ? `customers/${user.uid}` : null);

  const customerLoansQuery = useMemo(() => {
    if (userLoading || !firestore || !user?.uid) return null;
    return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [firestore, user?.uid, userLoading]);

  const { data: customerLoans, loading: loansLoading } = useCollection<Loan>(customerLoansQuery);

  const firstName = useMemo(() => {
      const fullName = customerProfile?.name || user?.displayName || "";
      return fullName.split(' ')[0] || "there";
  }, [customerProfile, user]);

  const applicationForm = useForm<z.infer<typeof applicationSchema>>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      loanType: 'Quick Pesa',
      loanAmount: 0,
      numberOfInstalments: 1,
      paymentFrequency: 'monthly',
      idNumber: '',
      phone: user?.phoneNumber || '',
      alternativeNumber: '',
      agreeToTerms: false as any,
    },
  });

  useEffect(() => {
    const pendingData = sessionStorage.getItem('pendingLoanApplication');
    if (pendingData) {
      try {
        const data = JSON.parse(pendingData);
        applicationForm.setValue('loanAmount', data.amount);
        applicationForm.setValue('numberOfInstalments', data.period);
        applicationForm.setValue('paymentFrequency', data.frequency);
        if (data.loanType) applicationForm.setValue('loanType', data.loanType);
        sessionStorage.removeItem('pendingLoanApplication');
      } catch (e) {
        console.error("Failed to parse pending loan data", e);
      }
    }
  }, [applicationForm]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  async function onApplicationSubmit(values: z.infer<typeof applicationSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const fullName = user.displayName || user.email || "Customer";
      await upsertCustomer(firestore, user.uid, { name: fullName, phone: values.phone, idNumber: values.idNumber });
      
      const interestRate = (values.loanType === 'Individual & Business Loan') ? 5 : 10;
      const { instalmentAmount, totalRepayableAmount } = calculateAmortization(values.loanAmount, interestRate, values.numberOfInstalments, values.paymentFrequency);

      const loanApplicationData = {
        customerId: user.uid,
        customerName: fullName,
        customerPhone: values.phone,
        alternativeNumber: values.alternativeNumber || "",
        idNumber: values.idNumber,
        disbursementDate: new Date(),
        principalAmount: values.loanAmount,
        interestRate: interestRate, 
        registrationFee: 0,
        processingFee: 0,
        carTrackInstallationFee: 0,
        chargingCost: 0,
        numberOfInstalments: values.numberOfInstalments, 
        paymentFrequency: values.paymentFrequency,
        status: 'application' as const,
        loanType: values.loanType,
        instalmentAmount: instalmentAmount, 
        totalRepayableAmount: totalRepayableAmount, 
        totalPaid: 0,
        comments: `Application for ${values.loanType} from web portal.`
      };
      
      await addLoan(firestore, loanApplicationData);
      toast({ title: "Application Submitted", description: "Our team will review your application and get back to you." });
      applicationForm.reset();
    } catch (e: any) { 
        toast({ variant: 'destructive', title: 'Failed', description: e.message }); 
    } finally { 
        setIsSubmitting(false); 
    }
  }

  const getNextDueDate = (loan: Loan) => {
      try {
          const dDate = loan.disbursementDate?.seconds 
            ? new Date(loan.disbursementDate.seconds * 1000) 
            : (loan.disbursementDate ? new Date(loan.disbursementDate as any) : new Date());
          
          if (isNaN(dDate.getTime())) return null;

          const paidInstalments = Math.floor((loan.totalPaid || 0) / (loan.instalmentAmount || 1));
          const nextIdx = paidInstalments + 1;
          
          if (loan.paymentFrequency === 'daily') return addDays(dDate, nextIdx);
          if (loan.paymentFrequency === 'weekly') return addWeeks(dDate, nextIdx);
          return addMonths(dDate, nextIdx);
      } catch (e) {
          return null;
      }
  };

  const getStatusConfig = (status: string, nextDue: Date | null) => {
      const today = startOfToday();
      if (status === 'paid') return { label: 'PAID', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle2 className="h-3 w-3" /> };
      if (status === 'application') return { label: 'PENDING APPROVAL', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="h-3 w-3" /> };
      if (status === 'rejected') return { label: 'REJECTED', color: 'bg-red-100 text-red-700 border-red-200', icon: <AlertCircle className="h-3 w-3" /> };
      
      if (nextDue && isBefore(nextDue, today)) return { label: 'OVERDUE', color: 'bg-red-600 text-white border-red-700', icon: <AlertCircle className="h-3 w-3" /> };
      if (status === 'due') return { label: 'DUE SOON', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Clock className="h-3 w-3" /> };
      
      return { label: 'ACTIVE', color: 'bg-green-600 text-white border-green-700', icon: <CheckCircle2 className="h-3 w-3" /> };
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
        <div className="flex items-center gap-2 font-bold text-xl"><img src="/pezeka_logo_transparent.png" alt="Pezeka" className="h-8 w-8 object-contain" /><span className="hidden sm:inline text-primary">Customer Portal</span></div>
        <div className="ml-auto"><Button onClick={handleLogout} variant="outline" size="sm" className="rounded-full"><LogOut className="mr-2 h-4 w-4" />Logout</Button></div>
      </header>
      
      <main className="p-4 sm:px-6 sm:py-0 max-w-6xl mx-auto w-full space-y-8">
          <section>
            <div className="mb-6">
                <h1 className="text-3xl font-black tracking-tight">Welcome back, <span className="text-primary">{firstName}</span>!</h1>
                <p className="text-muted-foreground">Here is a quick overview of your account and loan status.</p>
            </div>

            {customerProfile?.accountNumber && (
                <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10 mb-6 w-fit">
                    <div className="bg-primary text-white p-2 rounded-lg"><Wallet className="h-5 w-5" /></div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none mb-1">My Account Number</p>
                        <p className="text-lg font-mono font-black text-primary">{customerProfile.accountNumber}</p>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <div className="h-6 w-1 bg-primary rounded-full" />
                    My Loan Portfolio
                </h3>
                {loansLoading ? (<div className="flex items-center justify-center p-12 bg-white rounded-2xl border"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : (customerLoans && customerLoans.length > 0) ? (
                    <div className="grid gap-4">
                        {customerLoans.map(loan => {
                            const balance = (loan.totalRepayableAmount || 0) - (loan.totalPaid || 0);
                            const nextDue = getNextDueDate(loan);
                            const status = getStatusConfig(loan.status, nextDue);
                            
                            const dDate = loan.disbursementDate?.seconds 
                                ? new Date(loan.disbursementDate.seconds * 1000) 
                                : (loan.disbursementDate ? new Date(loan.disbursementDate as any) : new Date());
                            
                            const dateLabel = loan.status === 'application' ? 'Applied' : 'Disbursed';
                            const dateValue = isNaN(dDate.getTime()) ? 'N/A' : format(dDate, 'PP');

                            return (
                                <Card key={loan.id} className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 group">
                                    <div className={`h-1.5 w-full ${status.color.split(' ')[0]}`} />
                                    <CardHeader className="pb-4">
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <CardTitle className="text-xl font-black">Loan #{loan.loanNumber}</CardTitle>
                                                    <Badge className={`rounded-full px-3 py-0.5 text-[10px] font-black border uppercase flex items-center gap-1 ${status.color}`}>
                                                        {status.icon}
                                                        {status.label}
                                                    </Badge>
                                                </div>
                                                <CardDescription className="text-xs font-medium flex items-center gap-1">
                                                    {dateLabel} on {dateValue} • {loan.loanType}
                                                </CardDescription>
                                            </div>
                                            {loan.status !== 'paid' && loan.status !== 'application' && loan.status !== 'rejected' && (
                                                <Button onClick={() => setShowPaymentInstructions(true)} className="w-full sm:w-auto rounded-full font-black shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                                                    Pay Now
                                                    <ArrowRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid gap-6 grid-cols-1 sm:grid-cols-3 bg-muted/30 p-6 rounded-2xl">
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Remaining Balance</p>
                                                <p className="text-2xl font-black text-primary">Ksh {balance.toLocaleString()}</p>
                                            </div>
                                            
                                            {loan.status !== 'paid' && loan.status !== 'application' && loan.status !== 'rejected' && (
                                                <>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-1">Next Payment Due</p>
                                                        <p className="text-lg font-black">{nextDue ? format(nextDue, 'PPP') : 'N/A'}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Amount Due</p>
                                                        <p className="text-lg font-black">Ksh {(loan.instalmentAmount || 0).toLocaleString()}</p>
                                                    </div>
                                                </>
                                            )}
                                            
                                            {loan.status === 'application' && (
                                                <div className="sm:col-span-2 flex items-center text-sm font-medium text-muted-foreground italic">
                                                    Your application is currently being appraised by our credit committee.
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedLoanForHistory(loan)} className="text-xs font-bold text-muted-foreground hover:text-primary">
                                                <History className="mr-2 h-4 w-4" />
                                                View Payment History
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-white border-2 border-dashed rounded-3xl">
                        <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Landmark className="h-8 w-8 text-primary/40" />
                        </div>
                        <h4 className="text-lg font-bold">No active loans</h4>
                        <p className="text-muted-foreground max-w-xs mx-auto text-sm">You don't have any active loans or applications at the moment. Use the form below to apply.</p>
                    </div>
                )}
            </div>
          </section>

          <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground p-8">
                <CardTitle className="text-2xl font-black">Apply for a New Loan</CardTitle>
                <CardDescription className="text-primary-foreground/80 font-medium">Get instant capital for your personal or business needs.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                <Form {...applicationForm}>
                <form onSubmit={applicationForm.handleSubmit(onApplicationSubmit)} className="space-y-6">
                    <FormField control={applicationForm.control} name="loanType" render={({ field }) => (
                        <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Loan Product</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl border-2"><SelectValue placeholder="Select product" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Quick Pesa">Quick Pesa (1 Month)</SelectItem><SelectItem value="Individual & Business Loan">Individual & Business Loan</SelectItem><SelectItem value="Salary Advance Loan">Salary Advance</SelectItem><SelectItem value="Logbook Loan">Logbook Loan</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={applicationForm.control} name="loanAmount" render={({ field }) => (
                          <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Requested Amount (Ksh)</FormLabel><FormControl><Input type="number" placeholder="e.g. 5000" {...field} value={field.value ?? ''} className="h-12 rounded-xl border-2" /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField control={applicationForm.control} name="idNumber" render={({ field }) => (
                          <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">National ID Number</FormLabel><FormControl><Input placeholder="ID Card Number" {...field} value={field.value ?? ''} className="h-12 rounded-xl border-2" /></FormControl><FormMessage /></FormItem>
                      )}/>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={applicationForm.control} name="numberOfInstalments" render={({ field }) => (
                          <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Instalments</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-12 rounded-xl border-2" /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField control={applicationForm.control} name="paymentFrequency" render={({ field }) => (
                          <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl border-2"><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={applicationForm.control} name="phone" render={({ field }) => (
                          <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Phone Number</FormLabel><FormControl><Input placeholder="0712 345 678" {...field} value={field.value ?? ''} className="h-12 rounded-xl border-2" /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField control={applicationForm.control} name="alternativeNumber" render={({ field }) => (
                          <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Alternative Phone (Optional)</FormLabel><FormControl><Input placeholder="Second contact" {...field} value={field.value ?? ''} className="h-12 rounded-xl border-2" /></FormControl></FormItem>
                      )}/>
                    </div>
                    <FormField control={applicationForm.control} name="agreeToTerms" render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 rounded-2xl border-2 p-6 bg-muted/30"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="leading-none"><FormLabel className="font-bold text-sm">I agree to the terms and conditions of Pezeka Credit Ltd.</FormLabel><FormDescription className="text-[10px] mt-1">By submitting this form, you authorize our team to verify your information.</FormDescription><FormMessage /></div></FormItem>
                    )}/>
                    <Button type="submit" size="lg" className="w-full h-16 text-xl font-black rounded-2xl shadow-xl shadow-primary/20" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <FileUp className="mr-2 h-6 w-6" />}
                        Submit Application
                    </Button>
                </form>
                </Form>
            </CardContent>
          </Card>
      </main>

      {/* Pay Now Instructions Dialog */}
      <Dialog open={showPaymentInstructions} onOpenChange={setShowPaymentInstructions}>
          <DialogContent className="sm:max-w-md rounded-3xl">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black">How to Pay</DialogTitle>
                  <DialogDescription className="font-medium">Please use the details below to make your repayment via M-Pesa.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                  <div className="bg-primary/5 border-2 border-primary/10 rounded-2xl p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-primary/10 pb-3">
                          <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Paybill Number</span>
                          <span className="text-xl font-black text-primary">522522</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-primary/10 pb-3">
                          <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Account Number</span>
                          <span className="text-xl font-black text-primary">1347823360</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                          <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Reference</span>
                          <span className="text-sm font-bold bg-white px-2 py-1 rounded border">Your National ID</span>
                      </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-2 font-medium bg-muted p-4 rounded-xl">
                      <p>1. Go to M-Pesa Menu > Lipa na M-Pesa</p>
                      <p>2. Select Pay Bill and enter the Business No. above</p>
                      <p>3. Enter the Account No. and your Loan ID or National ID</p>
                      <p>4. Enter the amount and your M-Pesa PIN</p>
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={() => setShowPaymentInstructions(false)} className="w-full h-12 rounded-xl font-black">I Have Paid</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={!!selectedLoanForHistory} onOpenChange={(open) => !open && setSelectedLoanForHistory(null)}>
          <DialogContent className="sm:max-w-md rounded-3xl">
              <DialogHeader>
                  <DialogTitle className="text-xl font-black">Payment History: #{selectedLoanForHistory?.loanNumber}</DialogTitle>
                  <DialogDescription className="font-medium">List of all verified payments made for this loan.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-80 border-2 rounded-2xl p-2 bg-muted/10">
                  {(!selectedLoanForHistory?.payments || selectedLoanForHistory.payments.length === 0) ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                          <History className="h-12 w-12 text-muted-foreground/20 mb-2" />
                          <p className="text-muted-foreground text-sm font-bold italic">No payments recorded yet.</p>
                      </div>
                  ) : (
                      <Table>
                          <TableHeader>
                              <TableRow className="border-b-2">
                                  <TableHead className="font-black uppercase text-[10px]">Date</TableHead>
                                  <TableHead className="text-right font-black uppercase text-[10px]">Amount</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {selectedLoanForHistory.payments.map((p, i) => {
                                  const payDate = (p.date as any)?.seconds 
                                    ? new Date((p.date as any).seconds * 1000) 
                                    : (p.date instanceof Date ? p.date : new Date());
                                  
                                  return (
                                    <TableRow key={p.paymentId || i} className="border-b">
                                        <TableCell className="text-xs font-medium">{isNaN(payDate.getTime()) ? 'N/A' : format(payDate, 'PP')}</TableCell>
                                        <TableCell className="text-right font-black text-primary">Ksh {(p.amount || 0).toLocaleString()}</TableCell>
                                    </TableRow>
                                  );
                              })}
                          </TableBody>
                      </Table>
                  )}
              </ScrollArea>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline" className="w-full rounded-xl font-bold">Close</Button></DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}
