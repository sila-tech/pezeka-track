'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { addInvestor, updateInvestor, deleteInvestor, approveDeposit, rejectDeposit, processWithdrawal, rejectWithdrawal, approveInvestmentApplication, rejectInvestmentApplication } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, MoreHorizontal, Briefcase, CheckCircle, XCircle, Users, User, Landmark, Search, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Investor {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone?: string;
  investmentType?: 'Individual' | 'Group' | 'Chama';
  totalInvestment: number;
  totalWithdrawn: number;
  currentBalance: number;
  interestRate?: number;
  createdAt: { seconds: number; nanoseconds: number };
  deposits?: { depositId: string; amount: number; date: any; status: string }[];
  withdrawals?: { withdrawalId: string; amount: number; date: any; status: string }[];
}

interface InvestmentApplication {
    id: string;
    uid: string;
    name: string;
    email: string;
    phone: string;
    type: 'Individual' | 'Group' | 'Chama';
    amount: number;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: { seconds: number; nanoseconds: number };
}

const investorSchema = z.object({
  uid: z.string().min(1, 'Firebase UID is required.'),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  totalInvestment: z.coerce.number().min(0, 'Investment amount cannot be negative.'),
  interestRate: z.coerce.number().min(0, 'Interest rate cannot be negative.').optional(),
  createdAt: z.string().optional(),
});

