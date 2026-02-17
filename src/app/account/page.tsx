'use client';
import { useUser, useAuth, useCollection, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Landmark, LogOut, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { collection, query, where } from 'firebase/firestore';

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


export default function AccountPage() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const customerLoansQuery = useMemo(() => {
    if (!firestore || !user?.phoneNumber) return null;
    return query(collection(firestore, 'loans'), where('customerPhone', '==', user.phoneNumber));
  }, [firestore, user?.phoneNumber]);

  const { data: customerLoans, loading: loansLoading } = useCollection<Loan>(customerLoansQuery);


  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

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
                        <Button asChild>
                            <Link href="/#products">Explore Loan Products</Link>
                        </Button>
                   </div>
                )}
            </CardContent>
          </Card>
      </main>
    </>
  );
}
