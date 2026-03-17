'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { createUserProfile, updateUserProfile, deleteUserProfile } from '@/lib/firestore';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UserProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: 'staff' | 'finance';
  status?: 'pending' | 'approved' | 'rejected';
}

const userProfileSchema = z.object({
  uid: z.string().min(1, 'Firebase UID required.'),
  name: z.string().min(1, 'Name required.'),
  email: z.string().email('Valid email required.'),
  role: z.enum(['staff', 'finance']),
  status: z.enum(['pending', 'approved', 'rejected']).default('approved'),
});

export default function UserManagementPage() {
    const { user: currentUser, loading: userLoading } = useAppUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
    const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isSuperAdmin = currentUser?.email === 'simon@pezeka.com' || currentUser?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';

    useEffect(() => {
        if (!userLoading && currentUser && !isSuperAdmin) {
            router.replace('/admin');
        }
    }, [userLoading, isSuperAdmin, currentUser, router]);

    const { data: users, loading: usersLoading } = useCollection<UserProfile>(isSuperAdmin ? 'users' : null);

    const addForm = useForm<z.infer<typeof userProfileSchema>>({
        resolver: zodResolver(userProfileSchema),
        defaultValues: { uid: '', name: '', email: '', role: 'staff', status: 'approved' },
    });

    const editForm = useForm<z.infer<typeof userProfileSchema>>({ resolver: zodResolver(userProfileSchema) });

    async function onAddSubmit(values: z.infer<typeof userProfileSchema>) {
        setIsSubmitting(true);
        try {
            await createUserProfile(firestore, values.uid, values);
            toast({ title: 'User Profile Created' });
            setAddDialogOpen(false);
            addForm.reset();
        } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: error.message }); } finally { setIsSubmitting(false); }
    }

    async function onEditSubmit(values: z.infer<typeof userProfileSchema>) {
      if (!userToEdit) return;
      setIsSubmitting(true);
      try {
        await updateUserProfile(firestore, userToEdit.id, values);
        toast({ title: "Profile Updated" });
        setEditDialogOpen(false);
      } catch (error: any) { toast({ variant: "destructive", title: "Failed", description: error.message }); } finally { setIsSubmitting(false); }
    }

    async function confirmDelete() {
        if (!userToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteUserProfile(firestore, userToDelete.id);
            toast({ title: 'User Deleted' });
            setDeleteDialogOpen(false);
        } catch (error: any) { toast({ variant: "destructive", title: "Failed", description: error.message }); } finally { setIsSubmitting(false); }
    }
    
    if (userLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" />Add Staff</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
                <Form {...addForm}>
                    <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 pt-4">
                        <FormField control={addForm.control} name="uid" render={({ field }) => (<FormItem><FormLabel>UID</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                        <FormField control={addForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                        <FormField control={addForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl></FormItem>)}/>
                        <FormField control={addForm.control} name="role" render={({ field }) => (
                            <FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="finance">Finance</SelectItem></SelectContent>
                            </Select></FormItem>
                        )}/>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>Save Profile</Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                  {users?.map((u) => (
                      <TableRow key={u.id}>
                          <TableCell>{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                          <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => { setUserToDelete(u); setDeleteDialogOpen(true); }} className="text-destructive">Delete</Button>
                          </TableCell>
                      </TableRow>
                  ))}
              </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Delete</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
