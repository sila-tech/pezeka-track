'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { createInvestorProfile, updateInvestorProfile, deleteInvestorProfile } from '@/lib/firestore';
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

interface InvestorProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
}

const investorProfileSchema = z.object({
  uid: z.string().min(1, 'Firebase UID is required.'),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
});

export default function InvestorManagementPage() {
    const { user: currentUser, loading: userLoading } = useAppUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [investorToEdit, setInvestorToEdit] = useState<InvestorProfile | null>(null);
    const [investorToDelete, setInvestorToDelete] = useState<InvestorProfile | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    
    const isSuperAdmin = useMemo(() => currentUser?.email === 'simon@pezeka.com', [currentUser]);
    
    useEffect(() => {
        if (!userLoading && !isSuperAdmin) {
            toast({ variant: 'destructive', title: 'Access Denied', description: 'You do not have permission to view this page.' });
            router.push('/admin');
        }
    }, [userLoading, isSuperAdmin, router, toast]);

    const { data: investors, loading: investorsLoading } = useCollection<InvestorProfile>(isSuperAdmin ? 'investors' : null);

    const addForm = useForm<z.infer<typeof investorProfileSchema>>({
        resolver: zodResolver(investorProfileSchema),
        defaultValues: { uid: '', name: '', email: '' },
    });

    const editForm = useForm<z.infer<typeof investorProfileSchema>>({
        resolver: zodResolver(investorProfileSchema),
    });

    async function onAddSubmit(values: z.infer<typeof investorProfileSchema>) {
        setIsSubmitting(true);
        try {
            await createInvestorProfile(firestore, values.uid, {
                email: values.email,
                name: values.name,
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

    const handleEditClick = (investor: InvestorProfile) => {
        setInvestorToEdit(investor);
        editForm.reset({
            uid: investor.uid,
            name: investor.name,
            email: investor.email,
        });
        setEditDialogOpen(true);
    };
    
    async function onEditSubmit(values: z.infer<typeof investorProfileSchema>) {
      if (!investorToEdit) return;
      setIsSubmitting(true);
      try {
        await updateInvestorProfile(firestore, investorToEdit.id, {
          name: values.name,
          email: values.email,
        });
        toast({ title: "Profile Updated" });
        setEditDialogOpen(false);
        setInvestorToEdit(null);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Update Failed", description: error.message });
      } finally {
        setIsSubmitting(false);
      }
    }
    
    const handleDeleteClick = (investor: InvestorProfile) => {
        setInvestorToDelete(investor);
        setDeleteDialogOpen(true);
    };

    async function confirmDelete() {
        if (!investorToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteInvestorProfile(firestore, investorToDelete.id);
            toast({ title: 'Investor Profile Deleted', description: `Profile for ${investorToDelete.name} has been deleted.` });
            setDeleteDialogOpen(false);
            setInvestorToDelete(null);
        } catch (error: any) {
             toast({ variant: "destructive", title: "Delete Failed", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    if (userLoading || !isSuperAdmin) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Investor Management</h1>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Investor Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Investor Profile</DialogTitle>
              <DialogDescription>
                First, create the user in the Firebase Authentication console. Then, add their profile details here.
              </DialogDescription>
            </DialogHeader>
            <Form {...addForm}>
              <form id="add-investor-form" onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                <FormField control={addForm.control} name="uid" render={({ field }) => (
                  <FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input placeholder="Paste UID from Firebase Auth" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={addForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={addForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="investor@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              </form>
            </Form>
             <DialogFooter className="mt-4">
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit" form="add-investor-form" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Profile
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Investors</CardTitle>
            <CardDescription>A list of all investors.</CardDescription>
        </CardHeader>
        <CardContent>
          {investorsLoading && (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          )}
          {!investorsLoading && (!investors || investors.length === 0) && (
              <Alert><AlertTitle>No Investor Profiles Found</AlertTitle><AlertDescription>There are no investor profiles in the database. Add one to get started.</AlertDescription></Alert>
          )}
          {!investorsLoading && investors && investors.length > 0 && (
            <div className="relative max-h-[60vh] overflow-y-auto">
              <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {investors.map((investor) => (
                          <TableRow key={investor.id}>
                              <TableCell className="font-medium">{investor.name}</TableCell>
                              <TableCell>{investor.email}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu open={openMenu === investor.id} onOpenChange={(isOpen) => setOpenMenu(isOpen ? investor.id : null)}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                                        <DropdownMenuItem onClick={() => { handleEditClick(investor); setOpenMenu(null); }}>Edit</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => { handleDeleteClick(investor); setOpenMenu(null); }} className="text-destructive focus:bg-destructive focus:text-destructive-foreground">Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Investor Profile</DialogTitle>
                <DialogDescription>Update the profile for {investorToEdit?.name}.</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form id="edit-investor-form" onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField control={editForm.control} name="uid" render={({ field }) => (
                  <FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={editForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={editForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              </form>
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
                      This will permanently delete the profile for <strong>{investorToDelete?.name}</strong> from Firestore. It will not delete their authentication account.
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
