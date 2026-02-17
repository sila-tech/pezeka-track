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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';


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
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue';
}

const statementSchema = z.object({
  statement: z.any().refine((files) => files?.length == 1, 'M-Pesa statement PDF is required.'),
  password: z.string().min(1, 'PDF password is required.'),
});


export default function AccountPage() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customerLoansQuery = useMemo(() => {
    if (!firestore || !user?.phoneNumber) return null;
    return query(collection(firestore, 'loans'), where('customerPhone', '==', user.phoneNumber));
  }, [firestore, user?.phoneNumber]);

  const { data: customerLoans, loading: loansLoading } = useCollection<Loan>(customerLoansQuery);

  const statementForm = useForm<z.infer<typeof statementSchema>>({
    resolver: zodResolver(statementSchema),
    defaultValues: {
      password: '',
      statement: undefined,
    },
  });

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  async function onStatementSubmit(values: z.infer<typeof statementSchema>) {
    setIsSubmitting(true);
    
    // In a real app, this is where you would handle the file upload to a service like Firebase Storage.
    // This is a placeholder to simulate the submission process.
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast({
      title: "Documents Submitted",
      description: "Your M-Pesa statement has been submitted for review. We will get back to you shortly.",
    });

    statementForm.reset();
    setIsSubmitting(false);
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
                    Here is a summary of your loan accounts.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loansLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : customerLoans && customerLoans.length > 0 ? (
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
                                                    Disbursed on: {format(new Date(loan.disbursementDate.seconds * 1000), 'PPP')}
                                                </CardDescription>
                                            </div>
                                            <Badge variant={loan.status === 'paid' ? 'default' : (loan.status === 'due' || loan.status === 'overdue') ? 'destructive' : 'secondary'}>
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
                                        {loan.payments && loan.payments.length > 0 && (
                                            <Accordion type="single" collapsible className="w-full mt-4">
                                                <AccordionItem value="item-1">
                                                    <AccordionTrigger>View Payment History</AccordionTrigger>
                                                    <AccordionContent>
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Date</TableHead>
                                                                    <TableHead className="text-right">Amount (Ksh)</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {loan.payments.sort((a,b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()).map(payment => (
                                                                    <TableRow key={payment.paymentId}>
                                                                        <TableCell>{format(new Date((payment.date as any).seconds * 1000), 'PPP')}</TableCell>
                                                                        <TableCell className="text-right">{payment.amount.toLocaleString()}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                   <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">You do not have any loans with us yet.</p>
                   </div>
                )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
                <CardTitle>Apply for a New Loan</CardTitle>
                <CardDescription>
                To apply for a new loan, please upload your latest M-Pesa statement (in PDF format) and provide the password to open it.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...statementForm}>
                <form onSubmit={statementForm.handleSubmit(onStatementSubmit)} className="space-y-4">
                    <FormField
                    control={statementForm.control}
                    name="statement"
                    render={({ field: { onChange, value, ...rest } }) => (
                        <FormItem>
                        <FormLabel>M-Pesa Statement (PDF)</FormLabel>
                        <FormControl>
                            <Input 
                                type="file" 
                                accept=".pdf"
                                {...rest}
                                onChange={(e) => {
                                    onChange(e.target.files);
                                }} 
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={statementForm.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>PDF Password</FormLabel>
                        <FormControl>
                            <Input type="password" placeholder="Enter the password for the PDF" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                        Submit Documents
                    </Button>
                </form>
                </Form>
            </CardContent>
          </Card>
      </main>
    </>
  );
}
