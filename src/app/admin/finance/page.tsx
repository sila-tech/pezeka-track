'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns";
import { FileDown, Loader2, PlusCircle, PenSquare, Trash2, Search } from "lucide-react";
import { arrayUnion, arrayRemove, increment } from 'firebase/firestore';

import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addFinanceEntry, updateLoan, updateFinanceEntry, deleteFinanceEntry, rolloverLoan, deleteLoan, addPenaltyToLoan } from '@/lib/firestore';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { exportToCsv } from '@/lib/excel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FinanceReportTab } from './components/finance-report-tab';
import { EditableFinanceReportTab } from './components/editable-finance-report-tab';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateAmortization, calculateInterestForOneInstalment } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


const addFinanceEntrySchema = z.object({
  type: z.enum(['receipt', 'payout'], { required_error: 'Please select an entry type.' }),
  payoutReason: z.enum(['loan_disbursement', 'expense']).optional(),
  date: z.string().min(1, 'A date is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  transactionCost: z.coerce.number().optional(),
  description: z.string().optional(),
  loanId: z.string().optional(),
  expenseCategory: z.enum(['facilitation_commission', 'office_purchase', 'other']).optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'receipt' && !data.loanId) {
        ctx.addIssue({
            code: 'custom',
            message: 'Please select the loan this receipt is for.',
            path: ['loanId'],
        });
    }
    if (data.type === 'payout') {
        if (!data.payoutReason) {
            ctx.addIssue({
                code: 'custom',
                message: 'Please select a reason for the payout.',
                path: ['payoutReason'],
            });
        } else if (data.payoutReason === 'loan_disbursement' && !data.loanId) {
            ctx.addIssue({
                code: 'custom',
                message: 'Please select the loan being disbursed.',
                path: ['loanId'],
            });
        } else if (data.payoutReason === 'expense') {
            if (!data.expenseCategory) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'Please select an expense category.',
                    path: ['expenseCategory'],
                });
            } else if (data.expenseCategory === 'other' && !data.description) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'Description is required when category is "Other".',
                    path: ['description'],
                });
            }
        }
    }
});


const editFinanceEntrySchema = z.object({
  type: z.enum(['expense', 'payout', 'receipt']),
  date: z.string().min(1, 'A date is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  transactionCost: z.coerce.number().optional(),
  description: z.string().optional(),
  loanId: z.string().optional(),
  expenseCategory: z.enum(['facilitation_commission', 'office_purchase', 'other']).optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'expense') {
        if (!data.expenseCategory) {
            ctx.addIssue({
                code: 'custom',
                message: 'Please select an expense category.',
                path: ['expenseCategory'],
            });
        } else if (data.expenseCategory === 'other' && !data.description) {
            ctx.addIssue({
                code: 'custom',
                message: 'Description is required when category is "Other".',
                path: ['description'],
            });
        }
    }
});


const paymentSchema = z.object({
    paymentAmount: z.coerce.number().min(0.01, 'Payment amount must be greater than 0.'),
    paymentDate: z.string().min(1, 'Payment date is required.'),
    comments: z.string().optional(),
});

const penaltySchema = z.object({
    penaltyAmount: z.coerce.number().min(0.01, 'Penalty amount must be greater than 0.'),
    penaltyDate: z.string().min(1, 'Penalty date is required.'),
    penaltyDescription: z.string().min(1, 'A description for the penalty is required.'),
});


const editLoanSchema = z.object({
  disbursementDate: z.string().min(1, 'Disbursement date is required.'),
  principalAmount: z.coerce.number().min(1, 'Principal amount is required.'),
  interestRate: z.coerce.number().min(0, 'Interest rate cannot be negative.'),
  registrationFee: z.coerce.number().optional(),
  processingFee: z.coerce.number().optional(),
  carTrackInstallationFee: z.coerce.number().optional(),
  chargingCost: z.coerce.number().optional(),
  numberOfInstalments: z.coerce.number().int().min(1, 'Number of instalments is required.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  status: z.enum(['due', 'paid', 'active', 'rollover', 'overdue', 'application']),
});

const rolloverSchema = z.object({
    rolloverDate: z.string().min(1, 'Rollover date is required.'),
});


interface Payment {
  paymentId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
}

interface Penalty {
  penaltyId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  amount: number;
  description: string;
}

interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  idNumber?: string;
  loanType?: string;
  disbursementDate: { seconds: number, nanoseconds: number };
  principalAmount: number;
  interestRate?: number;
  registrationFee: number;
  processingFee: number;
  carTrackInstallationFee: number;
  chargingCost: number;
  numberOfInstalments: number;
  instalmentAmount: number;
  totalRepayableAmount: number;
  totalPaid: number;
  totalPenalties?: number;
  paymentFrequency: 'daily' | 'weekly' | 'monthly';
  payments?: Payment[];
  penalties?: Penalty[];
  comments?: string;
  status: 'due' | 'paid' | 'active' | 'rollover' | 'overdue' | 'application' | 'rejected';
}

interface FinanceEntry {
  id: string;
  type: 'expense' | 'payout' | 'receipt' | 'unearned';
  date: { seconds: number; nanoseconds: number } | string;
  amount: number;
  description: string;
  transactionCost?: number;
  loanId?: string;
  expenseCategory?: 'facilitation_commission' | 'office_purchase' | 'other';
}

const expenseCategoryLabels: Record<string, string> = {
    facilitation_commission: 'Facilitation Commission',
    office_purchase: 'Office Purchase',
};

