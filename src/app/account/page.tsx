
'use client';
import { useUser, useAuth, useCollection, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Landmark, LogOut, Loader2, FileUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { collection, query, where } from 'firebase/firestore';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { addLoan } from '@/lib/firestore';
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

const applicationSchema = z.object({
  loanType: z.string({ required_error: 'Please select a loan type.' }),
  loanAmount: z.coerce.number().min(1, 'Please enter a valid loan amount.'),
  idNumber: z.string().min(5, 'Please enter a valid ID number.'),
  phone: z.string().min(10, 'Please enter a valid phone number.'),
  alternativeNumber: z.string().optional(),
  statement: z.any().optional(),
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

  const customerLoansQuery = useMemo(() => {
    if (userLoading || !firestore || !user?.uid) return null;
    return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [firestore, user?.uid, userLoading]);

  const { data: customerLoans, loading: loansLoading } = useCollection<Loan>(customerLoansQuery);

  const applicationForm = useForm<z.infer<typeof applicationSchema>>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      loanType: undefined,
      loanAmount: undefined,
      idNumber: '',
      phone: user?.phoneNumber || '',
      alternativeNumber: '',
      statement: undefined,
      agreeToTerms: false,
    },
  });

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  async function onApplicationSubmit(values: z.infer<typeof applicationSchema>) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not logged in",
        description: "You must be logged in to apply for a loan.",
      });
      return;
    }
    setIsSubmitting(true);
    
    try {
      const loanApplicationData = {
        customerId: user.uid,
        customerName: user.displayName || user.email,
        customerPhone: values.phone,
        alternativeNumber: values.alternativeNumber || "",
        idNumber: values.idNumber,
        disbursementDate: new Date(),
        principalAmount: values.loanAmount,
        interestRate: 0, 
        registrationFee: 0,
        processingFee: 0,
        carTrackInstallationFee: 0,
        chargingCost: 0,
        numberOfInstalments: values.loanType === 'Quick Pesa' ? 1 : 1, 
        paymentFrequency: values.loanType === 'Quick Pesa' ? 'monthly' as const : 'monthly' as const,
        status: 'application' as const,
        loanType: values.loanType,
        instalmentAmount: values.loanAmount,
        totalRepayableAmount: values.loanAmount, 
        totalPaid: 0,
        comments: `Application for ${values.loanType}.`,
      };
      
      await addLoan(firestore, loanApplicationData);

      toast({
        title: "Application Submitted",
        description: "Your application has been submitted. Our team will review it shortly.",
      });

      applicationForm.reset();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Application failed',
        description: e.message || 'Could not submit your application.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
            <Landmark className="h-6 w-6 text-primary" />
            <span>Customer Portal</span>
        </div>
        <div className="ml-auto">
            <Button onClick={handleLogout} variant="outline">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
            </Button>
        </div>
      </header>
      <main className="p-4 sm:px-6 sm:py-0">
          <Card>
            <CardHeader>
                <CardTitle>Welcome, {user?.displayName || user?.email || user?.phoneNumber}!</CardTitle>
                <CardDescription>
                    Summary of your loan accounts.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loansLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (customerLoans && customerLoans.length > 0) ? (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Your Loans</h3>
                        {customerLoans.map(loan => {
                            const balance = loan.totalRepayableAmount - loan.totalPaid;
                            return (
                                <Card key={loan.id}>
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle>Loan #{loan.loanNumber}</CardTitle>
                                                <CardDescription>
                                                    {loan.status === 'application' 
                                                      ? `Applied for ${loan.loanType || 'Loan'} on: ${format(new Date(loan.disbursementDate.seconds * 1000), 'PPP')}`
                                                      : `Disbursed on: ${format(new Date(loan.disbursementDate.seconds * 1000), 'PPP')}`
                                                    }
                                                </CardDescription>
                                            </div>
                                            <Badge variant={loan.status === 'paid' ? 'default' : (loan.status === 'due' || loan.status === 'overdue' || loan.status === 'rejected') ? 'destructive' : 'secondary'}>
                                                {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <div>
                                                <div className="text-sm text-muted-foreground">Principal</div>
                                                <div className="font-semibold">Ksh {loan.principalAmount.toLocaleString()}</div>
                                            </div>
                                             <div>
                                                <div className="text-sm text-muted-foreground">Total Repayable</div>
                                                <div className="font-semibold">Ksh {loan.totalRepayableAmount.toLocaleString()}</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-muted-foreground">Balance</div>
                                                <div className="font-bold text-lg">Ksh {balance.toLocaleString()}</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                   <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">No active loans or applications.</p>
                   </div>
                )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
                <CardTitle>Apply for a New Loan</CardTitle>
                <CardDescription>
                Select a product and submit your details.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...applicationForm}>
                <form onSubmit={applicationForm.handleSubmit(onApplicationSubmit)} className="space-y-4">
                    <FormField
                        control={applicationForm.control}
                        name="loanType"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Loan Product</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select loan product" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                <SelectItem value="Quick Pesa">Quick Pesa (1 Month)</SelectItem>
                                <SelectItem value="Individual & Business Loan">Individual & Business Short-Term Loan</SelectItem>
                                <SelectItem value="Salary Advance Loan">Salary Advance Loan</SelectItem>
                                <SelectItem value="Logbook Loan">Logbook Loan</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormField
                      control={applicationForm.control}
                      name="loanAmount"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Loan Amount Requested (Ksh)</FormLabel>
                          <FormControl>
                              <Input type="number" placeholder="e.g., 10000" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                    />
                     <FormField
                      control={applicationForm.control}
                      name="idNumber"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>National ID Number</FormLabel>
                          <FormControl>
                              <Input placeholder="Your ID Number" {...field} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                    />
                     <FormField
                      control={applicationForm.control}
                      name="phone"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Primary Phone Number</FormLabel>
                          <FormControl>
                              <Input placeholder="e.g. 0712345678" {...field} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                    />
                    <FormField
                      control={applicationForm.control}
                      name="alternativeNumber"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Alternative Phone Number (Optional)</FormLabel>
                          <FormControl>
                              <Input placeholder="Secondary contact number" {...field} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                    />
                    <FormField
                      control={applicationForm.control}
                      name="agreeToTerms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Agree to terms and conditions
                            </FormLabel>
                            <FormDescription>
                              You agree to our Data Privacy Terms and Conditions.
                            </FormDescription>
                             <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
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
