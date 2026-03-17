
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
import { Loader2, PlusCircle, MoreHorizontal, ShieldCheck, CheckCircle2 } from 'lucide-react';
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
  role: 'staff' | 'finance' | 'agent';
  status?: 'pending' | 'approved' | 'rejected';
}

const userProfileSchema = z.object({
  uid: z.string().min(1, 'Firebase UID is required.'),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  role: z.enum(['staff', 'finance', 'agent'], { required_error: 'Please select a role.' }),
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
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    
    const canViewPage = useMemo(() => {
        if (!currentUser) return false;
        const email = currentUser.email?.toLowerCase()?.trim();
        const role = currentUser.role?.toLowerCase()?.trim();
        return email === 'simon@pezeka.com' || role === 'finance' || currentUser.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
    }, [currentUser]);

    const isSuperAdmin = useMemo(() => {
        if (!currentUser) return false;
        const email = currentUser.email?.toLowerCase()?.trim();
        return email === 'simon@pezeka.com' || currentUser.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
    }, [currentUser]);
    
    useEffect(() => {
        if (!userLoading && currentUser && !canViewPage) {
            toast({ variant: 'destructive', title: 'Access Denied', description: 'You do not have permission to view User Management.' });
            router.push('/admin');
        }
    }, [userLoading, canViewPage, currentUser, router, toast]);

    const { data: users, loading: usersLoading } = useCollection<UserProfile>(canViewPage ? 'users' : null);

    const addForm = useForm<z.infer<typeof userProfileSchema>>({
        resolver: zodResolver(userProfileSchema),
        defaultValues: { uid: '', name: '', email: '', role: 'staff', status: 'approved' },
    });

    const editForm = useForm<z.infer<typeof userProfileSchema>>({
        resolver: zodResolver(userProfileSchema),
    });

    async function onAddSubmit(values: z.infer<typeof userProfileSchema>) {
        if (!isSuperAdmin) return;
        setIsSubmitting(true);
        try {
            await createUserProfile(firestore, values.uid, values);
            toast({ title: 'User Profile Created', description: `Profile for ${values.name} has been added.` });
            setAddDialogOpen(false);
            addForm.reset();
        } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: error.message || "Could not create user profile." }); } finally { setIsSubmitting(false); }
    }

    const handleEditClick = (user: UserProfile) => {
        if (!isSuperAdmin) return;
        setUserToEdit(user);
        editForm.reset({ uid: user.uid, name: user.name, email: user.email, role: user.role, status: user.status || 'approved' });
        setEditDialogOpen(true);
    };
    
    async function onEditSubmit(values: z.infer<typeof userProfileSchema>) {
      if (!userToEdit || !isSuperAdmin) return;
      setIsSubmitting(true);
      try {
        await updateUserProfile(firestore, userToEdit.id, values);
        toast({ title: "Profile Updated" });
        setEditDialogOpen(false);
        setUserToEdit(null);
      } catch (error: any) { toast({ variant: "destructive", title: "Update Failed", description: error.message }); } finally { setIsSubmitting(false); }
    }

    const handleApprove = async (user: UserProfile) => {
        if (!isSuperAdmin) return;
        try {
            await updateUserProfile(firestore, user.id, { status: 'approved' });
            toast({ title: "User Approved", description: `${user.name} can now access the system.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Approval Failed', description: e.message });
        }
    };
    
    const handleDeleteClick = (user: UserProfile) => {
        if (!isSuperAdmin) return;
        setUserToDelete(user);
        setDeleteDialogOpen(true);
    };

    async function confirmDelete() {
        if (!userToDelete || !isSuperAdmin) return;
        setIsSubmitting(true);
        try {
            await deleteUserProfile(firestore, userToDelete.id);
            toast({ title: 'User Profile Deleted', description: `Profile for ${userToDelete.name} has been deleted.` });
            setDeleteDialogOpen(false);
            setUserToDelete(null);
        } catch (error: any) { toast({ variant: "destructive", title: "Delete Failed", description: error.message }); } finally { setIsSubmitting(false); }
    }
    
    if (userLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-[#1B2B33]">User Management</h1>
        {isSuperAdmin && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild><Button className="bg-[#1B2B33]"><PlusCircle className="mr-2 h-4 w-4" />Add User Profile</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Add New User Profile</DialogTitle><DialogDescription>First, create the user in the Firebase Authentication console.</DialogDescription></DialogHeader>
                <Form {...addForm}>
                <ScrollArea className="max-h-[70vh] pr-4">
                    <form id="add-user-form" onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 py-2">
                        <FormField control={addForm.control} name="uid" render={({ field }) => (
                        <FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input placeholder="Paste UID from Auth" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={addForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={addForm.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="user@example.com" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={addForm.control} name="role" render={({ field }) => (
                        <FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="agent">Agent (Referrer)</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                        )}/>
                        <FormField control={addForm.control} name="status" render={({ field }) => (
                        <FormItem><FormLabel>Initial Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending Review</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                        )}/>
                    </form>
                </ScrollArea>
                </Form>
                <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="add-user-form" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Profile</Button></DialogFooter>
            </DialogContent>
            </Dialog>
        )}
      </div>
      <Card className="rounded-2xl border-none shadow-xl shadow-navy-900/5">
        <CardHeader><CardTitle>Admin Users</CardTitle><CardDescription>Manage staff, finance, and approved referrers.</CardDescription></CardHeader>
        <CardContent>
          {usersLoading && (<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>)}
          {!usersLoading && (!users || users.length === 0) && (<Alert><AlertTitle>No User Profiles Found</AlertTitle></Alert>)}
          {!usersLoading && users && users.length > 0 && (
            <ScrollArea className="h-[60vh]">
              <Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead>{isSuperAdmin && <TableHead className="text-right w-[150px]">Actions</TableHead>}</TableRow></TableHeader>
                  <TableBody>{users.sort((a,b) => (a.status === 'pending' ? -1 : 1)).map((user) => (
                          <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.name}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell><Badge variant="secondary" className="uppercase text-[10px] font-bold">{user.role}</Badge></TableCell>
                              <TableCell>
                                  <Badge variant={user.status === 'approved' ? 'default' : (user.status === 'rejected' ? 'destructive' : 'secondary')} className="uppercase text-[10px] font-black">
                                      {user.status || 'approved'}
                                  </Badge>
                              </TableCell>
                              {isSuperAdmin && (
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {user.status === 'pending' && (
                                            <Button size="sm" variant="outline" className="h-8 border-green-600 text-green-600 hover:bg-green-50" onClick={() => handleApprove(user)}>
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                                            </Button>
                                        )}
                                        <DropdownMenu open={openMenu === user.id} onOpenChange={(isOpen) => setOpenMenu(isOpen ? user.id : null)}>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEditClick(user)}>Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDeleteClick(user)} className="text-destructive">Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                              )}
                          </TableRow>
                      ))}</TableBody></Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {isSuperAdmin && (
        <>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit User Profile</DialogTitle></DialogHeader>
                    <Form {...editForm}>
                        <ScrollArea className="max-h-[70vh] pr-4">
                            <form id="edit-user-form" onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-2">
                                <FormField control={editForm.control} name="uid" render={({ field }) => (
                                <FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input {...field} disabled value={field.value ?? ''} /></FormControl></FormItem>
                                )}/>
                                <FormField control={editForm.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem>
                                )}/>
                                <FormField control={editForm.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''} /></FormControl></FormItem>
                                )}/>
                                <FormField control={editForm.control} name="role" render={({ field }) => (
                                <FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="agent">Agent (Referrer)</SelectItem></SelectContent>
                                </Select></FormItem>
                                )}/>
                                <FormField control={editForm.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending Review</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
                                </Select></FormItem>
                                )}/>
                            </form>
                        </ScrollArea>
                    </Form>
                    <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="edit-user-form" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Profile?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </>
      )}
    </>
  );
}
