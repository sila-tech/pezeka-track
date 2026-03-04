'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { addInvestor, updateInvestor, deleteInvestor } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, MoreHorizontal } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Investor {
  id: string;
  uid: string;
  name: string;
  email: string;
  totalInvestment: number;
  totalWithdrawn: number;
  currentBalance: number;
  interestRate?: number;
  createdAt: { seconds: number; nanoseconds: number };
}

const investorSchema = z.object({
  uid: z.string().min(1, 'Firebase UID is required.'),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  totalInvestment: z.coerce.number().min(0, 'Investment amount cannot be negative.'),
  interestRate: z.coerce.number().min(0, 'Interest rate cannot be negative.').optional(),
  createdAt: z.string().optional(),
});

export default function InvestorsPage() {
    const { user: currentUser, loading: userLoading } = useAppUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [investorToEdit, setInvestorToEdit] = useState<Investor | null>(null);
    const [investorToDelete, setInvestorToDelete] = useState<Investor | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    
    const canViewPage = useMemo(() => {
        if (!currentUser) return false;
        const role = currentUser.role?.toLowerCase();
        return currentUser.email === 'simon@pezeka.com' || role === 'finance';
    }, [currentUser]);

    useEffect(() => {
        if (!userLoading && currentUser && !canViewPage) {
            toast({ variant: 'destructive', title: 'Access Denied', description: 'Unauthorized access to Investors module.' });
            router.push('/admin');
        }
    }, [userLoading, canViewPage, currentUser, router, toast]);

    const { data: investors, loading: investorsLoading } = useCollection<Investor>(canViewPage ? 'investors' : null);

    const addForm = useForm<z.infer<typeof investorSchema>>({
        resolver: zodResolver(investorSchema),
        defaultValues: { uid: '', name: '', email: '', totalInvestment: 0, interestRate: 0, createdAt: format(new Date(), 'yyyy-MM-dd') },
    });

    const editForm = useForm<z.infer<typeof investorSchema>>({
        resolver: zodResolver(investorSchema),
        defaultValues: { uid: '', name: '', email: '', totalInvestment: 0, interestRate: 0, createdAt: '' }
    });

    async function onAddSubmit(values: z.infer<typeof investorSchema>) {
        setIsSubmitting(true);
        try {
            await addInvestor(firestore, { uid: values.uid, name: values.name, email: values.email, totalInvestment: values.totalInvestment, currentBalance: values.totalInvestment, interestRate: values.interestRate || 0 });
            toast({ title: 'Investor Created' });
            setAddDialogOpen(false);
            addForm.reset();
        } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: error.message }); } finally { setIsSubmitting(false); }
    }

    const handleEditClick = (investor: Investor) => {
        setInvestorToEdit(investor);
        editForm.reset({ uid: investor.uid, name: investor.name, email: investor.email, totalInvestment: investor.totalInvestment, interestRate: investor.interestRate || 0, createdAt: investor.createdAt ? format(new Date(investor.createdAt.seconds * 1000), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd') });
        setEditDialogOpen(true);
    };
    
    async function onEditSubmit(values: z.infer<typeof investorSchema>) {
      if (!investorToEdit) return;
      setIsSubmitting(true);
      try {
        const updateData: any = { name: values.name, email: values.email, totalInvestment: values.totalInvestment, interestRate: values.interestRate || 0 };
        if (values.createdAt) updateData.createdAt = new Date(values.createdAt);
        await updateInvestor(firestore, investorToEdit.id, updateData);
        toast({ title: "Updated" });
        setEditDialogOpen(false);
        setInvestorToEdit(null);
      } catch (error: any) { toast({ variant: "destructive", title: "Update Failed", description: error.message }); } finally { setIsSubmitting(false); }
    }
    
    const handleDeleteClick = (investor: Investor) => { setInvestorToDelete(investor); setDeleteDialogOpen(true); };
    async function confirmDelete() {
        if (!investorToDelete) return;
        setIsSubmitting(true);
        try { await deleteInvestor(firestore, investorToDelete.id); toast({ title: 'Deleted' }); setDeleteDialogOpen(false); setInvestorToDelete(null); } catch (error: any) { toast({ variant: "destructive", title: "Delete Failed", description: error.message }); } finally { setIsSubmitting(false); }
    }
    
    if (userLoading || investorsLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!canViewPage) return null;

    const portfolioTotals = investors ? investors.reduce((acc, inv) => {
        acc.investment += (inv.totalInvestment || 0);
        acc.balance += (inv.currentBalance || 0);
        return acc;
    }, { investment: 0, balance: 0 }) : { investment: 0, balance: 0 };

    return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Investors</h1>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" />Add Investor</Button></DialogTrigger>
        <DialogContent>
            <DialogHeader><DialogTitle>Add New Investor</DialogTitle></DialogHeader>
            <Form {...addForm}>
            <ScrollArea className="max-h-[70vh] pr-4">
                <form id="add-investor-form" onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 py-2">
                    <FormField control={addForm.control} name="uid" render={({ field }) => (<FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={addForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={addForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={addForm.control} name="totalInvestment" render={({ field }) => (<FormItem><FormLabel>Total Investment (Ksh)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={addForm.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Monthly Interest Rate (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                </form>
            </ScrollArea>
            </Form>
            <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="add-investor-form" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Investor</Button></DialogFooter>
        </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader><CardTitle>Investor Portfolios</CardTitle></CardHeader>
        <CardContent>
          {!investors || investors.length === 0 ? (<Alert><AlertTitle>No Investors Found</AlertTitle></Alert>) : (
            <ScrollArea className="h-[60vh]">
              <Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Rate (%)</TableHead><TableHead className="text-right">Investment</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right w-[80px]">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>{investors.map((investor) => (
                          <TableRow key={investor.id}><TableCell className="font-medium">{investor.name}</TableCell><TableCell>{investor.email}</TableCell><TableCell>{(investor.interestRate || 0).toFixed(2)}%</TableCell><TableCell className="text-right font-medium">{(investor.totalInvestment || 0).toLocaleString()}</TableCell><TableCell className="text-right font-bold">{(investor.currentBalance || 0).toLocaleString()}</TableCell><TableCell className="text-right"><DropdownMenu open={openMenu === investor.id} onOpenChange={(isOpen) => setOpenMenu(isOpen ? investor.id : null)}><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleEditClick(investor)}>Edit</DropdownMenuItem><DropdownMenuItem onClick={() => handleDeleteClick(investor)} className="text-destructive">Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>
                        ))}</TableBody>
                  <TableFooter>
                      <TableRow className="font-bold bg-muted/50">
                          <TableCell colSpan={3}>Grand Totals</TableCell>
                          <TableCell className="text-right">{portfolioTotals.investment.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{portfolioTotals.balance.toLocaleString()}</TableCell>
                          <TableCell />
                      </TableRow>
                  </TableFooter>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Edit Investor</DialogTitle></DialogHeader>
            <Form {...editForm}>
              <ScrollArea className="max-h-[70vh] pr-4">
                <form id="edit-investor-form" onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-2">
                    <FormField control={editForm.control} name="uid" render={({ field }) => (<FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input {...field} disabled value={field.value ?? ''}/></FormControl></FormItem>)}/>
                    <FormField control={editForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl></FormItem>)}/>
                    <FormField control={editForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''}/></FormControl></FormItem>)}/>
                    <FormField control={editForm.control} name="totalInvestment" render={({ field }) => (<FormItem><FormLabel>Total Investment</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl></FormItem>)}/>
                    <FormField control={editForm.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Monthly Interest Rate (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl></FormItem>)}/>
                    <FormField control={editForm.control} name="createdAt" render={({ field }) => (<FormItem><FormLabel>Investment Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl></FormItem>)}/>
                </form>
              </ScrollArea>
            </Form>
             <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="edit-investor-form" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Portfolio?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setInvestorToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}
