
'use client';
import { useUser, useAuth, useCollection, useFirestore, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, LogOut, Loader2, FileUp, User as UserIcon } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
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

  const { data: customerProfile, loading: profileLoading } = useDoc<Customer>(user ? `customers/${user.uid}` : null);

  const customerLoansQuery = useMemo(() => {
    if (userLoading || !firestore || !user?.uid) return null;
    return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [firestore, user?.uid, userLoading]);

  const { data: customerLoans, loading: loansLoading } = useCollection<Loan>(customerLoansQuery);

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

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <div className="flex items-center gap-2 font-semibold"><Landmark className="h-6 w-6 text-primary" /><span>Customer Portal</span></div>
        <div className="ml-auto"><Button onClick={handleLogout} variant="outline"><LogOut className="mr-2 h-4 w-4" />Logout</Button></div>
      </header>
      <main className="p-4 sm:px-6 sm:py-0 max-w-6xl mx-auto w-full">
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Welcome, {user?.displayName || user?.email}!</CardTitle>
                    <CardDescription>Manage your account and applications.</CardDescription>
                </div>
                {customerProfile?.accountNumber && (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Account Number</span>
                        <Badge variant="outline" className="text-sm font-mono py-1 px-3 border-primary/30 text-primary">
                            {customerProfile.accountNumber}
                        </Badge>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                {loansLoading ? (<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>) : (customerLoans && customerLoans.length > 0) ? (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Your Loans</h3>
                        {customerLoans.map(loan => {
                            const balance = loan.totalRepayableAmount - loan.totalPaid;
                            return (
                                <Card key={loan.id} className="border-l-4 border-l-primary"><CardHeader className="pb-2"><div className="flex justify-between items-start"><div><CardTitle className="text-lg">Loan #{loan.loanNumber}</CardTitle><CardDescription>{loan.status === 'application' ? `Applied on: ${format(new Date(loan.disbursementDate.seconds * 1000), 'PPP')}` : `Disbursed on: ${format(new Date(loan.disbursementDate.seconds * 1000), 'PPP')}`}</CardDescription></div><Badge variant={loan.status === 'paid' ? 'default' : 'secondary'}>{loan.status.toUpperCase()}</Badge></div></CardHeader><CardContent><div className="grid gap-4 grid-cols-2 sm:grid-cols-3"><div><div className="text-xs text-muted-foreground uppercase font-bold">Principal</div><div className="font-semibold">Ksh {loan.principalAmount.toLocaleString() }</div></div><div><div className="text-xs text-muted-foreground uppercase font-bold">To Repay</div><div className="font-semibold">Ksh {loan.totalRepayableAmount.toLocaleString()}</div></div><div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 pt-2 sm:pt-0"><div className="text-xs text-muted-foreground uppercase font-bold">Current Balance</div><div className="font-bold text-xl text-primary">Ksh {balance.toLocaleString()}</div></div></div></CardContent></Card>
                            )
                        })}
                    </div>
                ) : (<div className="text-center py-12 border-2 border-dashed rounded-lg"><p className="text-muted-foreground">You don't have any active loans or applications yet.</p></div>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Apply for a New Loan</CardTitle><CardDescription>Select a product and fill in your details to start your application.</CardDescription></CardHeader>
            <CardContent>
                <Form {...applicationForm}>
                <form onSubmit={applicationForm.handleSubmit(onApplicationSubmit)} className="space-y-6">
                    <FormField control={applicationForm.control} name="loanType" render={({ field }) => (
                        <FormItem><FormLabel>Loan Product</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Quick Pesa">Quick Pesa (1 Month)</SelectItem><SelectItem value="Individual & Business Loan">Individual & Business Loan</SelectItem><SelectItem value="Salary Advance Loan">Salary Advance</SelectItem><SelectItem value="Logbook Loan">Logbook Loan</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={applicationForm.control} name="loanAmount" render={({ field }) => (
                          <FormItem><FormLabel>Requested Amount (Ksh)</FormLabel><FormControl><Input type="number" placeholder="e.g. 5000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField control={applicationForm.control} name="idNumber" render={({ field }) => (
                          <FormItem><FormLabel>National ID Number</FormLabel><FormControl><Input placeholder="ID Card Number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )}/>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={applicationForm.control} name="numberOfInstalments" render={({ field }) => (
                          <FormItem><FormLabel>Instalments</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField control={applicationForm.control} name="paymentFrequency" render={({ field }) => (
                          <FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                      )}/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={applicationForm.control} name="phone" render={({ field }) => (
                          <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="0712 345 678" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField control={applicationForm.control} name="alternativeNumber" render={({ field }) => (
                          <FormItem><FormLabel>Alternative Phone (Optional)</FormLabel><FormControl><Input placeholder="Second contact" {...field} value={field.value ?? ''} /></FormControl></FormItem>
                      )}/>
                    </div>
                    <FormField control={applicationForm.control} name="agreeToTerms" render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 rounded-md border p-4 bg-muted/30"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="leading-none"><FormLabel>I agree to the terms and conditions of Pezeka Credit Ltd.</FormLabel><FormDescription className="text-[10px]">By submitting this form, you authorize our team to verify your information.</FormDescription><FormMessage /></div></FormItem>
                    )}/>
                    <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <FileUp className="mr-2 h-5 w-5" />}
                        Submit Application
                    </Button>
                </form>
                </Form>
            </CardContent>
          </Card>
      </main>
    </>
  );
}