export default function InvestorsPage() {
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
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('portfolios');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    
    // Investors module is accessible to Staff, Finance and Super Admin roles.
    const isSuperAdmin = useMemo(() => {
        if (!currentUser) return false;
        const email = currentUser.email?.toLowerCase()?.trim();
        return email === 'simon@pezeka.com' 
            || currentUser.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2'
            || currentUser.uid === 'Z8gkNLZEVUWbsooR8R7OuHxApB62'
            || currentUser.uid === 'zdf58EsGJKa2xr7D6RmNBS3gbx53';
    }, [currentUser]);

    const isFinance = useMemo(() => currentUser?.role?.toLowerCase()?.trim() === 'finance', [currentUser]);
    const isStaff = useMemo(() => currentUser?.role?.toLowerCase()?.trim() === 'staff' || currentUser?.email?.endsWith('@staff.pezeka.com'), [currentUser]);

    const canViewPage = isSuperAdmin || isFinance || isStaff;

    // Only Finance and Super Admin can manage portfolios (add/edit/delete)
    const canEdit = isSuperAdmin || isFinance;

    useEffect(() => {
        if (!userLoading && currentUser && !canViewPage) {
            toast({ variant: 'destructive', title: 'Access Denied', description: 'Unauthorized access to Investors module.' });
            router.push('/admin');
        }
    }, [userLoading, canViewPage, currentUser, router, toast]);

    const { data: investors, loading: investorsLoading } = useCollection<Investor>(canViewPage ? 'investors' : null);
    const { data: applications, loading: appsLoading } = useCollection<InvestmentApplication>(canViewPage ? 'investmentApplications' : null);

    const addForm = useForm<z.infer<typeof investorSchema>>({
        resolver: zodResolver(investorSchema),
        defaultValues: { uid: '', name: '', email: '', totalInvestment: 0, interestRate: 0, createdAt: format(new Date(), 'yyyy-MM-dd') },
    });

    const editForm = useForm<z.infer<typeof investorSchema>>({
        resolver: zodResolver(investorSchema),
        defaultValues: { uid: '', name: '', email: '', totalInvestment: 0, interestRate: 0, createdAt: '' }
    });

    async function onAddSubmit(values: z.infer<typeof investorSchema>) {
        if (!canEdit) return;
        setIsSubmitting(true);
        try {
            await addInvestor(firestore, { uid: values.uid, name: values.name, email: values.email, totalInvestment: values.totalInvestment, currentBalance: values.totalInvestment, interestRate: values.interestRate || 0 });
            toast({ title: 'Investor Created' });
            setAddDialogOpen(false);
            addForm.reset();
        } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: error.message }); } finally { setIsSubmitting(false); }
    }

    const handleEditClick = (investor: Investor) => {
        if (!canEdit) return;
        setInvestorToEdit(investor);
        editForm.reset({ uid: investor.uid, name: investor.name, email: investor.email, totalInvestment: investor.totalInvestment, interestRate: investor.interestRate || 0, createdAt: (investor.createdAt as any)?.seconds ? format(new Date((investor.createdAt as any).seconds * 1000), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd') });
        setEditDialogOpen(true);
    };
    
    async function onEditSubmit(values: z.infer<typeof investorSchema>) {
      if (!investorToEdit || !canEdit) return;
      setIsSubmitting(true);
      try {
        const updateData: any = { name: values.name, email: values.email, totalInvestment: values.totalInvestment, interestRate: values.interestRate || 0 };
        if (values.createdAt) updateData.createdAt = new Date(values.createdAt);
        await updateInvestor(firestore, investorToEdit.id, updateData);
        toast({ title: "Updated" });
        setEditDialogOpen(false);
        setInvestorToEdit(null);
      } catch (error: any) { toast({ variant: "destructive", title: "Update Failed", description: error.message }); } finally { setIsSubmitting(false); }
    }
    
    const handleDeleteClick = (investor: Investor) => { 
        if (!canEdit) return;
        setInvestorToDelete(investor); 
        setDeleteDialogOpen(true); 
    };

    async function confirmDelete() {
        if (!investorToDelete || !canEdit) return;
        setIsSubmitting(true);
        try { await deleteInvestor(firestore, investorToDelete.id); toast({ title: 'Deleted' }); setDeleteDialogOpen(false); setInvestorToDelete(null); } catch (error: any) { toast({ variant: "destructive", title: "Delete Failed", description: error.message }); } finally { setIsSubmitting(false); }
    }
    
    if (userLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    
    if (currentUser && !canViewPage) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center text-center p-8 bg-card rounded-xl border border-dashed">
                <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p className="text-muted-foreground mt-2">Investor portfolios are restricted to Finance and Admin roles.</p>
            </div>
        );
    }

    const portfolioTotals = investors ? investors.reduce((acc, inv) => {
        acc.investment += (inv.totalInvestment || 0);
        acc.balance += (inv.currentBalance || 0);
        return acc;
    }, { investment: 0, balance: 0 }) : { investment: 0, balance: 0 };

    return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
            <TabsList>
                <TabsTrigger value="portfolios">Portfolios</TabsTrigger>
                <TabsTrigger value="applications" className="relative">
                    Applications
                    {applications && applications.filter(a => a.status === 'pending').length > 0 && (
                        <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                            {applications.filter(a => a.status === 'pending').length}
                        </Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger value="deposits" className="relative">
                    Pending Deposits
                    {investors && investors.some(inv => inv.deposits?.some(d => d.status === 'pending')) && (() => {
                        let count = 0;
                        investors.forEach(inv => count += (inv.deposits?.filter(d => d.status === 'pending').length || 0));
                        return count > 0 ? (
                            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] bg-amber-500 hover:bg-amber-600">
                                {count}
                            </Badge>
                        ) : null;
                    })()}
                </TabsTrigger>
                <TabsTrigger value="withdrawals" className="relative">
                    Withdrawals
                    {investors && investors.some(inv => inv.withdrawals?.some(w => w.status === 'pending')) && (() => {
                        let count = 0;
                        investors.forEach(inv => count += (inv.withdrawals?.filter(w => w.status === 'pending').length || 0));
                        return count > 0 ? (
                            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-500 hover:bg-blue-600">
                                {count}
                            </Badge>
                        ) : null;
                    })()}
                </TabsTrigger>
            </TabsList>
            
            {activeTab === 'portfolios' && canEdit && (
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" />Add Investor</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add New Investor</DialogTitle></DialogHeader>
                        <Form {...addForm}>
                        <ScrollArea className="max-h-[70vh] pr-4">
                            <form id="add-investor-form" onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 py-2">
                                <FormField control={addForm.control} name="uid" render={({ field }) => (<FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={addForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={addForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={addForm.control} name="totalInvestment" render={({ field }) => (<FormItem><FormLabel>Total Investment (Ksh)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={addForm.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Monthly Interest Rate (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                            </form>
                        </ScrollArea>
                        </Form>
                        <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="add-investor-form" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Investor</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>

        <TabsContent value="portfolios">
            <Card>
                <CardHeader><CardTitle>Investor Portfolios</CardTitle></CardHeader>
                <CardContent>
                {investorsLoading && (<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>)}
                {!investorsLoading && (!investors || investors.length === 0) ? (<Alert><AlertTitle>No Investors Found</AlertTitle></Alert>) : !investorsLoading && (
                    <ScrollArea className="h-[60vh]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Rate (%)</TableHead><TableHead className="text-right">Investment</TableHead><TableHead className="text-right">Balance</TableHead>{canEdit && <TableHead className="text-right w-[80px]">Actions</TableHead>}</TableRow></TableHeader>
                        <TableBody>{investors?.map((investor) => (
                                <TableRow key={investor.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{investor.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{investor.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            {investor.investmentType === 'Chama' ? <Landmark className="h-3 w-3" /> : investor.investmentType === 'Group' ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                            <span className="text-xs">{investor.investmentType || 'Individual'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{(investor.interestRate || 2.5).toFixed(2)}%</TableCell><TableCell className="text-right font-medium">{(investor.totalInvestment || 0).toLocaleString()}</TableCell><TableCell className="text-right font-bold">{(investor.currentBalance || 0).toLocaleString()}</TableCell>
                                {canEdit && (
                                    <TableCell className="text-right">
                                        <DropdownMenu open={openMenu === investor.id} onOpenChange={(isOpen) => setOpenMenu(isOpen ? investor.id : null)}>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEditClick(investor)}>Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDeleteClick(investor)} className="text-destructive">Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                )}
                                </TableRow>
                                ))}</TableBody>
                        <TableFooter>
                            <TableRow className="font-bold bg-muted/50">
                                <TableCell colSpan={3}>Grand Totals</TableCell>
                                <TableCell className="text-right">{portfolioTotals.investment.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{portfolioTotals.balance.toLocaleString()}</TableCell>
                                {canEdit && <TableCell />}
                            </TableRow>
                        </TableFooter>
                    </Table>
                    </ScrollArea>
                )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="applications">
            <Card>
                <CardHeader>
                    <CardTitle>Investment Applications</CardTitle>
                    <CardDescription>Review and approve new investor registration requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    {appsLoading ? (
                        <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : !applications || applications.filter(a => a.status === 'pending').length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-3xl">
                            <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                            <p className="text-sm text-muted-foreground">No pending applications found.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {applications.filter(a => a.status === 'pending').map((app) => (
                                <Card key={app.id} className="overflow-hidden border-2 hover:border-blue-200 transition-colors">
                                    <div className="bg-muted/30 p-4 border-b flex justify-between items-start">
                                        <div>
                                            <h4 className="font-black text-[#1B2B33]">{app.name}</h4>
                                            <p className="text-[10px] text-muted-foreground">{app.email} • {app.phone}</p>
                                        </div>
                                        <Badge className={app.type === 'Individual' ? 'bg-blue-100 text-blue-700' : app.type === 'Group' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}>
                                            {app.type}
                                        </Badge>
                                    </div>
                                    <CardContent className="p-4 space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Target Investment</p>
                                                <p className="text-xl font-black text-[#1B2B33]">Ksh {app.amount.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-muted-foreground">Submitted {app.createdAt?.seconds ? format(new Date(app.createdAt.seconds * 1000), 'MMM d, yyyy') : 'Recently'}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <Button 
                                                className="flex-1 bg-green-600 hover:bg-green-700 h-10 font-bold"
                                                disabled={!!actionLoading}
                                                onClick={async () => {
                                                    if (!currentUser) return;
                                                    setActionLoading(app.id);
                                                    try {
                                                        await approveInvestmentApplication(firestore, app.id, { id: currentUser.uid, name: currentUser.name || 'Admin' });
                                                        toast({ title: 'Application Approved', description: `${app.name} is now an active investor.` });
                                                    } catch (e: any) {
                                                        toast({ variant: 'destructive', title: 'Error', description: e.message });
                                                    } finally { setActionLoading(null); }
                                                }}
                                            >
                                                {actionLoading === app.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-2" /> Approve</>}
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                className="flex-1 text-destructive border-destructive/20 hover:bg-destructive/5 h-10 font-bold"
                                                disabled={!!actionLoading}
                                                onClick={async () => {
                                                    setActionLoading(app.id + '_reject');
                                                    try {
                                                        await rejectInvestmentApplication(firestore, app.id, 'Declined by admin');
                                                        toast({ title: 'Application Rejected' });
                                                    } catch (e: any) {
                                                        toast({ variant: 'destructive', title: 'Error', description: e.message });
                                                    } finally { setActionLoading(null); }
                                                }}
                                            >
                                                {actionLoading === app.id + '_reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-2" /> Decline</>}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

      {canEdit && <TabsContent value="deposits">
            <Card>
                <CardHeader>
                    <CardTitle>Pending Investment Deposits</CardTitle>
                    <CardDescription>Verify and approve customer-reported M-Pesa transfers.</CardDescription>
                </CardHeader>
                <CardContent>
                    {(() => {
                        const pendingDeposits: { investor: Investor; deposit: any }[] = [];
                        investors?.forEach(inv => {
                            (inv.deposits || []).filter(d => d.status === 'pending').forEach(d => pendingDeposits.push({ investor: inv, deposit: d }));
                        });
                        
                        if (pendingDeposits.length === 0) {
                            return (
                                <div className="text-center py-12 border-2 border-dashed rounded-3xl">
                                    <Landmark className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                                    <p className="text-sm text-muted-foreground">No pending deposits to review.</p>
                                </div>
                            );
                        }

                        return (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {pendingDeposits.map(({ investor, deposit }) => (
                                    <Card key={deposit.depositId} className="overflow-hidden border-2 hover:border-amber-200 transition-colors">
                                        <div className="bg-amber-50/50 p-4 border-b flex justify-between items-start">
                                            <div>
                                                <h4 className="font-black text-[#1B2B33]">{investor.name}</h4>
                                                <p className="text-[10px] text-muted-foreground">{investor.email}</p>
                                            </div>
                                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>
                                        </div>
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Amount Reported</p>
                                                    <p className="text-xl font-black text-[#1B2B33]">Ksh {deposit.amount.toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {deposit.date?.seconds ? format(new Date(deposit.date.seconds * 1000), 'MMM d, p') : 'Recently'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <Button 
                                                    className="flex-1 bg-green-600 hover:bg-green-700 h-10 font-bold"
                                                    disabled={approvingId === deposit.depositId}
                                                    onClick={async () => {
                                                        if (!currentUser) return;
                                                        setApprovingId(deposit.depositId);
                                                        try {
                                                            await approveDeposit(firestore, investor.id, deposit.depositId, { id: currentUser.uid, name: currentUser.name || 'Admin' });
                                                            toast({ title: 'Deposit Approved', description: `Ksh ${deposit.amount.toLocaleString()} added to ${investor.name}'s balance.` });
                                                        } catch (e: any) {
                                                            toast({ variant: 'destructive', title: 'Error', description: e.message });
                                                        } finally { setApprovingId(null); }
                                                    }}
                                                >
                                                    {approvingId === deposit.depositId ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-2" /> Approve</>}
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    className="flex-1 text-destructive border-destructive/20 hover:bg-destructive/5 h-10 font-bold"
                                                    disabled={approvingId === deposit.depositId}
                                                    onClick={async () => {
                                                        setApprovingId(deposit.depositId + '_reject');
                                                        try {
                                                            await rejectDeposit(firestore, investor.id, deposit.depositId);
                                                            toast({ title: 'Deposit Rejected' });
                                                        } catch (e: any) {
                                                            toast({ variant: 'destructive', title: 'Error', description: e.message });
                                                        } finally { setApprovingId(null); }
                                                    }}
                                                >
                                                    {approvingId === deposit.depositId + '_reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-2" /> Reject</>}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        );
                    })()}
                </CardContent>
            </Card>
        </TabsContent>}

        {canEdit && <TabsContent value="withdrawals">
            <Card>
                <CardHeader>
                    <CardTitle>Pending Withdrawals</CardTitle>
                    <CardDescription>Process customer requests to withdraw funds from their portfolios.</CardDescription>
                </CardHeader>
                <CardContent>
                    {(() => {
                        const pendingWithdrawals: { investor: Investor; withdrawal: any }[] = [];
                        investors?.forEach(inv => {
                            (inv.withdrawals || []).filter(w => w.status === 'pending').forEach(w => pendingWithdrawals.push({ investor: inv, withdrawal: w }));
                        });
                        
                        if (pendingWithdrawals.length === 0) {
                            return (
                                <div className="text-center py-12 border-2 border-dashed rounded-3xl">
                                    <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                                    <p className="text-sm text-muted-foreground">No pending withdrawals to process.</p>
                                </div>
                            );
                        }

                        return (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {pendingWithdrawals.map(({ investor, withdrawal }) => (
                                    <Card key={withdrawal.withdrawalId} className="overflow-hidden border-2 hover:border-blue-200 transition-colors">
                                        <div className="bg-blue-50/50 p-4 border-b flex justify-between items-start">
                                            <div>
                                                <h4 className="font-black text-[#1B2B33]">{investor.name}</h4>
                                                <p className="text-[10px] text-muted-foreground">Balance: Ksh {investor.currentBalance.toLocaleString()}</p>
                                            </div>
                                            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Withdrawal</Badge>
                                        </div>
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Requested Amount</p>
                                                    <p className="text-xl font-black text-[#1B2B33]">Ksh {withdrawal.amount.toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {withdrawal.date?.seconds ? format(new Date(withdrawal.date.seconds * 1000), 'MMM d, p') : 'Recently'}
                                                    </p>
                                                </div>
                                            </div>
                                            {withdrawal.amount > investor.currentBalance && (
                                                <Alert variant="destructive" className="py-2">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <AlertDescription className="text-[10px]">Insufficient balance!</AlertDescription>
                                                </Alert>
                                            )}
                                            <div className="flex gap-2 pt-2">
                                                <Button 
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 h-10 font-bold"
                                                    disabled={approvingId === withdrawal.withdrawalId || withdrawal.amount > investor.currentBalance}
                                                    onClick={async () => {
                                                        setApprovingId(withdrawal.withdrawalId);
                                                        try {
                                                            await processWithdrawal(firestore, investor.id, withdrawal.withdrawalId);
                                                            toast({ title: 'Withdrawal Processed' });
                                                        } catch (e: any) {
                                                            toast({ variant: 'destructive', title: 'Error', description: e.message });
                                                        } finally { setApprovingId(null); }
                                                    }}
                                                >
                                                    {approvingId === withdrawal.withdrawalId ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-2" /> Process</>}
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    className="flex-1 text-destructive border-destructive/20 hover:bg-destructive/5 h-10 font-bold"
                                                    disabled={approvingId === withdrawal.withdrawalId}
                                                    onClick={async () => {
                                                        setApprovingId(withdrawal.withdrawalId + '_reject');
                                                        try {
                                                            await rejectWithdrawal(firestore, investor.id, withdrawal.withdrawalId);
                                                            toast({ title: 'Withdrawal Rejected' });
                                                        } catch (e: any) {
                                                            toast({ variant: 'destructive', title: 'Error', description: e.message });
                                                        } finally { setApprovingId(null); }
                                                    }}
                                                >
                                                    {approvingId === withdrawal.withdrawalId + '_reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-2" /> Reject</>}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        );
                    })()}
                </CardContent>
            </Card>
        </TabsContent>}
      </Tabs>

      
      {canEdit && (
        <>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Investor</DialogTitle></DialogHeader>
                    <Form {...editForm}>
                    <ScrollArea className="max-h-[70vh] pr-4">
                        <form id="edit-investor-form" onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-2">
                            <FormField control={editForm.control} name="uid" render={({ field }) => (<FormItem><FormLabel>User ID (UID)</FormLabel><FormControl><Input {...field} disabled value={field.value ?? ''}/></FormControl></FormItem>)}/>
                            <FormField control={editForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl></FormItem>)}/>
                            <FormField control={editForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''}/></FormControl></FormItem>)}/>
                            <FormField control={editForm.control} name="totalInvestment" render={({ field }) => (<FormItem><FormLabel>Total Investment</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl></FormItem>)}/>
                            <FormField control={editForm.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Monthly Interest Rate (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl></FormItem>)}/>
                            <FormField control={editForm.control} name="createdAt" render={({ field }) => (<FormItem><FormLabel>Investment Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl></FormItem>)}/>
                        </form>
                    </ScrollArea>
                    </Form>
                    <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" form="edit-investor-form" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Portfolio?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setInvestorToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </>
      )}
    </>
  );
}
