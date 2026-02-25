
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { createInvestorProfile, updateInvestor, deleteInvestor, addInterestToInvestorPortfolio } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, MoreHorizontal, PenSquare, Trash2, Search } from 'lucide-react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Investor {
  id: string;
  uid: string;
  name: string;
  email: string;
  initialInvestment: number;
  currentBalance: number;
  interestEntries?: InterestEntry[];
}

interface InterestEntry {
  entryId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
  description?: string;
}

const addInvestorSchema = z.object({
  uid: z.string().min(1, 'Firebase UID is required.'),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  initialInvestment: z.coerce.number().min(1, 'Initial investment must be greater than 0.'),
});

const editInvestorSchema = z.object({
    name: z.string().min(1, 'Name is required.'),
    email: z.string().email('A valid email is required.'),
});

const addInterestSchema = z.object({
    amount: z.coerce.number().min(0.01, 'Interest amount must be greater than 0.'),
    date: z.string().min(1, 'Interest date is required.'),
    description: z.string().optional(),
});


export default function InvestorManagementPage() {
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
    const [searchTerm, setSearchTerm] = useState('');
    
    const isSuperAdmin = useMemo(() => currentUser?.email === 'simon@pezeka.com', [currentUser]);
    const isFinance = useMemo(() => isSuperAdmin || currentUser?.role === 'finance', [currentUser, isSuperAdmin]);
    const isStaff = useMemo(() => isSuperAdmin || currentUser?.role === 'staff', [currentUser, isSuperAdmin]);

    const canRead = isSuperAdmin || isFinance || isStaff;

    const { data: investors, loading: investorsLoading } = useCollection<Investor>(canRead ? 'investors' : null);

    const filteredInvestors = useMemo(() => {
        if (!investors) return [];
        return investors.filter(investor =>
            investor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            investor.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [investors, searchTerm]);

    const addForm = useForm<z.infer<typeof addInvestorSchema>>({
        resolver: zodResolver(addInvestorSchema),
        defaultValues: { uid: '', name: '', email: '', initialInvestment: undefined },
    });

    const editForm = useForm<z.infer<typeof editInvestorSchema>>({
        resolver: zodResolver(editInvestorSchema),
    });

    const addInterestForm = useForm<z.infer<typeof addInterestSchema>>({
        resolver: zodResolver(addInterestSchema),
        defaultValues: { amount: undefined, date: format(new Date(), 'yyyy-MM-dd'), description: '' },
    });

    async function onAddSubmit(values: z.infer<typeof addInvestorSchema>) {
        setIsSubmitting(true);
        try {
            await createInvestorProfile(firestore, values.uid, {
                email: values.email,
                name: values.name,
                initialInvestment: values.initialInvestment,
            });
            toast({ title: 'Investor Profile Created', description: `Profile for ${values.name} has been added.` });
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
        editForm.reset({ name: investor.name, email: investor.email });
        addInterestForm.reset({ amount: undefined, date: format(new Date(), 'yyyy-MM-dd'), description: '' });
        setEditDialogOpen(true);
    };
    
    async function onEditSubmit(values: z.infer<typeof editInvestorSchema>) {
      if (!investorToEdit) return;
      setIsSubmitting(true);
      try {
        await updateInvestor(firestore, investorToEdit.id, values);
        toast({ title: "Profile Updated" });
        setEditDialogOpen(false);
        setInvestorToEdit(null);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Update Failed", description: error.message });
      } finally {
        setIsSubmitting(false);
      }
    }
    
    async function onAddInterestSubmit(values: z.infer<typeof addInterestSchema>) {
      if (!investorToEdit) return;
      setIsSubmitting(true);
      try {
          await addInterestToInvestorPortfolio(firestore, investorToEdit.id, {
              ...values,
              date: new Date(values.date),
          });
          toast({ title: 'Interest Added', description: `Interest has been added to ${investorToEdit.name}'s portfolio.` });
          addInterestForm.reset();
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not add interest.' });
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
            setUserToDelete(null);
        } catch (error: any) {
             toast({ variant: "destructive", title: "Delete Failed", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const isLoading = userLoading || investorsLoading;

    if (!userLoading && !canRead) {
        return (
             <Alert variant="destructive">
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>You do not have permission to view this page.</AlertDescription>
            </Alert>
        );
    }
    
    return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Investor Management</h1>
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
                <DialogTitle>Add New Investor Profile</DialogTitle>
                <DialogDescription>
                    First, create the user in Firebase Authentication. Then, add their profile details here.
                </DialogDescription>
                </DialogHeader>
                <Form {...addForm}>
                <form id="add-user-form" onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                    <FormField control={addForm.control} name="uid" render={({ field }) => (
                    <FormItem><FormLabel>Investor ID (UID)</FormLabel><FormControl><Input placeholder="Paste UID from Firebase Auth" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={addForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={addForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="user@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={addForm.control} name="initialInvestment" render={({ field }) => (<FormItem><FormLabel>Initial Investment Amount (Ksh)</FormLabel><FormControl><Input type="number" placeholder="e.g., 500000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </form>
                </Form>
                <DialogFooter className="mt-4">
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" form="add-user-form" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Investor
                    </Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>
        )}
      </div>
      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <CardTitle>Investor Portfolios</CardTitle>
                    <CardDescription>A list of all investor portfolios.</CardDescription>
                </div>
                 <div className="relative">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-full sm:w-[300px]"
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          )}
          {!isLoading && (!filteredInvestors || filteredInvestors.length === 0) && (
              <Alert><AlertTitle>No Investors Found</AlertTitle><AlertDescription>There are no investor profiles in the database. Add one to get started.</AlertDescription></Alert>
          )}
          {!isLoading && filteredInvestors && filteredInvestors.length > 0 && (
            <div className="relative max-h-[60vh] overflow-y-auto">
              <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Initial Investment</TableHead>
                        <TableHead className="text-right">Current Balance</TableHead>
                        <TableHead className="text-right">Total Interest</TableHead>
                        <TableHead className="text-right w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredInvestors.map((investor) => {
                          const totalInterest = investor.currentBalance - investor.initialInvestment;
                          return (
                          <TableRow key={investor.id}>
                              <TableCell className="font-medium">{investor.name}</TableCell>
                              <TableCell>{investor.email}</TableCell>
                              <TableCell className="text-right">{investor.initialInvestment.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-bold">{investor.currentBalance.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-green-600">{totalInterest.toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu open={openMenu === investor.id} onOpenChange={(isOpen) => setOpenMenu(isOpen ? investor.id : null)}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                                        {(isSuperAdmin || isFinance) && <DropdownMenuItem onClick={() => { handleEditClick(investor); setOpenMenu(null); }}>Edit / Add Interest</DropdownMenuItem>}
                                        {isSuperAdmin && <DropdownMenuItem onClick={() => { handleDeleteClick(investor); setOpenMenu(null); }} className="text-destructive focus:bg-destructive focus:text-destructive-foreground">Delete</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                          </TableRow>
                      )})}
                  </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
            {investorToEdit && (
                <>
                <DialogHeader>
                    <DialogTitle>Manage Portfolio: {investorToEdit.name}</DialogTitle>
                    <DialogDescription>Edit investor details or add manual interest entries.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 max-h-[60vh] overflow-y-auto pr-4">
                    <Card>
                        <CardHeader><CardTitle>Edit Profile</CardTitle></CardHeader>
                        <CardContent>
                             <Form {...editForm}>
                                <form id="edit-investor-form" onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                                     <FormField control={editForm.control} name="name" render={({ field }) => (
                                        <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={editForm.control} name="email" render={({ field }) => (
                                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Add Interest</CardTitle></CardHeader>
                        <CardContent>
                            <Form {...addInterestForm}>
                                <form onSubmit={addInterestForm.handleSubmit(onAddInterestSubmit)} id="add-interest-form" className="space-y-4">
                                    <FormField control={addInterestForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Interest Amount (Ksh)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={addInterestForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={addInterestForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Monthly interest" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting && <Loader2 className="mr-2 animate-spin" />} Add Interest</Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
                <DialogFooter className="mt-4">
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" form="edit-investor-form" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
                    </Button>
                </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This will permanently delete the profile for <strong>{investorToDelete?.name}</strong>. It will not delete their authentication account.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setInvestorToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Profile
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
