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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UserProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: 'staff' | 'finance';
}

const userProfileSchema = z.object({
  uid: z.string().min(1, 'Firebase UID is required.'),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  role: z.enum(['staff', 'finance'], { required_error: 'Please select a role.' }),
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
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    
    const isSuperAdmin = useMemo(() => currentUser?.email === 'simon@pezeka.com', [currentUser]);
    
    useEffect(() => {
        if (!userLoading && !isSuperAdmin) {
            toast({ variant: 'destructive', title: 'Access Denied', description: 'You do not have permission to view this page.' });
            router.push('/admin');
        }
    }, [userLoading, isSuperAdmin, router, toast]);

    const { data: users, loading: usersLoading } = useCollection<UserProfile>(isSuperAdmin ? 'users' : null);

    const addForm = useForm<z.infer<typeof userProfileSchema>>({
        resolver: zodResolver(userProfileSchema),
        defaultValues: { uid: '', name: '', email: '', role: undefined },
    });

    const editForm = useForm<z.infer<typeof userProfileSchema>>({
        resolver: zodResolver(userProfileSchema),
    });

    async function onAddSubmit(values: z.infer<typeof userProfileSchema>) {
        setIsSubmitting(true);
        try {
            await createUserProfile(firestore, values.uid, {
                email: values.email,
                role: values.role,
                name: values.name,
            });
            toast({ title: 'User Profile Created', description: `Profile for ${values.name} has been added.` });
            setAddDialogOpen(false);
            addForm.reset();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || "Could not create user profile." });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleEditClick = (user: UserProfile) => {
        setUserToEdit(user);
        editForm.reset({
            uid: user.uid,
            name: user.name,
            email: user.email,
            role: user.role,
        });
        setEditDialogOpen(true);
    };
    
    async function onEditSubmit(values: z.infer<typeof userProfileSchema>) {
      if (!userToEdit) return;
      setIsSubmitting(true);
      try {
        await updateUserProfile(firestore, userToEdit.id, {
          name: values.name,
          email: values.email,
          role: values.role,
        });
        toast({ title: "Profile Updated" });
        setEditDialogOpen(false);
        setUserToEdit(null);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Update Failed", description: error.message });
      } finally {
        setIsSubmitting(false);
      }
    }
    
    const handleDeleteClick = (user: UserProfile) => {
        setUserToDelete(user);
        setDeleteDialogOpen(true);
    };

    async function confirmDelete() {
        if (!userToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteUserProfile(firestore, userToDelete.id);
            toast({ title: 'User Profile Deleted', description: `Profile for ${userToDelete.name} has been deleted.` });
            setDeleteDialogOpen(false);
            setUserToDelete(null);
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
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add User Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User Profile</DialogTitle>
              <DialogDescription>
                First, create the user in the Firebase Authentication console. Then, add their profile details here.
              </DialogDescription>
            </DialogHeader>
            <Form {...addForm}>
              <ScrollArea className="max-h-[70vh]">
                <form id="add-user-form" onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 p-1">
                    <FormField control={addForm.control} name="uid" render={({ field }) => (
                    <FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input placeholder="Paste UID from Firebase Auth" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={addForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={addForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="user@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={addForm.control} name="role" render={({ field }) => (
                    <FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="finance">Finance</SelectItem></SelectContent>
                    </Select><FormMessage /></FormItem>
                    )}/>
                </form>
              </ScrollArea>
            </Form>
             <DialogFooter className="mt-4">
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit" form="add-user-form" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Profile
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Admin Users</CardTitle>
            <CardDescription>A list of all users with staff or finance roles.</CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading && (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          )}
          {!usersLoading && (!users || users.length === 0) && (
              <Alert><AlertTitle>No User Profiles Found</AlertTitle><AlertDescription>There are no user profiles in the database. Add one to get started.</AlertDescription></Alert>
          )}
          {!usersLoading && users && users.length > 0 && (
            <ScrollArea className="h-[60vh]">
              <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {users.map((user) => (
                          <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.name}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell><Badge variant="secondary">{user.role}</Badge></TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu open={openMenu === user.id} onOpenChange={(isOpen) => setOpenMenu(isOpen ? user.id : null)}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                                        <DropdownMenuItem onClick={() => { handleEditClick(user); setOpenMenu(null); }}>Edit</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => { handleDeleteClick(user); setOpenMenu(null); }} className="text-destructive focus:bg-destructive focus:text-destructive-foreground">Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                          </TableRow>
                      ))}
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
                <DialogTitle>Edit User Profile</DialogTitle>
                <DialogDescription>Update the profile for {userToEdit?.name}.</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
                <ScrollArea className="max-h-[70vh]">
                    <form id="edit-user-form" onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 p-1">
                        <FormField control={editForm.control} name="uid" render={({ field }) => (
                        <FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={editForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={editForm.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={editForm.control} name="role" render={({ field }) => (
                        <FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="finance">Finance</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                        )}/>
                    </form>
                </ScrollArea>
            </Form>
             <DialogFooter className="mt-4">
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit" form="edit-user-form" disabled={isSubmitting}>
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
                      This will permanently delete the profile for <strong>{userToDelete?.name}</strong> from Firestore. It will not delete their authentication account.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Profile
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
