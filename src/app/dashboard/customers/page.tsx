'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, FileDown, MessageSquare, Copy, MoreHorizontal } from 'lucide-react';
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
import { addDays, addWeeks, addMonths, format } from 'date-fns';
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


const customerSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  phone: z.string().min(1, 'Phone number is required.'),
  idNumber: z.string().optional(),
});

interface Customer {
  id: string;
  name: string;
  phone: string;
  idNumber?: string;
}

interface Loan {
    id: string;
    customerId: string;
    loanNumber: string;
    customerName: string;
    disbursementDate: { seconds: number, nanoseconds: number };
    principalAmount: number;
    interestRate?: number;
    status: 'due' | 'paid' | 'active';
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


  const firestore = useFirestore();
  const { toast } = useToast();
  
  const { data: customers, loading: customersLoading } = useCollection<Customer>('customers');
  const { data: loans, loading: loansLoading } = useCollection<Loan>('loans');

  const addForm = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
      idNumber: '',
    },
  });

  const editForm = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
      idNumber: '',
    },
  });

  async function onAddSubmit(values: z.infer<typeof customerSchema>) {
    setIsSubmitting(true);
    try {
      await addCustomer(firestore, values);
      toast({
        title: 'Customer Added',
        description: `${values.name} has been added successfully.`,
      });
      addForm.reset();
      setAddCustomerOpen(false);
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Could not add customer. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleEditClick = (customer: Customer) => {
    setCustomerToEdit(customer);
    editForm.reset({
      name: customer.name,
      phone: customer.phone,
      idNumber: customer.idNumber || '',
    });
    setEditCustomerOpen(true);
  };

  async function onEditSubmit(values: z.infer<typeof customerSchema>) {
    if (!customerToEdit) return;
    setIsSubmitting(true);
    try {
      await updateCustomer(firestore, customerToEdit.id, values);
      toast({
        title: 'Customer Updated',
        description: `${values.name} has been updated successfully.`,
      });
      setEditCustomerOpen(false);
      setCustomerToEdit(null);
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Could not update customer. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteConfirmOpen(true);
  };

  async function confirmDelete() {
    if (!customerToDelete) return;
    try {
      await deleteCustomer(firestore, customerToDelete.id);
      toast({
        title: 'Customer Deleted',
        description: `${customerToDelete.name} has been deleted.`,
      });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Delete failed",
            description: "Could not delete customer. Please try again.",
        });
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

    const customerData = [{
      'Customer Name': selectedCustomer.name,
      'Phone': selectedCustomer.phone,
      'ID Number': selectedCustomer.idNumber || 'N/A'
    },
    {}, // empty row for spacing
    {
      'Loan Number': 'Loan Number',
      'Principal': 'Principal',
      'Total Repayable': 'Total Repayable',
      'Total Paid': 'Total Paid',
      'Balance': 'Balance',
      'Status': 'Status',
    },
    ...customerLoans.map(loan => {
        const balance = loan.totalRepayableAmount - loan.totalPaid;
        return {
            'Loan Number': loan.loanNumber,
            'Principal': loan.principalAmount,
            'Total Repayable': loan.totalRepayableAmount,
            'Total Paid': loan.totalPaid,
            'Balance': balance,
            'Status': loan.status,
        }
    })
    ];

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
    } catch(e) {
        return null;
    }
  };
  
  const generatedMessage = useMemo(() => {
      if (!messageLoan || !selectedCustomer) return "";
      const balance = messageLoan.totalRepayableAmount - messageLoan.totalPaid;
      const dueDate = getLoanDueDate(messageLoan);
      
      return `Dear ${selectedCustomer.name},\n\nThis is a friendly reminder regarding your loan with Pezeka Credit.\n\nLoan Number: ${messageLoan.loanNumber}\nOutstanding Balance: Ksh ${balance.toLocaleString()}\nNext Instalment: Ksh ${messageLoan.instalmentAmount.toLocaleString()}${dueDate ? `\nDue Date: ${format(dueDate, 'PPP')}` : ''}\n\nPlease ensure your payment is made on time to avoid any inconveniences.\n\nThank you,\nPezeka Credit Ltd.`;
  }, [messageLoan, selectedCustomer]);

  const copyToClipboard = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(generatedMessage);
        toast({ title: "Message Copied!", description: "The message has been copied to your clipboard." });
      }
  };
  
  const isLoading = customersLoading || loansLoading;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a New Customer</DialogTitle>
              <DialogDescription>
                Fill in the details below to add a new customer.
              </DialogDescription>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                <FormField
                  control={addForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 0712345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="idNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 12345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Customer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>A list of all customers in the system. Click on a customer to see more details.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && (!customers || customers.length === 0) && (
              <Alert>
                  <AlertTitle>No Customers Found</AlertTitle>
                  <AlertDescription>There are no customers in the system yet. Add one to see them here.</AlertDescription>
              </Alert>
          )}
          {!isLoading && customers && customers.length > 0 && (
            <div className="relative max-h-[60vh] overflow-y-auto">
              <Table>
                  <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone Number</TableHead>
                          <TableHead>ID Number</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {customers.map((customer, index) => (
                          <TableRow key={customer.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">{customer.name}</TableCell>
                              <TableCell>{customer.phone}</TableCell>
                              <TableCell>{customer.idNumber || 'N/A'}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu open={openMenu === customer.id} onOpenChange={(isOpen) => setOpenMenu(isOpen ? customer.id : null)}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                                        <DropdownMenuItem onClick={() => {
                                            setSelectedCustomer(customer);
                                            setOpenMenu(null);
                                        }}>
                                            View Breakdown
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => {
                                            handleEditClick(customer);
                                            setOpenMenu(null);
                                        }}>
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                handleDeleteClick(customer);
                                                setOpenMenu(null);
                                            }}
                                            className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                                        >
                                            Delete
                                        </DropdownMenuItem>
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
      
      {/* Customer Details Dialog */}
      <Dialog
        open={!!selectedCustomer}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedCustomer(null);
            setMessageLoan(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedCustomer.name}'s Breakdown</DialogTitle>
                <DialogDescription>
                  Phone: {selectedCustomer.phone} | ID: {selectedCustomer.idNumber || 'N/A'}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Loan History</CardTitle>
                                <CardDescription>All loans associated with this customer.</CardDescription>
                            </div>
                             <Button onClick={handleDownloadReport} variant="outline" size="sm">
                                <FileDown className="mr-2 h-4 w-4" />
                                Download Report
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {customerLoans.length === 0 ? (
                             <Alert>
                                <AlertTitle>No Loans Found</AlertTitle>
                                <AlertDescription>This customer has no loan history.</AlertDescription>
                            </Alert>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Loan No.</TableHead>
                                        <TableHead>Principal</TableHead>
                                        <TableHead>Balance</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customerLoans.map(loan => {
                                        const balance = loan.totalRepayableAmount - loan.totalPaid;
                                        return (
                                            <TableRow key={loan.id}>
                                                <TableCell>{loan.loanNumber}</TableCell>
                                                <TableCell>{loan.principalAmount.toLocaleString()}</TableCell>
                                                <TableCell className="font-bold">{balance.toLocaleString()}</TableCell>
                                                <TableCell>
                                                  <Badge variant={loan.status === 'paid' ? 'default' : loan.status === 'due' ? 'destructive' : 'secondary'}>
                                                    {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => setMessageLoan(loan)}>
                                                        <MessageSquare className="mr-2 h-4 w-4" />
                                                        Message
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedCustomer(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Message Dialog */}
       <Dialog open={!!messageLoan} onOpenChange={(isOpen) => !isOpen && setMessageLoan(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Compose Customer Message</DialogTitle>
                <DialogDescription>A message has been generated for this loan. You can copy it to your clipboard.</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
                <Textarea value={generatedMessage} rows={10} readOnly className="bg-muted/50" />
            </div>
            <DialogFooter>
                 <Button variant="ghost" onClick={() => setMessageLoan(null)}>Cancel</Button>
                 <Button onClick={copyToClipboard}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Message
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update the details for {customerToEdit?.name}.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 0712345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="idNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 12345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the customer
                      "{customerToDelete?.name}" and any associated data.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
