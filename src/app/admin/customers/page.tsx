'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, FileDown, Search, MoreHorizontal } from 'lucide-react';
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

const customerSchema = z.object({
  name: z.string().min(1, 'Name required.'),
  phone: z.string().min(1, 'Phone required.'),
  idNumber: z.string().optional(),
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
  
  const isAuthorized = user?.role === 'staff' || user?.role === 'finance' || user?.email === 'simon@pezeka.com';
  const canEdit = user?.role === 'finance' || user?.email === 'simon@pezeka.com';

  const { data: customers, loading: customersLoading } = useCollection<any>(isAuthorized ? 'customers' : null);

  const sortedCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm)
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
          await addCustomer(firestore, values);
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

  if (!isAuthorized) return <div className="p-12 text-center">Access Denied</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <Button onClick={() => { setCustomerToEdit(null); form.reset({ name: '', phone: '', idNumber: '' }); setAddCustomerOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle>Customer List</CardTitle>
                <div className="relative"><Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-[250px]" /></div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <ScrollArea className="h-[60vh]">
                <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Account No.</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {sortedCustomers.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell className="font-bold">{c.name}</TableCell>
                                <TableCell>{c.phone}</TableCell>
                                <TableCell className="font-mono text-xs">{c.accountNumber}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => { setCustomerToEdit(c); form.reset({ name: c.name, phone: c.phone, idNumber: c.idNumber || '' }); setEditCustomerOpen(true); }}>Edit</DropdownMenuItem>
                                            {canEdit && <DropdownMenuItem onClick={() => { setCustomerToDelete(c); setDeleteConfirmOpen(true); }} className="text-destructive">Delete</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={addCustomerOpen || editCustomerOpen} onOpenChange={(o) => { if (!o) { setAddCustomerOpen(false); setEditCustomerOpen(false); } }}>
          <DialogContent>
              <DialogHeader><DialogTitle>{customerToEdit ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                      <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                      <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                      <FormField control={form.control} name="idNumber" render={({ field }) => (<FormItem><FormLabel>ID Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                      <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Customer</Button>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Customer?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
