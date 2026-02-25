'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from 'date-fns';

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { addInvestor, addInterestToInvestorPortfolio, deleteInvestor } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PlusCircle, PenSquare, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';


// Schemas
const addInvestorSchema = z.object({
  name: z.string().min(1, 'Portfolio holder name is required.'),
  initialInvestment: z.coerce.number().min(1, 'Initial investment must be greater than 0.'),
});

const addInterestSchema = z.object({
    amount: z.coerce.number().min(0.01, 'Interest amount must be greater than 0.'),
    date: z.string().min(1, 'Interest date is required.'),
    description: z.string().optional(),
});


// Interfaces
interface InterestEntry {
  entryId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
  description?: string;
}

interface Investor {
  id: string;
  name: string;
  initialInvestment: number;
  currentBalance: number;
  createdAt: { seconds: number; nanoseconds: number };
  interestEntries?: InterestEntry[];
}


export function InvestorsPortfolioTab() {
  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addInvestorOpen, setAddInvestorOpen] = useState(false);
  const [manageInvestorOpen, setManageInvestorOpen] = useState(false);
  const [deleteInvestorOpen, setDeleteInvestorOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [investorToDelete, setInvestorToDelete] = useState<Investor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthorized = user ? (user.email === 'simon@pezeka.com' || user.role === 'finance') : false;

  const { data: investors, loading: investorsLoading } = useCollection<Investor>(isAuthorized ? 'investors' : null);

  const isLoading = userLoading || investorsLoading;

  // Forms
  const addInvestorForm = useForm<z.infer<typeof addInvestorSchema>>({
    resolver: zodResolver(addInvestorSchema),
    defaultValues: { name: '', initialInvestment: undefined },
  });

  const addInterestForm = useForm<z.infer<typeof addInterestSchema>>({
    resolver: zodResolver(addInterestSchema),
    defaultValues: { amount: undefined, date: format(new Date(), 'yyyy-MM-dd'), description: '' },
  });


  // Handlers
  async function onAddInvestorSubmit(values: z.infer<typeof addInvestorSchema>) {
    setIsSubmitting(true);
    try {
        await addInvestor(firestore, values);
        toast({ title: 'Portfolio Created', description: `A new portfolio for ${values.name} has been created.` });
        addInvestorForm.reset();
        setAddInvestorOpen(false);
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not create portfolio.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleManageClick = (investor: Investor) => {
    setSelectedInvestor(investor);
    addInterestForm.reset({ amount: undefined, date: format(new Date(), 'yyyy-MM-dd'), description: '' });
    setManageInvestorOpen(true);
  };
  
  async function onAddInterestSubmit(values: z.infer<typeof addInterestSchema>) {
      if (!selectedInvestor) return;
      setIsSubmitting(true);
      try {
          await addInterestToInvestorPortfolio(firestore, selectedInvestor.id, {
              ...values,
              date: new Date(values.date),
          });
          toast({ title: 'Interest Added', description: `Interest has been added to ${selectedInvestor.name}'s portfolio.` });
          addInterestForm.reset();
          // We don't close the dialog, just clear the form for another entry.
          // The data will refresh in the background.
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not add interest.' });
      } finally {
          setIsSubmitting(false);
      }
  }

  const handleDeleteClick = (investor: Investor) => {
    setInvestorToDelete(investor);
    setDeleteInvestorOpen(true);
  };
  
  async function confirmDelete() {
    if (!investorToDelete) return;
    setIsSubmitting(true);
    try {
        await deleteInvestor(firestore, investorToDelete.id);
        toast({ title: 'Portfolio Deleted', description: `The portfolio for ${investorToDelete.name} has been removed.` });
        setDeleteInvestorOpen(false);
        setInvestorToDelete(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not delete the portfolio.' });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const sortedInvestors = useMemo(() => {
      return investors ? [...investors].sort((a, b) => b.createdAt.seconds - a.createdAt.seconds) : [];
  }, [investors]);
  
  // Totals for the footer
  const portfolioTotals = useMemo(() => {
    if (!sortedInvestors) return { initial: 0, balance: 0 };
    return sortedInvestors.reduce((acc, investor) => {
        acc.initial += investor.initialInvestment;
        acc.balance += investor.currentBalance;
        return acc;
    }, { initial: 0, balance: 0 });
  }, [sortedInvestors]);


  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Investment Portfolios</CardTitle>
            <CardDescription>Track investment portfolios and their accumulated interest.</CardDescription>
          </div>
          <Dialog open={addInvestorOpen} onOpenChange={setAddInvestorOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2" /> Add New Portfolio
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Investment Portfolio</DialogTitle>
                    <DialogDescription>Enter the details for the new portfolio and its initial investment.</DialogDescription>
                </DialogHeader>
                <Form {...addInvestorForm}>
                    <form id="add-investor-form" onSubmit={addInvestorForm.handleSubmit(onAddInvestorSubmit)} className="space-y-4">
                        <FormField control={addInvestorForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Portfolio Holder Name</FormLabel><FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={addInvestorForm.control} name="initialInvestment" render={({ field }) => (<FormItem><FormLabel>Initial Investment Amount (Ksh)</FormLabel><FormControl><Input type="number" placeholder="e.g., 500000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </form>
                </Form>
                <DialogFooter className="mt-4">
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" form="add-investor-form" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin" />} Create Portfolio</Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          )}
          {!isLoading && (!sortedInvestors || sortedInvestors.length === 0) && (
              <Alert>
                  <AlertTitle>No Portfolios Found</AlertTitle>
                  <AlertDescription>Click "Add New Portfolio" to get started.</AlertDescription>
              </Alert>
          )}
          {!isLoading && sortedInvestors && sortedInvestors.length > 0 && (
            <ScrollArea className="h-[60vh]">
              <Table>
                  <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                          <TableHead>Portfolio Holder</TableHead>
                          <TableHead className="text-right">Initial Investment (Ksh)</TableHead>
                          <TableHead className="text-right">Current Balance (Ksh)</TableHead>
                          <TableHead className="text-right">Total Interest (Ksh)</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {sortedInvestors.map(investor => {
                          const totalInterest = investor.currentBalance - investor.initialInvestment;
                          return (
                              <TableRow key={investor.id}>
                                  <TableCell className="font-medium">{investor.name}</TableCell>
                                  <TableCell className="text-right">{investor.initialInvestment.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-bold">{investor.currentBalance.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-green-600">{totalInterest.toLocaleString()}</TableCell>
                                  <TableCell className="text-center">
                                      <Button variant="ghost" size="sm" onClick={() => handleManageClick(investor)}>
                                          <PenSquare className="mr-2 h-4 w-4" /> Manage
                                      </Button>
                                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(investor)}>
                                          <Trash2 className="h-4 w-4" />
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          )
                      })}
                  </TableBody>
                   <TableRow className="font-bold bg-muted/50 sticky bottom-0">
                        <TableCell>Totals</TableCell>
                        <TableCell className="text-right">{portfolioTotals.initial.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{portfolioTotals.balance.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600">{(portfolioTotals.balance - portfolioTotals.initial).toLocaleString()}</TableCell>
                        <TableCell />
                    </TableRow>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {/* Manage Investor Dialog */}
      <Dialog open={manageInvestorOpen} onOpenChange={setManageInvestorOpen}>
          <DialogContent className="sm:max-w-3xl">
              {selectedInvestor && (
                  <>
                    <DialogHeader>
                        <DialogTitle>Manage Portfolio for: {selectedInvestor.name}</DialogTitle>
                        <DialogDescription>Add manual interest entries and view the history for this portfolio.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] pr-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="space-y-4">
                                <Card>
                                    <CardHeader><CardTitle>Add Interest Entry</CardTitle></CardHeader>
                                    <CardContent>
                                        <Form {...addInterestForm}>
                                            <form onSubmit={addInterestForm.handleSubmit(onAddInterestSubmit)} id="add-interest-form" className="space-y-4">
                                                <FormField control={addInterestForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Interest Amount (Ksh)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={addInterestForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={addInterestForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Monthly interest for January" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting && <Loader2 className="mr-2 animate-spin" />} Add Interest</Button>
                                            </form>
                                        </Form>
                                    </CardContent>
                                </Card>
                            </div>
                            <div>
                                <Card>
                                    <CardHeader><CardTitle>Interest History</CardTitle></CardHeader>
                                    <CardContent>
                                        <ScrollArea className="h-72">
                                            {(!selectedInvestor.interestEntries || selectedInvestor.interestEntries.length === 0) ? (
                                                <Alert>
                                                    <AlertTitle>No Interest Added</AlertTitle>
                                                    <AlertDescription>No interest has been manually added yet.</AlertDescription>
                                                </Alert>
                                            ) : (
                                                <Table>
                                                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {selectedInvestor.interestEntries.sort((a, b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()).map(entry => (
                                                            <TableRow key={entry.entryId}>
                                                                <TableCell>{format(new Date((entry.date as any).seconds * 1000), 'PPP')}</TableCell>
                                                                <TableCell className="text-right">{entry.amount.toLocaleString()}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="mt-4">
                        <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
                    </DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteInvestorOpen} onOpenChange={setDeleteInvestorOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete the investment portfolio for <strong>{investorToDelete?.name}</strong>. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setInvestorToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{isSubmitting && <Loader2 className="mr-2 animate-spin" />} Delete</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
