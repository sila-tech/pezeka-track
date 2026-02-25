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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Investor {
  id: string;
  uid: string;
  name: string;
  email: string;
  totalInvestment: number;
  currentBalance: number;
  interestRate?: number;
  createdAt: { seconds: number; nanoseconds: number };
}

const investorSchema = z.object({
  uid: z.string().min(1, 'Firebase UID is required.'),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  totalInvestment: z.coerce.number().min(0, 'Total investment cannot be negative.'),
  interestRate: z.coerce.number().min(0, 'Interest rate cannot be negative.').optional(),
  createdAt: z.string().optional(),
});

export default function InvestorsPage() {
    const { user: currentUser, loading: userLoading } = useAppUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [investorToEdit, setInvestorToEdit] = useState<Investor | null>(null);
    const [investorToDelete, setInvestorToDelete] = useState<Investor | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    
    const isSuperAdmin = currentUser?.email === 'simon@pezeka.com';
    const isFinance = currentUser?.role === 'finance';
    const canViewPage = isSuperAdmin || isFinance;

    useEffect(() => {
        if (!userLoading && !canViewPage) {
            toast({ variant: 'destructive', title: 'Access Denied', description: 'You do not have permission to view this page.' });
            router.push('/admin');
        }
    }, [userLoading, canViewPage, router, toast]);

    const { data: investors, loading: investorsLoading } = useCollection<Investor>(canViewPage ? 'investors' : null);

    const addForm = useForm<z.infer<typeof investorSchema>>({
        resolver: zodResolver(investorSchema),
        defaultValues: { uid: '', name: '', email: '', totalInvestment: 0, interestRate: 0, createdAt: undefined },
    });

    const editForm = useForm<z.infer<typeof investorSchema>>({
        resolver: zodResolver(investorSchema),
    });

    async function onAddSubmit(values: z.infer<typeof investorSchema>) {
        setIsSubmitting(true);
        try {
            await addInvestor(firestore, {
                uid: values.uid,
                name: values.name,
                email: values.email,
                totalInvestment: values.totalInvestment,
                currentBalance: values.totalInvestment, // Initially balance equals investment
                interestRate: values.interestRate || 0,
            });
            toast({ title: 'Investor Created', description: `Profile for ${values.name} has been added.` });
            setAddDialogOpen(false);
            addForm.reset();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || "Could not create investor profile." });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleEditClick = (investor: Investor) => {
        setInvestorToEdit(investor);
        editForm.reset({
            uid: investor.uid,
            name: investor.name,
            email: investor.email,
            totalInvestment: investor.totalInvestment,
            interestRate: investor.interestRate || 0,
            createdAt: investor.createdAt ? format(new Date(investor.createdAt.seconds * 1000), 'yyyy-MM-dd') : undefined,
        });
        setEditDialogOpen(true);
    };
    
    async function onEditSubmit(values: z.infer<typeof investorSchema>) {
      if (!investorToEdit) return;
      setIsSubmitting(true);
      try {
        const updateData: { [key: string]: any } = {
            name: values.name,
            email: values.email,
            totalInvestment: values.totalInvestment,
            interestRate: values.interestRate,
        };

        if (values.createdAt) {
            updateData.createdAt = new Date(values.createdAt);
        }
        
        await updateInvestor(firestore, investorToEdit.id, updateData);
        toast({ title: "Investor Profile Updated" });
        setEditDialogOpen(false);
        setInvestorToEdit(null);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Update Failed", description: error.message });
      } finally {
        setIsSubmitting(false);
      }
    }
    
    const handleDeleteClick = (investor: Investor) => {
        setInvestorToDelete(investor);
        setDeleteDialogOpen(true);
    };

    async function confirmDelete() {
        if (!investorToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteInvestor(firestore, investorToDelete.id);
            toast({ title: 'Investor Deleted', description: `Profile for ${investorToDelete.name} has been deleted.` });
            setDeleteDialogOpen(false);
            setInvestorToDelete(null);
        } catch (error: any) {
             toast({ variant: "destructive", title: "Delete Failed", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const isLoading = userLoading || investorsLoading;

    if (isLoading || !canViewPage) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Investors</h1>
        {isSuperAdmin && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Investor
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Add New Investor</DialogTitle>
                <DialogDescription>
                    First, create the user in Firebase Authentication. Then, add their profile and initial investment details here.
                </DialogDescription>
                </DialogHeader>
                <Form {...addForm}>
                <ScrollArea className="max-h-[70vh]">
                    <form id="add-investor-form" onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 p-1">
                        <FormField control={addForm.control} name="uid" render={({ field }) => (
                        <FormItem><FormLabel>Investor User ID (UID)</FormLabel><FormControl><Input placeholder="Paste UID from Firebase Auth" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={addForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={addForm.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="investor@email.com" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={addForm.control} name="totalInvestment" render={({ field }) => (
                        <FormItem><FormLabel>Initial Investment</FormLabel><FormControl><Input type="number" placeholder="50000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={addForm.control} name="interestRate" render={({ field }) => (
                        <FormItem><FormLabel>Monthly Interest Rate (%)</FormLabel><FormControl><Input type="number" placeholder="e.g. 5" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </form>
                </ScrollArea>
                </Form>
                <DialogFooter className="mt-4">
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" form="add-investor-form" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Investor
                    </Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>
        )}
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Investor Portfolios</CardTitle>
            <CardDescription>A list of all investors and their portfolio status.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          )}
          {!isLoading && (!investors || investors.length === 0) && (
              <Alert><AlertTitle>No Investors Found</AlertTitle><AlertDescription>There are no investors in the database. Add one to get started.</AlertDescription></Alert>
          )}
          {!isLoading && investors && investors.length > 0 && (
            <ScrollArea className="h-[60vh]">
              <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Date Joined</TableHead>
                        <TableHead>Interest Rate</TableHead>
                        <TableHead className="text-right">Total Investment (Ksh)</TableHead>
                        <TableHead className="text-right">Current Balance (Ksh)</TableHead>
                        <TableHead className="text-right">ROI</TableHead>
                        {(isSuperAdmin || isFinance) && <TableHead className="text-right w-[80px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {investors.map((investor) => {
                          const roi = (investor.totalInvestment || 0) > 0 ? (((investor.currentBalance || 0) - (investor.totalInvestment || 0)) / (investor.totalInvestment || 0)) * 100 : 0;
                          return (
                            <TableRow key={investor.id}>
                                <TableCell className="font-medium">{investor.name}</TableCell>
                                <TableCell>{investor.email}</TableCell>
                                <TableCell>{investor.createdAt ? format(new Date(investor.createdAt.seconds * 1000), 'PPP') : 'N/A'}</TableCell>
                                <TableCell>{investor.interestRate || 0}%</TableCell>
                                <TableCell className="text-right">{(investor.totalInvestment || 0).toLocaleString()}</TableCell>
                                <TableCell className="text-right font-bold">{(investor.currentBalance || 0).toLocaleString()}</TableCell>
                                <TableCell className={`text-right font-medium ${roi >= 0 ? 'text-green-600' : 'text-destructive'}`}>{roi.toFixed(2)}%</TableCell>
                                
                                {(isSuperAdmin || isFinance) && (
                                    <TableCell className="text-right">
                                    <DropdownMenu open={openMenu === investor.id} onOpenChange={(isOpen) => setOpenMenu(isOpen ? investor.id : null)}>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                                            {(isSuperAdmin || isFinance) && <DropdownMenuItem onClick={() => { handleEditClick(investor); setOpenMenu(null); }}>Edit</DropdownMenuItem>}
                                            {isSuperAdmin && <DropdownMenuItem onClick={() => { handleDeleteClick(investor); setOpenMenu(null); }} className="text-destructive focus:bg-destructive focus:text-destructive-foreground">Delete</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                                )}
                            </TableRow>
                          )
                      })}
                  </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Investor</DialogTitle>
                <DialogDescription>Update the profile for {investorToEdit?.name}.</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <ScrollArea className="max-h-[70vh]">
                <form id="edit-investor-form" onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 p-1">
                    <FormField control={editForm.control} name="uid" render={({ field }) => (
                    <FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={editForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={editForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={editForm.control} name="totalInvestment" render={({ field }) => (
                    <FormItem><FormLabel>Total Investment</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={editForm.control} name="interestRate" render={({ field }) => (
                    <FormItem><FormLabel>Monthly Interest Rate (%)</FormLabel><FormControl><Input type="number" placeholder="e.g. 5" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={editForm.control} name="createdAt" render={({ field }) => (
                    <FormItem><FormLabel>Investment Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </form>
              </ScrollArea>
            </Form>
             <DialogFooter className="mt-4">
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit" form="edit-investor-form" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This will permanently delete the investor profile for <strong>{investorToDelete?.name}</strong>. This action cannot be undone.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setInvestorToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Investor
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
