'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, FileDown, MessageSquare, Copy, MoreHorizontal, Search, User } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { exportToCsv } from '@/lib/excel';
import { Textarea } from '@/components/ui/textarea';
import { addDays, addWeeks, addMonths, format, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
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
import { ScrollArea } from '@/components/ui/scroll-area';


const customerSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  phone: z.string().min(1, 'Phone number is required.'),
  idNumber: z.string().optional(),
});

interface Customer {
  id: string;
  accountNumber?: string;
  name: string;
  phone: string;
  idNumber?: string;
  createdAt?: { seconds: number; nanoseconds: number };
}

interface Loan {
    id: string;
    customerId: string;
    loanNumber: string;
    customerName: string;
    customerPhone: string;
    disbursementDate: { seconds: number, nanoseconds: number };
    principalAmount: number;
    interestRate?: number;
    status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application';
    totalRepayableAmount: number;
    totalPaid: number;
    instalmentAmount: number;
    paymentFrequency: 'daily' | 'weekly' | 'monthly';
    numberOfInstalments: number;
}

export default function CustomersPage() {
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [messageLoan, setMessageLoan] = useState<Loan | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');


  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const isAuthorizedAdmin = user && (user.email === 'simon@pezeka.com' || user.role === 'finance' || user.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2');
  const isAuthorized = isAuthorizedAdmin || user?.role === 'staff';
  
  // Staff cannot edit or delete customers
  const canEditDelete = isAuthorizedAdmin;

  const { data: customers, loading: customersLoading } = useCollection<Customer>(isAuthorized ? 'customers' : null);
  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);

  const sortedAndFilteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers
      .filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm) ||
        customer.accountNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [customers, searchTerm]);

  const addForm = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', idNumber: '' },
  });

  const editForm = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', idNumber: '' },
  });

  async function onAddSubmit(values: z.infer<typeof customerSchema>) {
    setIsSubmitting(true);
    try {
      await addCustomer(firestore, values);
      toast({ title: 'Customer Added', description: `${values.name} has been added successfully.` });
      addForm.reset();
      setAddCustomerOpen(false);
    } catch (error) {
       toast({ variant: "destructive", title: "Uh oh! Something went wrong.", description: "Could not add customer. Please try again." });
    } finally { setIsSubmitting(false); }
  }

  const handleEditClick = (customer: Customer) => {
    setCustomerToEdit(customer);
    editForm.reset({ name: customer.name, phone: customer.phone, idNumber: customer.idNumber || '' });
    setEditCustomerOpen(true);
  };

  async function onEditSubmit(values: z.infer<typeof customerSchema>) {
    if (!customerToEdit) return;
    setIsSubmitting(true);
    try {
      await updateCustomer(firestore, customerToEdit.id, values);
      toast({ title: 'Customer Updated', description: `${values.name} has been updated successfully.` });
      setEditCustomerOpen(false);
      setCustomerToEdit(null);
    } catch (error) {
       toast({ variant: "destructive", title: "Uh oh! Something went wrong.", description: "Could not update customer. Please try again." });
    } finally { setIsSubmitting(false); }
  }

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteConfirmOpen(true);
  };

  async function confirmDelete() {
    if (!customerToDelete) return;
    try {
      await deleteCustomer(firestore, customerToDelete.id);
      toast({ title: 'Customer Deleted', description: `${customerToDelete.name} has been deleted.` });
    } catch (error) {
        toast({ variant: "destructive", title: "Delete failed", description: "Could not delete customer. Please try again." });
    } finally {
        setDeleteConfirmOpen(false);
        setCustomerToDelete(null);
    }
  }

  const customerLoans = useMemo(() => {
    if (!selectedCustomer || !loans) return [];
    return loans.filter(loan => loan.customerId === selectedCustomer.id);
  }, [selectedCustomer, loans]);

  const handleDownloadReport = () => {
    if (!selectedCustomer) return;
    const customerData = [{ 'Acc Number': selectedCustomer.accountNumber || 'N/A', 'Customer Name': selectedCustomer.name, 'Phone': selectedCustomer.phone, 'ID Number': selectedCustomer.idNumber || 'N/A' }, {}, 
    { 'Loan Number': 'Loan Number', 'Principal': 'Principal', 'Total Repayable': 'Total Repayable', 'Total Paid': 'Total Paid', 'Balance': 'Balance', 'Status': 'Status' },
    ...customerLoans.map(loan => {
        const balance = loan.totalRepayableAmount - loan.totalPaid;
        return { 'Loan Number': loan.loanNumber, 'Principal': loan.principalAmount, 'Total Repayable': loan.totalRepayableAmount, 'Total Paid': loan.totalPaid, 'Balance': balance, 'Status': loan.status }
    })];
    exportToCsv(customerData, `${selectedCustomer.name.replace(/ /g, '_')}_breakdown`);
  };

  const getLoanDueDate = (loan: Loan) => {
    const disbursementDate = new Date(loan.disbursementDate.seconds * 1000);
    try {
        switch (loan.paymentFrequency) {
            case 'daily': return addDays(disbursementDate, loan.numberOfInstalments);
            case 'weekly': return addWeeks(disbursementDate, loan.numberOfInstalments);
            case 'monthly': return addMonths(disbursementDate, loan.numberOfInstalments);
            default: return null;
        }
    } catch(e) { return null; }
  };
  
  const generatedMessage = useMemo(() => {
      if (!messageLoan || !selectedCustomer) return "";
      const balance = messageLoan.totalRepayableAmount - messageLoan.totalPaid;
      const dueDate = getLoanDueDate(messageLoan);
      const dueDateText = dueDate ? isToday(dueDate) ? `\nYour loan is due today.` : `\nDue Date: ${format(dueDate, 'PPP')}` : '';
      return `Dear ${selectedCustomer.name},\n\nThis is a friendly reminder regarding your loan with Pezeka Credit.\n\nLoan Number: ${messageLoan.loanNumber}\nOutstanding Balance: Ksh ${balance.toLocaleString()}\nNext Instalment: Ksh ${messageLoan.instalmentAmount.toLocaleString()}${dueDateText}\n\nPlease use the following details for your payment:\nPaybill: 522522\nAccount: 1347823360\n\nPlease ensure your payment is made on time to avoid daily penalties.\n\nThank you,\nPezeka Credit Ltd.`;
  }, [messageLoan, selectedCustomer]);

  const copyToClipboard = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(generatedMessage);
        toast({ title: "Message Copied!", description: "The message has been copied to your clipboard." });
      }
  };
  
  if (!isAuthorized && !userLoading) {
      return (
          <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
              <h2 className="text-xl font-semibold">Access Restricted</h2>
              <p className="text-muted-foreground">Only authorized roles can access customer records.</p>
          </div>
      );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
          <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" />Add Customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a New Customer</DialogTitle><DialogDescription>Fill in the details below to add a new customer.</DialogDescription></DialogHeader>
            <Form {...addForm}>
              <ScrollArea className="max-h-[70vh] pr-4">
                <form id="add-customer-form" onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 py-2">
                  <FormField control={addForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={addForm.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="e.g. 0712345678" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={addForm.control} name="idNumber" render={({ field }) => (
                      <FormItem><FormLabel>ID Number (Optional)</FormLabel><FormControl><Input placeholder="e.g. 12345678" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )}/>
                </form>
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit" form="add-customer-form" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Customer</Button>
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><CardTitle>Customer List</CardTitle><CardDescription>Showing all registered customers, newest first.</CardDescription></div>
                <div className="relative"><Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search name, phone, or account..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-full sm:w-[300px]" /></div>
            </div>
        </CardHeader>
        <CardContent>
          {customersLoading && (<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>)}
          {!customersLoading && (!sortedAndFilteredCustomers || sortedAndFilteredCustomers.length === 0) && (<Alert><AlertTitle>No Customers Found</AlertTitle><AlertDescription>{searchTerm ? "No customers match your search." : "There are no customers yet."}</AlertDescription></Alert>)}
          {!customersLoading && sortedAndFilteredCustomers && sortedAndFilteredCustomers.length > 0 && (
            <ScrollArea className="h-[60vh]">
              <Table>
                  <TableHeader className="sticky top-0 bg-card"><TableRow><TableHead className="w-[50px]">#</TableHead><TableHead>Acc No.</TableHead><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>ID Number</TableHead>{canEditDelete && <TableHead className="text-right w-[80px]">Actions</TableHead>}</TableRow></TableHeader>
                  <TableBody>
                      {sortedAndFilteredCustomers.map((customer, index) => (
                          <TableRow key={customer.id} onClick={() => setSelectedCustomer(customer)} className="cursor-pointer">
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-mono text-xs text-primary font-bold">{customer.accountNumber || 'N/A'}</TableCell>
                              <TableCell className="font-medium">{customer.name}</TableCell>
                              <TableCell>{customer.phone}</TableCell>
                              <TableCell>{customer.idNumber || 'N/A'}</TableCell>
                              {canEditDelete && (
                                <TableCell className="text-right">
                                  <DropdownMenu open={openMenu === customer.id} onOpenChange={(isOpen) => setOpenMenu(isOpen ? customer.id : null)}>
                                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(customer); }}>Edit</DropdownMenuItem>
                                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(customer); }} className="text-destructive">Delete</DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              )}
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={!!selectedCustomer} onOpenChange={(isOpen) => !isOpen && setSelectedCustomer(null)}>
        <DialogContent className="sm:max-w-3xl">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedCustomer.name}'s Dashboard</DialogTitle>
                <DialogDescription>
                    <span className="font-mono font-bold text-primary mr-2">{selectedCustomer.accountNumber}</span>
                    | Phone: {selectedCustomer.phone} | ID: {selectedCustomer.idNumber || 'N/A'}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="mt-4 max-h-[70vh]">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Loan History</CardTitle><Button onClick={handleDownloadReport} variant="outline" size="sm"><FileDown className="mr-2 h-4 w-4" />Report</Button></CardHeader>
                    <CardContent>
                        {customerLoans.length === 0 ? (<Alert><AlertTitle>No Loans Found</AlertTitle></Alert>) : (
                            <Table><TableHeader><TableRow><TableHead>Loan No.</TableHead><TableHead>Principal</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                                <TableBody>{customerLoans.map(loan => {
                                        const balance = loan.totalRepayableAmount - loan.totalPaid;
                                        return (<TableRow key={loan.id}><TableCell>{loan.loanNumber}</TableCell><TableCell>{loan.principalAmount.toLocaleString()}</TableCell><TableCell className="font-bold">{balance.toLocaleString()}</TableCell><TableCell><Badge variant={loan.status === 'paid' ? 'default' : 'secondary'}>{loan.status}</Badge></TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => setMessageLoan(loan)}><MessageSquare className="mr-2 h-4 w-4" />Msg</Button></TableCell></TableRow>);
                                })}</TableBody></Table>
                        )}
                    </CardContent>
                </Card>
              </ScrollArea>
              <DialogFooter><Button variant="outline" onClick={() => setSelectedCustomer(null)}>Close</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

       <Dialog open={!!messageLoan} onOpenChange={(isOpen) => !isOpen && setMessageLoan(null)}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-lg">Customer Message</DialogTitle><DialogDescription>Reminder for Loan #{messageLoan?.loanNumber}.</DialogDescription></DialogHeader>
            <div className="mt-2"><Textarea value={generatedMessage} rows={6} readOnly className="bg-muted/50 text-xs" /></div>
            <DialogFooter className="sm:justify-center gap-2 mt-4"><Button variant="outline" size="sm" onClick={() => setMessageLoan(null)}>Cancel</Button><Button size="sm" onClick={copyToClipboard}><Copy className="mr-2 h-3 w-3" />Copy</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <ScrollArea className="max-h-[70vh] pr-4">
              <form id="edit-customer-form" onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-2">
                <FormField control={editForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={editForm.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={editForm.control} name="idNumber" render={({ field }) => (
                    <FormItem><FormLabel>ID Number (Optional)</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )}/>
              </form>
            </ScrollArea>
            <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="edit-customer-form" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button></DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Customer?</AlertDialogTitle></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}