export default function FinancePage() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingPenalty, setIsAddingPenalty] = useState(false);
  const [isEditingLoan, setIsEditingLoan] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);

  const [editEntryOpen, setEditEntryOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<FinanceEntry | null>(null);
  const [isUpdatingEntry, setIsUpdatingEntry] = useState(false);
  
  const [deleteEntryOpen, setDeleteEntryOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<FinanceEntry | null>(null);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

  const [deleteLoanOpen, setDeleteLoanOpen] = useState(false);
  const [isDeletingLoan, setIsDeletingLoan] = useState(false);
  
  const [loanBookSearchTerm, setLoanBookSearchTerm] = useState('');
  const [loanBookStatusFilter, setLoanBookStatusFilter] = useState('all');

  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isAuthorized = user ? (user.email === 'simon@pezeka.com' || user.role === 'finance') : false;

  const { data: loans, loading: loansLoading } = useCollection<Loan>(isAuthorized ? 'loans' : null);
  const { data: financeEntries, loading: financeEntriesLoading } = useCollection<FinanceEntry>(isAuthorized ? 'financeEntries' : null);
  
  const isLoading = userLoading || loansLoading || financeEntriesLoading;

  const filteredLoans = useMemo(() => {
    if(!loans) return [];
    return loans.filter(loan => {
        const statusMatch = loanBookStatusFilter === 'all' || loan.status === loanBookStatusFilter;
        const searchMatch = loanBookSearchTerm === '' ||
            loan.loanNumber.toLowerCase().includes(loanBookSearchTerm.toLowerCase()) ||
            loan.customerName.toLowerCase().includes(loanBookSearchTerm.toLowerCase()) ||
            loan.customerPhone.includes(loanBookSearchTerm);
        return statusMatch && searchMatch;
    });
  }, [loans, loanBookSearchTerm, loanBookStatusFilter]);
  
  const loanBookTotals = useMemo(() => {
      if (!filteredLoans) {
          return {
              principalAmount: 0,
              takeHome: 0,
              carTrackInstallationFee: 0,
              registrationFee: 0,
              processingFee: 0,
              chargingCost: 0,
              totalRepayableAmount: 0,
              totalPaid: 0,
              totalPenalties: 0,
              balance: 0,
          };
      }
      return filteredLoans.reduce((acc, loan) => {
          const takeHome = loan.principalAmount - (loan.registrationFee || 0) - (loan.processingFee || 0) - (loan.carTrackInstallationFee || 0) - (loan.chargingCost || 0);
          const balance = loan.totalRepayableAmount - loan.totalPaid;

          acc.principalAmount += loan.principalAmount;
          acc.takeHome += takeHome;
          acc.carTrackInstallationFee += (loan.carTrackInstallationFee || 0);
          acc.registrationFee += (loan.registrationFee || 0);
          acc.processingFee += (loan.processingFee || 0);
          acc.chargingCost += (loan.chargingCost || 0);
          acc.totalRepayableAmount += loan.totalRepayableAmount;
          acc.totalPaid += loan.totalPaid;
          acc.totalPenalties += (loan.totalPenalties || 0);
          acc.balance += balance;
          return acc;
      }, {
          principalAmount: 0,
          takeHome: 0,
          carTrackInstallationFee: 0,
          registrationFee: 0,
          processingFee: 0,
          chargingCost: 0,
          totalRepayableAmount: 0,
          totalPaid: 0,
          totalPenalties: 0,
          balance: 0,
      });
  }, [filteredLoans]);

  const addForm = useForm<z.infer<typeof addFinanceEntrySchema>>({
    resolver: zodResolver(addFinanceEntrySchema),
    defaultValues: {
        description: "",
        amount: undefined,
        date: format(new Date(), 'yyyy-MM-dd'),
        loanId: "",
        transactionCost: 0,
        payoutReason: undefined,
        expenseCategory: undefined,
    }
  });

  const editForm = useForm<z.infer<typeof editFinanceEntrySchema>>({
    resolver: zodResolver(editFinanceEntrySchema)
  });

  const { watch: addFinanceEntryWatch } = addForm;
  const addFinanceEntryType = addFinanceEntryWatch('type');
  const addPayoutReason = addFinanceEntryWatch('payoutReason');
  const addExpenseCategory = addFinanceEntryWatch('expenseCategory');
  
  const { watch: editFinanceEntryWatch } = editForm;
  const editFinanceEntryType = editFinanceEntryWatch('type');
  const editExpenseCategory = editFinanceEntryWatch('expenseCategory');


  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
        paymentAmount: undefined,
        comments: '',
    },
  });
  
  const penaltyForm = useForm<z.infer<typeof penaltySchema>>({
    resolver: zodResolver(penaltySchema),
    defaultValues: {
        penaltyAmount: undefined,
        penaltyDate: format(new Date(), 'yyyy-MM-dd'),
        penaltyDescription: '',
    },
  });

  const editLoanForm = useForm<z.infer<typeof editLoanSchema>>({
    resolver: zodResolver(editLoanSchema),
  });

  const rolloverForm = useForm<z.infer<typeof rolloverSchema>>({
    resolver: zodResolver(rolloverSchema),
    defaultValues: {
        rolloverDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const { watch } = editLoanForm;
  const principalAmount = watch('principalAmount');
  const interestRate = watch('interestRate');
  const numberOfInstalments = watch('numberOfInstalments');
  const paymentFrequency = watch('paymentFrequency');

  const recalculatedValues = useMemo(() => {
    if (!principalAmount || !interestRate || !numberOfInstalments || !paymentFrequency) {
        return { instalmentAmount: '0.00', totalRepayableAmount: '0.00' };
    }
    const { instalmentAmount, totalRepayableAmount } = calculateAmortization(principalAmount, interestRate, numberOfInstalments, paymentFrequency);
    return {
        instalmentAmount: instalmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalRepayableAmount: totalRepayableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
  }, [principalAmount, interestRate, numberOfInstalments, paymentFrequency]);

    const interestForRollover = useMemo(() => {
        if (!loanToEdit) return 0;
        return calculateInterestForOneInstalment(
            loanToEdit.principalAmount,
            loanToEdit.interestRate || 0,
            loanToEdit.numberOfInstalments,
            loanToEdit.paymentFrequency
        );
    }, [loanToEdit]);

  async function onAddSubmit(values: z.infer<typeof addFinanceEntrySchema>) {
    setIsSubmitting(true);
    try {
      const entryType = values.type === 'payout' 
        ? (values.payoutReason === 'loan_disbursement' ? 'payout' : 'expense') 
        : 'receipt';

      const loanForReceipt = values.type === 'receipt' ? loans?.find(l => l.id === values.loanId) : undefined;
      const loanForPayout = (values.type === 'payout' && values.payoutReason === 'loan_disbursement') ? loans?.find(l => l.id === values.loanId) : undefined;
       
      if (entryType === 'receipt' && !loanForReceipt) throw new Error("Selected loan not found for receipt.");
      if (entryType === 'payout' && !loanForPayout) throw new Error("Selected loan not found for payout.");

      let description = values.description;
      if (!description) {
        if (entryType === 'receipt' && loanForReceipt) {
          description = `Payment for Loan #${loanForReceipt.loanNumber} by ${loanForReceipt.customerName}`;
        } else if (entryType === 'payout' && loanForPayout) {
          description = `Disbursement for Loan #${loanForPayout.loanNumber}`;
        } else if (entryType === 'expense' && values.expenseCategory && values.expenseCategory !== 'other') {
          description = expenseCategoryLabels[values.expenseCategory];
        }
      }
      
      const rawEntryData: { [key: string]: any } = {
          ...values,
          type: entryType,
          date: new Date(values.date),
          description,
      };
      delete rawEntryData.payoutReason;


      const entryData = Object.fromEntries(
        Object.entries(rawEntryData).filter(([_, v]) => v)
      );

      const docRef = await addFinanceEntry(firestore, entryData as any);

      if (values.type === 'receipt' && loanForReceipt) {
        const currentTotalPaid = loanForReceipt.totalPaid || 0;
        const newTotalPaid = currentTotalPaid + values.amount;
        
        const newPayment: Payment = {
            paymentId: docRef.id,
            amount: values.amount,
            date: new Date(values.date),
        };

        const newStatus = newTotalPaid >= loanForReceipt.totalRepayableAmount ? 'paid' : loanForReceipt.status;

        await updateLoan(firestore, loanForReceipt.id, {
            totalPaid: newTotalPaid,
            payments: arrayUnion(newPayment),
            status: newStatus,
        });
      }
      
      toast({
          title: 'Finance Entry Added',
          description: `A new ${entryType} entry of Ksh ${values.amount.toLocaleString()} has been added.`,
      });

      addForm.reset();
      setOpen(false);
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: error.message || "Could not add finance entry. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleExport = () => {
    if (loans) {
      const dataForExport = loans.map(loan => {
        const takeHome = loan.principalAmount - (loan.registrationFee || 0) - (loan.processingFee || 0) - (loan.carTrackInstallationFee || 0) - (loan.chargingCost || 0);
        const balance = loan.totalRepayableAmount - loan.totalPaid;
        return {
          'Client Name': loan.customerName,
          'Client Phone Number': loan.customerPhone,
          'Loan No.': loan.loanNumber,
          'Date': format(new Date(loan.disbursementDate.seconds * 1000), 'PPP'),
          'Principal Amount': loan.principalAmount,
          'Interest Rate (%)': loan.interestRate || 0,
          'Registration Fee': loan.registrationFee,
          'Processing Fee': loan.processingFee,
          'Take Home': takeHome,
          'Car Track Installation': loan.carTrackInstallationFee,
          'Charging Cost': loan.chargingCost,
          'No. of Instalments': loan.numberOfInstalments,
          'Instalment Amount': loan.instalmentAmount,
          'Amount to Pay': loan.totalRepayableAmount,
          'Paid Amount': loan.totalPaid,
          'Balance': balance,
          'Status': loan.status,
          'Comments': loan.comments,
        };
      });
      exportToCsv(dataForExport, 'loan_book');
    }
  };
  
  const handleEditLoanClick = (loan: Loan) => {
    setLoanToEdit(loan);
    paymentForm.reset({
        paymentAmount: undefined,
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        comments: loan.comments || '',
    });
     penaltyForm.reset({
        penaltyAmount: undefined,
        penaltyDate: format(new Date(), 'yyyy-MM-dd'),
        penaltyDescription: '',
    });
    editLoanForm.reset({
        disbursementDate: format(new Date(loan.disbursementDate.seconds * 1000), 'yyyy-MM-dd'),
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate || 0,
        registrationFee: loan.registrationFee || 0,
        processingFee: loan.processingFee || 0,
        carTrackInstallationFee: loan.carTrackInstallationFee || 0,
        chargingCost: loan.chargingCost || 0,
        numberOfInstalments: loan.numberOfInstalments,
        paymentFrequency: loan.paymentFrequency,
        status: loan.status,
    });
    rolloverForm.reset({
        rolloverDate: format(new Date(), 'yyyy-MM-dd'),
    });
  }

  async function onPaymentSubmit(values: z.infer<typeof paymentSchema>) {
    if (!loanToEdit) return;
    setIsUpdating(true);
    try {
        const description = `Payment for Loan #${loanToEdit.loanNumber} by ${loanToEdit.customerName}`;
        const receiptData = { 
            type: 'receipt' as const,
            date: new Date(values.paymentDate),
            amount: values.paymentAmount,
            description: description,
            loanId: loanToEdit.id
        };

        const docRef = await addFinanceEntry(firestore, receiptData);

        const currentTotalPaid = loanToEdit.totalPaid || 0;
        const newTotalPaid = currentTotalPaid + values.paymentAmount;
        
        const newPayment: Payment = {
            paymentId: docRef.id,
            amount: values.paymentAmount,
            date: new Date(values.paymentDate),
        };

        const newStatus = newTotalPaid >= loanToEdit.totalRepayableAmount ? 'paid' : loanToEdit.status;

        await updateLoan(firestore, loanToEdit.id, {
            totalPaid: newTotalPaid,
            payments: arrayUnion(newPayment),
            comments: values.comments,
            status: newStatus,
        });

        toast({
            title: "Payment Recorded",
            description: `Payment of Ksh ${values.paymentAmount.toLocaleString()} for loan #${loanToEdit.loanNumber} has been recorded.`,
        });
        setLoanToEdit(null);
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Update failed",
            description: "Could not record payment. Please try again.",
        });
    } finally {
        setIsUpdating(false);
    }
  }

  async function onPenaltySubmit(values: z.infer<typeof penaltySchema>) {
    if (!loanToEdit) return;
    setIsAddingPenalty(true);
    try {
        const penaltyData = {
            amount: values.penaltyAmount,
            date: new Date(values.penaltyDate),
            description: values.penaltyDescription,
        };

        await addPenaltyToLoan(firestore, loanToEdit.id, penaltyData);

        toast({
            title: "Penalty Added",
            description: `A penalty of Ksh ${values.penaltyAmount.toLocaleString()} has been added to loan #${loanToEdit.loanNumber}.`,
        });
        setLoanToEdit(null); // This will close the dialog and refresh the data
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Failed to Add Penalty",
            description: "Could not add penalty. Please try again.",
        });
    } finally {
        setIsAddingPenalty(false);
    }
  }

  async function onLoanEditSubmit(values: z.infer<typeof editLoanSchema>) {
    if (!loanToEdit) return;
    setIsEditingLoan(true);

    const { instalmentAmount, totalRepayableAmount } = calculateAmortization(
        values.principalAmount,
        values.interestRate ?? 0,
        values.numberOfInstalments,
        values.paymentFrequency
    );
    
    // Recalculate total repayable including existing penalties
    const currentPenalties = loanToEdit.totalPenalties || 0;
    const finalTotalRepayable = totalRepayableAmount + currentPenalties;


    const rawUpdateData: { [key: string]: any } = {
        ...values,
        disbursementDate: new Date(values.disbursementDate),
        instalmentAmount,
        totalRepayableAmount: finalTotalRepayable,
    };

    const updateData = Object.fromEntries(
        Object.entries(rawUpdateData).filter(([, v]) => v)
    );

    try {
        await updateLoan(firestore, loanToEdit.id, updateData);
        toast({
            title: "Loan Updated",
            description: `Loan #${loanToEdit.loanNumber} has been updated successfully.`,
        });
        setLoanToEdit(null); // Close dialog on success
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Update failed",
            description: "Could not update loan details. Please try again.",
        });
    } finally {
        setIsEditingLoan(false);
    }
}

  const handleEditEntryClick = (entry: FinanceEntry) => {
    setEntryToEdit(entry);
    editForm.reset({
        ...entry,
        date: format(typeof entry.date === 'string' ? new Date(entry.date) : new Date(entry.date.seconds * 1000), 'yyyy-MM-dd'),
    });
    setEditEntryOpen(true);
  };

  async function onEditEntrySubmit(values: z.infer<typeof editFinanceEntrySchema>) {
    if (!entryToEdit) return;
    setIsUpdatingEntry(true);
    try {
        const description = (values.type === 'expense' && values.expenseCategory && values.expenseCategory !== 'other' && !values.description)
            ? expenseCategoryLabels[values.expenseCategory]
            : values.description;
        
        const originalAmount = entryToEdit.amount;
        
        const rawUpdateData: {[key: string]: any} = {
            ...values,
            date: new Date(values.date),
            description
        };
        
        const updateData = Object.fromEntries(
            Object.entries(rawUpdateData).filter(([, v]) => v)
        );

        await updateFinanceEntry(firestore, entryToEdit.id, updateData);

        if (entryToEdit.type === 'receipt' && entryToEdit.loanId && values.amount !== originalAmount) {
            const loan = loans?.find(l => l.id === entryToEdit.loanId);
            if(loan) {
                const amountDifference = values.amount - originalAmount;
                const updatedPayments = loan.payments?.map(p => 
                    p.paymentId === entryToEdit.id ? { ...p, amount: values.amount, date: new Date(values.date) } : p
                );

                if (updatedPayments) {
                    await updateLoan(firestore, loan.id, {
                        totalPaid: increment(amountDifference),
                        payments: updatedPayments,
                    });
                }
            }
        }

        toast({
            title: 'Entry Updated',
            description: 'The finance entry has been updated successfully.'
        });
        setEditEntryOpen(false);
        setEntryToEdit(null);
    } catch(error: any) {
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message || "Could not update the entry. Please try again.",
        });
    } finally {
        setIsUpdatingEntry(false);
    }
  }

  const handleDeleteEntryClick = (entry: FinanceEntry) => {
    setEntryToDelete(entry);
    setDeleteEntryOpen(true);
  };
  
  async function confirmDeleteEntry() {
    if (!entryToDelete) return;
    setIsDeletingEntry(true);

    try {
        if(entryToDelete.type === 'receipt' && entryToDelete.loanId) {
            const loan = loans?.find(l => l.id === entryToDelete.loanId);
            if(loan) {
                const paymentToRemove = loan.payments?.find(p => p.paymentId === entryToDelete.id);
                
                if (paymentToRemove) {
                    await updateLoan(firestore, loan.id, {
                        totalPaid: increment(-entryToDelete.amount),
                        payments: arrayRemove(paymentToRemove)
                    });
                }
            }
        }
        await deleteFinanceEntry(firestore, entryToDelete.id);

        toast({
            title: 'Entry Deleted',
            description: 'The finance entry has been deleted successfully.'
        });

    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Delete Failed",
            description: error.message || "Could not delete the entry. Please try again.",
        });
    } finally {
        setDeleteEntryOpen(false);
        setEntryToDelete(null);
        setIsDeletingEntry(false);
    }
  }

  async function onRolloverSubmit(values: z.infer<typeof rolloverSchema>) {
    if (!loanToEdit) return;
    setIsRollingOver(true);
    try {
        await rolloverLoan(firestore, loanToEdit, new Date(values.rolloverDate));
        toast({
            title: "Loan Rolled Over",
            description: `Loan #${loanToEdit.loanNumber} has been rolled over into a new loan.`,
        });
        setLoanToEdit(null); // Close dialog
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Rollover Failed",
            description: error.message || "Could not rollover the loan. Please try again.",
        });
    } finally {
        setIsRollingOver(false);
    }
  }

  async function handleDeleteLoan() {
    if (!loanToEdit) return;
    setIsDeletingLoan(true);

    try {
        await deleteLoan(firestore, loanToEdit.id);

        toast({
            title: 'Loan Deleted',
            description: `Loan #${loanToEdit.loanNumber} has been permanently deleted.`
        });
        
        setLoanToEdit(null); // Close the manage dialog
        setDeleteLoanOpen(false); // Close the confirmation dialog

    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: error.message || "Could not delete the loan. Please try again.",
        });
    } finally {
        setIsDeletingLoan(false);
    }
  }


  const receipts = useMemo(() => financeEntries?.filter(e => e.type === 'receipt') ?? null, [financeEntries]);
  const payouts = useMemo(() => financeEntries?.filter(e => e.type === 'payout') ?? null, [financeEntries]);
  const expenses = useMemo(() => financeEntries?.filter(e => e.type === 'expense') ?? null, [financeEntries]);

  const unearnedIncomeEntries = useMemo(() => {
    if (!loans) return null;
    return loans.map(loan => ({
        id: loan.id,
        type: 'unearned' as const,
        date: loan.disbursementDate,
        amount: (loan.registrationFee || 0) + (loan.processingFee || 0),
        description: `Fees from Loan #${loan.loanNumber}`
    })).filter(entry => entry.amount > 0);
  }, [loans]);

  const earnedInterestEntries = useMemo(() => {
    if (!loans) return null;
    
    return loans.flatMap(loan => {
        if (!loan.payments || loan.payments.length === 0 || !loan.interestRate || loan.interestRate === 0) {
            return [];
        }

        const { totalRepayableAmount } = calculateAmortization(
            loan.principalAmount,
            loan.interestRate,
            loan.numberOfInstalments,
            loan.paymentFrequency
        );

        if (totalRepayableAmount <= loan.principalAmount) {
            return [];
        }

        const totalInterest = totalRepayableAmount - loan.principalAmount;
        const interestRatio = loan.principalAmount > 0 ? totalInterest / loan.principalAmount : 0;

        return (loan.payments || []).map((payment) => {
            const interestPaid = payment.amount * interestRatio;
            
            if (interestPaid > 0) {
                return {
                    id: payment.paymentId,
                    type: 'receipt' as const,
                    date: payment.date as { seconds: number; nanoseconds: number },
                    amount: interestPaid,
                    description: `Interest from payment on Loan #${loan.loanNumber}`
                };
            }
            return null;
        }).filter((entry): entry is FinanceEntry => entry !== null);
    });
  }, [loans]);


  const earnedIncomeEntries = useMemo(() => {
    if (!unearnedIncomeEntries || !earnedInterestEntries) return null;
    return [...unearnedIncomeEntries, ...earnedInterestEntries];
  }, [unearnedIncomeEntries, earnedInterestEntries]);

  const allLoanPayments = useMemo(() => {
    if (!loans) return null;
    return loans.flatMap(loan => 
        (loan.payments || []).map(payment => ({
            id: payment.paymentId,
            type: 'receipt' as const,
            date: payment.date as { seconds: number; nanoseconds: number },
            amount: payment.amount,
            description: `Payment from ${loan.customerName} (Loan #${loan.loanNumber})`
        }))
    );
  }, [loans]);


  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Entry
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a New Finance Entry</DialogTitle>
                    <DialogDescription>
                        Fill in the details below to record a financial transaction.
                    </DialogDescription>
                </DialogHeader>
                <Form {...addForm}>
                    <div className="max-h-[70vh] overflow-y-auto pr-4">
                        <form onSubmit={addForm.handleSubmit(onAddSubmit)} id="add-finance-entry-form" className="space-y-4">
                            <FormField
                                control={addForm.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Entry Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an entry type" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        <SelectItem value="receipt">Receipt</SelectItem>
                                        <SelectItem value="payout">Payout</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {addFinanceEntryType === 'payout' && (
                                <FormField
                                    control={addForm.control}
                                    name="payoutReason"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>Reason for Payout</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                    className="flex flex-col space-y-1"
                                                >
                                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                                        <FormControl>
                                                            <RadioGroupItem value="loan_disbursement" />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">
                                                            New Loan Disbursement
                                                        </FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                                        <FormControl>
                                                            <RadioGroupItem value="expense" />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">
                                                            Expense
                                                        </FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            {(addFinanceEntryType === 'receipt' || (addFinanceEntryType === 'payout' && addPayoutReason === 'loan_disbursement')) && (
                                <FormField
                                    control={addForm.control}
                                    name="loanId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>For Loan</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loansLoading}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={loansLoading ? "Loading loans..." : "Select a loan"} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {loans && loans.filter(l => l.status !== 'paid').map(loan => (
                                                        <SelectItem key={loan.id} value={loan.id}>
                                                            {`#${loan.loanNumber} - ${loan.customerName} (Balance: ${(loan.totalRepayableAmount - loan.totalPaid).toLocaleString()})`}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            {addFinanceEntryType === 'payout' && addPayoutReason === 'expense' && (
                                <FormField
                                    control={addForm.control}
                                    name="expenseCategory"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Expense Category</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a category" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="facilitation_commission">Facilitation Commission</SelectItem>
                                                    <SelectItem value="office_purchase">Office Purchase</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            <FormField
                                control={addForm.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={addForm.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Amount (Ksh)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {addFinanceEntryType === 'payout' && (
                                <FormField
                                    control={addForm.control}
                                    name="transactionCost"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Transaction Cost (Optional)</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            <FormField
                                control={addForm.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Description {(addFinanceEntryType === 'payout' && addPayoutReason === 'expense' && addExpenseCategory === 'other') ? '' : '(Optional)'}</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Describe the transaction..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </form>
                    </div>
                    <DialogFooter className="pt-4">
                        <DialogClose asChild>
                            <Button type="button" variant="ghost">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" form="add-finance-entry-form" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add Entry
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
      </div>
      <Tabs defaultValue="receipts">
          <ScrollArea className="w-full whitespace-nowrap pb-4">
              <TabsList className="inline-flex w-max">
                  <TabsTrigger value="receipts">Receipts</TabsTrigger>
                  <TabsTrigger value="payouts">Payouts</TabsTrigger>
                  <TabsTrigger value="expenses">Expenses</TabsTrigger>
                  <TabsTrigger value="unearned">Unearned Income</TabsTrigger>
                  <TabsTrigger value="earned_interest">Earned Interest</TabsTrigger>
                  <TabsTrigger value="earned_income">Earned Income</TabsTrigger>
                  <TabsTrigger value="payments">All Payments</TabsTrigger>
                  <TabsTrigger value="loanbook">Loan Book</TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <TabsContent value="receipts">
              <EditableFinanceReportTab 
                title="Receipts"
                description="Amount received from customers."
                entries={receipts}
                loading={isLoading}
                onEdit={handleEditEntryClick}
                onDelete={handleDeleteEntryClick}
              />
          </TabsContent>
          <TabsContent value="payouts">
              <EditableFinanceReportTab 
                title="Payouts"
                description="Amount disbursed to customers, including costs."
                entries={payouts}
                loading={isLoading}
                onEdit={handleEditEntryClick}
                onDelete={handleDeleteEntryClick}
              />
          </TabsContent>
          <TabsContent value="expenses">
               <EditableFinanceReportTab 
                title="Expenses"
                description="Money spent on facilitation and other costs."
                entries={expenses}
                loading={isLoading}
                onEdit={handleEditEntryClick}
                onDelete={handleDeleteEntryClick}
              />
          </TabsContent>
          <TabsContent value="unearned">
            <FinanceReportTab
              title="Unearned Income"
              description="Total income from upfront fees (registration and processing fees)."
              entries={unearnedIncomeEntries}
              loading={isLoading}
            />
          </TabsContent>
          <TabsContent value="earned_interest">
            <FinanceReportTab
              title="Earned Interest"
              description="Interest portion of loan payments that have been received."
              entries={earnedInterestEntries}
              loading={isLoading}
            />
          </TabsContent>
          <TabsContent value="earned_income">
            <FinanceReportTab
              title="Earned Income"
              description="Total income from upfront fees and interest payments received."
              entries={earnedIncomeEntries}
              loading={isLoading}
            />
          </TabsContent>
           <TabsContent value="payments">
            <FinanceReportTab
              title="All Loan Payments"
              description="A consolidated list of all individual payments made against loans."
              entries={allLoanPayments}
              loading={isLoading}
            />
          </TabsContent>
          <TabsContent value="loanbook">
              <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Loan Book</CardTitle>
                            <CardDescription>A complete record of all loans.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 mt-4 sm:mt-0">
                            <Select value={loanBookStatusFilter} onValueChange={setLoanBookStatusFilter}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="due">Due</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="rollover">Rollover</SelectItem>
                                    <SelectItem value="application">Application</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search loan book..."
                                    value={loanBookSearchTerm}
                                    onChange={(e) => setLoanBookSearchTerm(e.target.value)}
                                    className="pl-8 w-full sm:w-[250px]"
                                />
                            </div>
                            <Button variant="outline" onClick={handleExport} disabled={!loans || loans.length === 0}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Download CSV
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                  <CardContent>
                      {isLoading && (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {!isLoading && (!filteredLoans || filteredLoans.length === 0) && (
                        <Alert>
                            <AlertTitle>No Loans Found</AlertTitle>
                            <AlertDescription>
                                {loanBookSearchTerm || loanBookStatusFilter !== 'all'
                                    ? "No loans match your search criteria."
                                    : "There are no loans in the system yet. Add a loan to see it here."
                                }
                            </AlertDescription>
                        </Alert>
                      )}
                      {!isLoading && filteredLoans && filteredLoans.length > 0 && (
                        <div className="relative max-h-[60vh] overflow-y-auto">
                          <Table>
                              <TableHeader className="sticky top-0 bg-card">
                                  <TableRow>
                                      <TableHead>Client Name</TableHead>
                                      <TableHead>Phone</TableHead>
                                      <TableHead>Loan No.</TableHead>
                                      <TableHead>Date</TableHead>
                                      <TableHead className="text-right">Principal</TableHead>
                                      <TableHead className="text-right">Interest Rate (%)</TableHead>
                                      <TableHead className="text-right">Reg. Fee</TableHead>
                                      <TableHead className="text-right">Proc. Fee</TableHead>
                                      <TableHead className="text-right">Take Home</TableHead>
                                      <TableHead className="text-right">Car Track</TableHead>
                                      <TableHead className="text-right">Charging Cost</TableHead>
                                      <TableHead className="text-center">Instalments</TableHead>
                                      <TableHead className="text-right">Instalment Amt</TableHead>
                                      <TableHead className="text-right">To Pay</TableHead>
                                      <TableHead className="text-right">Paid</TableHead>
                                      <TableHead className="text-right">Penalties</TableHead>
                                      <TableHead className="text-right">Balance</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {filteredLoans.map((loan) => {
                                      const takeHome = loan.principalAmount - (loan.registrationFee || 0) - (loan.processingFee || 0) - (loan.carTrackInstallationFee || 0) - (loan.chargingCost || 0);
                                      const balance = loan.totalRepayableAmount - loan.totalPaid;
                                      return (
                                          <TableRow key={loan.id}>
                                              <TableCell className="font-medium">{loan.customerName}</TableCell>
                                              <TableCell>{loan.customerPhone}</TableCell>
                                              <TableCell>{loan.loanNumber}</TableCell>
                                              <TableCell>{format(new Date(loan.disbursementDate.seconds * 1000), 'dd/MM/yyyy')}</TableCell>
                                              <TableCell className="text-right">{loan.principalAmount.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.interestRate || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.registrationFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.processingFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-medium">{takeHome.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.carTrackInstallationFee || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{(loan.chargingCost || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-center">{loan.numberOfInstalments}</TableCell>
                                              <TableCell className="text-right">{loan.instalmentAmount.toLocaleString()}</TableCell>
                                              <TableCell className="text-right">{loan.totalRepayableAmount.toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-green-600">{loan.totalPaid.toLocaleString()}</TableCell>
                                              <TableCell className="text-right text-destructive">{(loan.totalPenalties || 0).toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-bold">{balance.toLocaleString()}</TableCell>
                                              <TableCell>
                                                  <Badge variant={loan.status === 'paid' ? 'default' : (loan.status === 'due' || loan.status === 'overdue' || loan.status === 'application' || loan.status === 'rejected') ? 'destructive' : 'secondary'}>
                                                      {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                                  </Badge>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                  <Button variant="ghost" size="sm" onClick={() => handleEditLoanClick(loan)}>
                                                      <PenSquare className="h-4 w-4" />
                                                  </Button>
                                              </TableCell>
                                          </TableRow>
                                      )
                                  })}
                              </TableBody>
                              <TableFooter>
                                <TableRow className="font-bold bg-muted/50 sticky bottom-0">
                                    <TableCell colSpan={4} className="text-right">Totals</TableCell>
                                    <TableCell className="text-right">{(loanBookTotals.principalAmount || 0).toLocaleString()}</TableCell>
                                    <TableCell /> {/* Interest Rate */}
                                    <TableCell className="text-right">{(loanBookTotals.registrationFee || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{(loanBookTotals.processingFee || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{(loanBookTotals.takeHome || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{(loanBookTotals.carTrackInstallationFee || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{(loanBookTotals.chargingCost || 0).toLocaleString()}</TableCell>
                                    <TableCell /> {/* Instalments */}
                                    <TableCell /> {/* Instalment Amt */}
                                    <TableCell className="text-right">{(loanBookTotals.totalRepayableAmount || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-green-600">{(loanBookTotals.totalPaid || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-destructive">{(loanBookTotals.totalPenalties || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-bold">{(loanBookTotals.balance || 0).toLocaleString()}</TableCell>
                                    <TableCell /> {/* Status */}
                                    <TableCell /> {/* Actions */}
                                </TableRow>
                            </TableFooter>
                          </Table>
                        </div>
                      )}
                  </CardContent>
              </Card>
          </TabsContent>
      </Tabs>

      {/* Edit Finance Entry Dialog */}
      <Dialog open={editEntryOpen} onOpenChange={setEditEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Finance Entry</DialogTitle>
            <DialogDescription>Update the details of this transaction.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <div className="max-h-[70vh] overflow-y-auto pr-4">
              <form onSubmit={editForm.handleSubmit(onEditEntrySubmit)} id="edit-finance-entry-form" className="space-y-4">
                  <FormField control={editForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>Entry Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="receipt">Receipt</SelectItem><SelectItem value="payout">Payout</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select><FormMessage/></FormItem>)} />
                  {editFinanceEntryType === 'receipt' && (
                      <FormField control={editForm.control} name="loanId" render={({ field }) => (<FormItem><FormLabel>For Loan</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled><FormControl><SelectTrigger><SelectValue placeholder={loansLoading ? "Loading loans..." : "Select a loan"} /></SelectTrigger></FormControl><SelectContent>{loans?.map(loan => (<SelectItem key={loan.id} value={loan.id}>{`#${loan.loanNumber} - ${loan.customerName}`}</SelectItem>))}</SelectContent></Select><FormMessage/></FormItem>)} />
                  )}
                  {editFinanceEntryType === 'expense' && (
                      <FormField control={editForm.control} name="expenseCategory" render={({ field }) => (<FormItem><FormLabel>Expense Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl><SelectContent><SelectItem value="facilitation_commission">Facilitation Commission</SelectItem><SelectItem value="office_purchase">Office Purchase</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select><FormMessage/></FormItem>)} />
                  )}
                  <FormField control={editForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field}/></FormControl><FormMessage/></FormItem>)} />
                  <FormField control={editForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (Ksh)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem>)} />
                  {(editFinanceEntryType === 'payout' || editFinanceEntryType === 'expense') && (
                      <FormField control={editForm.control} name="transactionCost" render={({ field }) => (<FormItem><FormLabel>Transaction Cost</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)} />
                  )}
                  <FormField control={editForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description {editFinanceEntryType === 'expense' && editExpenseCategory === 'other' ? '' : '(Optional)'}</FormLabel><FormControl><Textarea {...field}/></FormControl><FormMessage/></FormItem>)} />
              </form>
            </div>
            <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit" form="edit-finance-entry-form" disabled={isUpdatingEntry}>{isUpdatingEntry && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Changes</Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Finance Entry Confirmation */}
      <AlertDialog open={deleteEntryOpen} onOpenChange={setDeleteEntryOpen}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the entry.
                    {entryToDelete?.type === 'receipt' && entryToDelete.loanId && " The associated loan's balance will be automatically adjusted."}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setEntryToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteEntry} disabled={isDeletingEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeletingEntry && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Loan Confirmation */}
      <AlertDialog open={deleteLoanOpen} onOpenChange={setDeleteLoanOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete loan <strong>#{loanToEdit?.loanNumber}</strong>. Associated financial entries will not be deleted.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeleteLoan}
                    disabled={isDeletingLoan}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                    {isDeletingLoan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Yes, delete loan
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!loanToEdit} onOpenChange={(isOpen) => !isOpen && setLoanToEdit(null)}>
        <DialogContent className="sm:max-w-4xl">
            {loanToEdit && (
                <>
                    <DialogHeader>
                        <DialogTitle>Manage Loan #{loanToEdit.loanNumber}</DialogTitle>
                        <DialogDescription>
                        For {loanToEdit.customerName}. Current balance: Ksh {(loanToEdit.totalRepayableAmount - loanToEdit.totalPaid).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="payment" className="mt-4">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="payment">Record Payment & Comments</TabsTrigger>
                            <TabsTrigger value="penalty">Add Penalty</TabsTrigger>
                            <TabsTrigger value="edit">Edit Loan Details</TabsTrigger>
                            <TabsTrigger value="rollover">Rollover Loan</TabsTrigger>
                            <TabsTrigger value="delete" className="text-destructive">Delete Loan</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="payment">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle>Record a New Payment</CardTitle></CardHeader>
                                        <CardContent>
                                            <Form {...paymentForm}>
                                                <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4" id="payment-form">
                                                    <FormField control={paymentForm.control} name="paymentAmount" render={({ field }) => (<FormItem><FormLabel>Payment Amount (Ksh)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={paymentForm.control} name="paymentDate" render={({ field }) => (<FormItem><FormLabel>Payment Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={paymentForm.control} name="comments" render={({ field }) => (<FormItem><FormLabel>Loan Comments</FormLabel><FormControl><Textarea placeholder="Add any comments about the loan (e.g., rollover request)..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                                                </form>
                                            </Form>
                                        </CardContent>
                                    </Card>
                                </div>
                                <div>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Payment History</CardTitle>
                                            <CardDescription>All payments recorded for this loan.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ScrollArea className="h-72">
                                                {(!loanToEdit.payments || loanToEdit.payments.length === 0) ? (
                                                <Alert>
                                                    <AlertTitle>No Payments Yet</AlertTitle>
                                                    <AlertDescription>No payments have been recorded for this loan.</AlertDescription>
                                                </Alert>
                                                ) : (
                                                <Table>
                                                    <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                    {loanToEdit.payments.sort((a,b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()).map((payment) => {
                                                        const paymentEntry = financeEntries?.find(fe => fe.id === payment.paymentId);
                                                        return (
                                                            <TableRow key={payment.paymentId}>
                                                                <TableCell>{format(new Date((payment.date as any).seconds * 1000), 'PPP')}</TableCell>
                                                                <TableCell className="text-right">{payment.amount.toLocaleString()}</TableCell>
                                                                <TableCell className="text-right">
                                                                    {paymentEntry && (
                                                                        <>
                                                                            <Button variant="ghost" size="sm" onClick={() => handleEditEntryClick(paymentEntry)}>
                                                                                <PenSquare className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteEntryClick(paymentEntry)}>
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                    </TableBody>
                                                </Table>
                                                )}
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                            <DialogFooter className="mt-4">
                                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                <Button type="submit" form="payment-form" disabled={isUpdating}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Payment</Button>
                            </DialogFooter>
                        </TabsContent>
                        
                        <TabsContent value="penalty">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle>Add a New Penalty</CardTitle></CardHeader>
                                        <CardContent>
                                            <Form {...penaltyForm}>
                                                <form onSubmit={penaltyForm.handleSubmit(onPenaltySubmit)} className="space-y-4" id="penalty-form">
                                                    <FormField control={penaltyForm.control} name="penaltyAmount" render={({ field }) => (<FormItem><FormLabel>Penalty Amount (Ksh)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={penaltyForm.control} name="penaltyDate" render={({ field }) => (<FormItem><FormLabel>Penalty Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={penaltyForm.control} name="penaltyDescription" render={({ field }) => (<FormItem><FormLabel>Penalty Reason</FormLabel><FormControl><Textarea placeholder="e.g., Late payment fee for January" {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                                                </form>
                                            </Form>
                                        </CardContent>
                                    </Card>
                                </div>
                                <div>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Penalty History</CardTitle>
                                            <CardDescription>All penalties applied to this loan.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ScrollArea className="h-72">
                                                {(!loanToEdit.penalties || loanToEdit.penalties.length === 0) ? (
                                                <Alert>
                                                    <AlertTitle>No Penalties Yet</AlertTitle>
                                                    <AlertDescription>No penalties have been applied to this loan.</AlertDescription>
                                                </Alert>
                                                ) : (
                                                <Table>
                                                    <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>Description</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                    </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                    {loanToEdit.penalties.sort((a,b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()).map((penalty) => (
                                                        <TableRow key={penalty.penaltyId}>
                                                            <TableCell>{format(new Date((penalty.date as any).seconds * 1000), 'PPP')}</TableCell>
                                                            <TableCell>{penalty.description}</TableCell>
                                                            <TableCell className="text-right">{penalty.amount.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    </TableBody>
                                                </Table>
                                                )}
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                             <DialogFooter className="mt-4">
                                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                <Button type="submit" form="penalty-form" disabled={isAddingPenalty}>{isAddingPenalty && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Penalty</Button>
                            </DialogFooter>
                        </TabsContent>

                        <TabsContent value="edit">
                            <Form {...editLoanForm}>
                                <div className="mt-4 max-h-[60vh] overflow-y-auto pr-4">
                                    <form onSubmit={editLoanForm.handleSubmit(onLoanEditSubmit)} id="edit-loan-form" className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField control={editLoanForm.control} name="disbursementDate" render={({ field }) => (<FormItem><FormLabel>Disbursement Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={editLoanForm.control} name="principalAmount" render={({ field }) => (<FormItem><FormLabel>Principal Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={editLoanForm.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Monthly Interest Rate (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={editLoanForm.control} name="registrationFee" render={({ field }) => (<FormItem><FormLabel>Registration Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={editLoanForm.control} name="processingFee" render={({ field }) => (<FormItem><FormLabel>Processing Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={editLoanForm.control} name="carTrackInstallationFee" render={({ field }) => (<FormItem><FormLabel>Car Track Fee</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={editLoanForm.control} name="chargingCost" render={({ field }) => (<FormItem><FormLabel>Charging Cost</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={editLoanForm.control} name="numberOfInstalments" render={({ field }) => (<FormItem><FormLabel>No. of Instalments</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={editLoanForm.control} name="paymentFrequency" render={({ field }) => (<FormItem><FormLabel>Payment Frequency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                            <FormField control={editLoanForm.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="due">Due</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="rollover">Rollover</SelectItem><SelectItem value="application">Application</SelectItem></SelectContent></Select><FormMessage/></FormItem>)} />
                                        </div>
                                        <Card className="mt-4">
                                            <CardHeader><CardTitle className="text-lg">Recalculated Totals</CardTitle></CardHeader>
                                            <CardContent>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground">New Instalment Amount:</span>
                                                    <span className="font-bold text-lg">Ksh {recalculatedValues.instalmentAmount}</span>
                                                </div>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="text-muted-foreground">New Total Repayable (excl. penalties):</span>
                                                    <span className="font-bold text-lg">Ksh {recalculatedValues.totalRepayableAmount}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </form>
                                </div>
                                <DialogFooter className="mt-4">
                                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                    <Button type="submit" form="edit-loan-form" disabled={isEditingLoan}>{isEditingLoan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
                                </DialogFooter>
                            </Form>
                        </TabsContent>
                        <TabsContent value="rollover">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Rollover Loan</CardTitle>
                                    <CardDescription>
                                        This action will record an interest-only payment, mark this loan as 'Rolled Over', and create a new loan with the same principal amount.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Form {...rolloverForm}>
                                        <form onSubmit={rolloverForm.handleSubmit(onRolloverSubmit)} id="rollover-form" className="space-y-4">
                                            <div className="space-y-2 rounded-md bg-muted p-4">
                                                <div className="flex justify-between">
                                                    <span className="text-sm font-medium">Interest Payment Required</span>
                                                    <span className="text-sm font-bold">Ksh {interestForRollover.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">This is the calculated interest for one instalment period.</p>
                                            </div>
                                            <FormField
                                                control={rolloverForm.control}
                                                name="rolloverDate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Rollover Date</FormLabel>
                                                        <FormControl>
                                                            <Input type="date" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </form>
                                    </Form>
                                </CardContent>
                            </Card>
                            <DialogFooter className="mt-4">
                                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                <Button type="submit" form="rollover-form" disabled={isRollingOver || interestForRollover <= 0}>
                                    {isRollingOver && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirm Rollover
                                </Button>
                            </DialogFooter>
                        </TabsContent>
                        <TabsContent value="delete">
                            <Card className="border-destructive mt-4">
                                <CardHeader>
                                    <CardTitle className="text-destructive">Delete Loan #{loanToEdit.loanNumber}</CardTitle>
                                    <CardDescription>
                                        Permanently delete this loan from the system. This action cannot be undone.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Alert variant="destructive">
                                        <AlertTitle>Warning</AlertTitle>
                                        <AlertDescription>
                                        Deleting this loan will remove it from the loan book. However, any associated financial entries (receipts or payouts) in the finance section will NOT be deleted. You may need to manually delete them if required.
                                        </AlertDescription>
                                    </Alert>
                                </CardContent>
                            </Card>
                            <DialogFooter className="mt-4">
                                <DialogClose asChild>
                                    <Button variant="ghost">Cancel</Button>
                                </DialogClose>
                                <Button variant="destructive" onClick={() => setDeleteLoanOpen(true)}>
                                     <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Loan
                                </Button>
                            </DialogFooter>
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
