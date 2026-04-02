
'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, FileDown, Search, MoreHorizontal, Share2, Phone, ShieldCheck } from 'lucide-react';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { addCustomer, updateCustomer, deleteCustomer } from '@/lib/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Badge } from '@/components/ui/badge';

const customerSchema = z.object({
  name: z.string().min(1, 'Name required.'),
  phone: z.string().min(10, 'Valid phone number required.'),
  idNumber: z.string().min(5, 'National ID is required.'),
});

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<any>(null);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const isAuthorized = user?.role === 'staff' || user?.role === 'finance' || user?.email === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
  const canEdit = user?.role === 'finance' || user?.email === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';

  const { data: customers, loading: customersLoading } = useCollection<any>(isAuthorized ? 'customers' : null);

  const sortedCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone?.includes(searchTerm) ||
        c.idNumber?.includes(searchTerm) ||
        c.referralCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.accountNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [customers, searchTerm]);

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', idNumber: '' },
  });

  async function onSubmit(values: z.infer<typeof customerSchema>) {
    setIsSubmitting(true);
    try {
      if (customerToEdit) {
          await updateCustomer(firestore, customerToEdit.id, values);
          toast({ title: 'Customer Updated' });
      } else {
          await addCustomer(firestore, {
              ...values,
              registeredByStaffId: user?.uid,
              registeredByStaffName: user?.name || user?.email || 'Staff'
          });
          toast({ title: 'Customer Added' });
      }
      setAddCustomerOpen(false);
      setEditCustomerOpen(false);
      setCustomerToEdit(null);
      form.reset();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setIsSubmitting(false); }
  }

  async function confirmDelete() {
      if (!customerToDelete) return;
      try {
          await deleteCustomer(firestore, customerToDelete.id);
          toast({ title: 'Customer Deleted' });
          setDeleteConfirmOpen(false);
      } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
  }

  if (!isAuthorized && !customersLoading) return <div className="p-12 text-center font-bold">Access Denied</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Members & Customers</h1>
        <Button onClick={() => { setCustomerToEdit(null); form.reset({ name: '', phone: '', idNumber: '' }); setAddCustomerOpen(true); }} className="font-bold">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Member
        </Button>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Master Customer Ledger</CardTitle>
                <div className="relative">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search name, phone, ID or Member number..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-8 w-full sm:w-[350px]" 
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0 border-t">
            <ScrollArea className="h-[60vh]">
                <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Customer Name</TableHead>
                            <TableHead>Phone Number</TableHead>
                            <TableHead>National ID</TableHead>
                            <TableHead>Member No.</TableHead>
                            <TableHead>Referral Code</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedCustomers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground italic">
                                    {customersLoading ? 'Loading member data...' : 'No matching customers found.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedCustomers.map((c, index) => (
                                <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="text-[10px] font-mono text-muted-foreground">{index + 1}</TableCell>
                                    <TableCell className="font-black text-sm">{c.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="bg-primary/10 p-1.5 rounded-full">
                                                <Phone className="h-3 w-3 text-primary" />
                                            </div>
                                            <span className="font-bold text-primary text-sm">{c.phone}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            {c.idNumber || 'N/A'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono text-[10px] bg-muted/50 border-primary/20 text-primary">
                                            {c.accountNumber}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <Share2 className="h-3 w-3 text-primary/60" />
                                            <span className="font-black text-xs uppercase tracking-wider text-[#1B2B33]">{c.referralCode || '-'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { setCustomerToEdit(c); form.reset({ name: c.name, phone: c.phone, idNumber: c.idNumber || '' }); setEditCustomerOpen(true); }}>Edit Profile</DropdownMenuItem>
                                                {canEdit && <DropdownMenuItem onClick={() => { setCustomerToDelete(c); setDeleteConfirmOpen(true); }} className="text-destructive font-bold">Delete Member</DropdownMenuItem>}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={addCustomerOpen || editCustomerOpen} onOpenChange={(o) => { if (!o) { setAddCustomerOpen(false); setEditCustomerOpen(false); } }}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black">{customerToEdit ? 'Edit Member Profile' : 'Register New Member'}</DialogTitle>
                  <DialogDescription>Ensure all KYC information is accurate before saving.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                              <FormLabel className="font-bold">Full Legal Name</FormLabel>
                              <FormControl><Input placeholder="As per ID Card" {...field} className="h-12 rounded-xl border-primary/20" /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold">Phone Number</FormLabel>
                                <FormControl><Input placeholder="07XX XXX XXX" {...field} className="h-12 rounded-xl border-primary/20" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="idNumber" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold">National ID</FormLabel>
                                <FormControl><Input placeholder="ID Card Number" {...field} className="h-12 rounded-xl border-primary/20" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                      </div>
                      <Button type="submit" className="w-full h-14 rounded-full text-lg font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95" disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                          {customerToEdit ? 'Save Member Changes' : 'Register Member'}
                      </Button>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Delete Member Account?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This will permanently remove <strong>{customerToDelete?.name}</strong> and all their associated records. This action cannot be undone.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 font-bold">Delete Permanently</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
