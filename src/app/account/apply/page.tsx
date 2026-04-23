'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ChevronLeft, Loader2, CheckCircle2, Share2, FileText, ShieldCheck, AlertCircle, Info, Phone, Wallet, Banknote, TrendingUp, Car, MessageSquare, Send, ClipboardList } from 'lucide-react';
import { collection, query, where, updateDoc, doc } from 'firebase/firestore';

import { useUser, useFirestore, useStorage, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { submitCustomerApplication, uploadKYCDocument } from '@/lib/firestore';
import { analyzeStatementAction } from '@/app/actions/analyze-statement';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const DAYS_OF_WEEK = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const LOAN_PRODUCTS = [
  {
    id: "Quick Pesa (1 Month)",
    title: "Quick Pesa",
    icon: Wallet,
    description: "Fast, unsecured micro-loans designed for immediate, short-term financial needs. Ideal for fast emergency cash.",
    features: [
      "Instant approval process.",
      "1-month flexible repayment term.",
      "Direct disbursement to your mobile wallet."
    ],
    requirements: [
        "National ID",
        "12 months of M-Pesa statement"
    ],
    terms: [
        "Late or missed repayments may attract penalties.",
        "By applying, you consent to share your data for assessment."
    ]
  },
  {
    id: "Salary Advance",
    title: "Salary Advance",
    icon: Banknote,
    description: "Need funds before payday? Our Salary Advance product gives working professionals quick access to cash, with minimal hassle and no long waits.",
    features: [
      "Real-time eligibility check - our AI assessment engine determines your fit almost instantly.",
      "Instant disbursement - once approved, funds hit your mobile wallet or bank account right away.",
      "Salary-linked loan - repayment is structured around your next salary cycle for smoother service."
    ],
    requirements: [
        "A copy/photo of your National ID (or Passport)",
        "12 months of M-Pesa statement (or equivalent mobile money statement)",
        "3 recent payslips (showing your salary)",
        "Up-to-date employment information"
    ],
    terms: [
        "Loan amounts and tenure depend on your salary level and employment status (as assessed by our AI).",
        "Late or missed repayments may impact your credit eligibility and may incur additional fees.",
        "By applying, you consent to share your employment and financial data for assessment, verification, and risk profiling."
    ]
  },
  {
    id: "Individual & Business Loan",
    title: "Business Loan",
    icon: TrendingUp,
    description: "Unlock the growth potential of your business with our flexible SME financing solution. Whether you're managing inventory, expanding operations, or stabilising cash-flow, our SME Loans are tailored to support your vision.",
    features: [
      "Access working capital or growth funding without excessive delays - designed for small and medium enterprises (SMEs) needing flexible financial support.",
      "Competitive interest rates with transparent terms based on Kenyan SME market standards."
    ],
    requirements: [
        "Copy of your National ID and valid KRA PIN.",
        "Business registration certificate or trade licence (for registered entities).",
        "12 months of business bank statements or M-Pesa statements showing transaction history and cash-flow.",
        "A brief overview of your business - industry, trading period, monthly revenue, and growth plan.",
        "Additional documents such as business permit, proof of premises, or collateral details may be required."
    ],
    terms: [
        "Loan amount and repayment tenure depend on your business size, cash-flow, and risk profile - higher limits may require collateral.",
        "Late or missed repayments may attract penalties or negatively impact your business credit standing.",
        "A formal loan agreement will outline repayment schedules, security requirements, and any covenants tied to business performance.",
        "By applying, you consent to share your business documents and financial data for assessment."
    ]
  },
  {
     id: "Logbook Loan",
     title: "Logbook Loan",
     icon: Car,
     description: "Unlock cash using your vehicle logbook as collateral, without having to surrender your car.",
     features: [
        "Receive up to 60% of your vehicle's value.",
        "Flexible repayment up to 4 months.",
        "Keep driving your car while you repay."
     ],
     requirements: [
         "Original Logbook",
         "National ID and KRA PIN",
         "12 months of M-Pesa statement (or equivalent mobile money statement)",
         "Comprehensive Insurance (optional)",
         "Vehicle Valuation Report"
     ],
     terms: [
        "The vehicle acts as security for the loan.",
        "Comprehensive insurance is recommended but not mandatory to qualify.",
        "Defaulting on the loan may result in the repossession of the vehicle."
     ]
  }
];

const applySchema = z.object({
  loanType: z.string().min(1, 'Please select a loan product.'),
  principalAmount: z.coerce.number().min(500, 'Minimum amount is Ksh 500.'),
  idNumber: z.string().min(5, 'National ID is required.'),
  numberOfInstalments: z.coerce.number().int().min(1, 'At least 1 instalment is required.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  preferredPaymentDay: z.string().optional(),
  customerPhone: z.string()
    .min(10, 'Phone number must be at least 10 digits.')
    .max(13, 'Phone number is too long.')
    .regex(/^(?:(?:\+254|254)[17]\d{8}|0[17]\d{8})$/, 'Enter a valid Kenyan phone number (e.g. 0712345678 or +254712345678).'),
  alternativeNumber: z.string().optional(),
  
  // Statement & Financial Info
  statementType: z.enum(['mpesa', 'bank']),
  mpesaPassword: z.string().optional(),
  physicalAddress: z.string().min(1, 'Physical Address is required.'),
  employmentType: z.string().min(1, 'Employment Type is required.'),
  monthlyIncomeRange: z.string().min(1, 'Income Range is required.'),
  otherIncomeSources: z.string().optional(),

  // Employer Info (conditionally required for Salary Advance)
  employerName: z.string().optional(),
  jobPosition: z.string().optional(),
  workLocation: z.string().optional(),
  hrContact: z.string().optional(),
  hrEmail: z.string().optional(),

  // Vehicle Details (conditionally required for Logbook Loans)
  vehicleRegistration: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.string().optional(),
  vehicleOwnership: z.string().optional(),
  vehicleOwner: z.string().optional(),

  agreedToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and data protection policy.',
  }),
}).superRefine((data, ctx) => {
  if (data.loanType === 'Logbook Loan') {
    if (!data.vehicleRegistration) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['vehicleRegistration'] });
    if (!data.vehicleMake) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['vehicleMake'] });
    if (!data.vehicleModel) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['vehicleModel'] });
    if (!data.vehicleYear) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['vehicleYear'] });
    if (!data.vehicleOwnership) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['vehicleOwnership'] });
    if (!data.vehicleOwner) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['vehicleOwner'] });
  }

  if (data.loanType === 'Salary Advance') {
    if (!data.employerName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['employerName'] });
    if (!data.jobPosition) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['jobPosition'] });
    if (!data.workLocation) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['workLocation'] });
    if (!data.hrContact) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['hrContact'] });
    if (!data.hrEmail) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['hrEmail'] });
  }

  if (data.statementType === 'mpesa' && !data.mpesaPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'M-Pesa Statement Password is required.', path: ['mpesaPassword'] });
  }
});

export default function ApplyPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedType, setSubmittedType] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [step, setStep] = useState<'products' | 'details' | 'form'>('products');
  const [selectedProduct, setSelectedProduct] = useState<typeof LOAN_PRODUCTS[0] | null>(null);

  // File upload states
  const [idFrontFile, setIdFrontFile] = useState<string | null>(null);
  const [idBackFile, setIdBackFile] = useState<string | null>(null);
  const [mpesaFile, setMpesaFile] = useState<string | null>(null);

  const { data: profile } = useDoc<any>(user ? `customers/${user.uid}` : null);

  const userLoansQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [user, firestore]);

  const { data: customerLoans, isLoading: loansLoading } = useCollection<any>(userLoansQuery);

  const hasPendingApplication = useMemo(() => {
      return customerLoans?.some(l => ['application', 'awaiting_documents', 'under_review'].includes(l.status));
  }, [customerLoans]);

  const form = useForm<z.infer<typeof applySchema>>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      loanType: 'Quick Pesa (1 Month)',
      principalAmount: 0,
      idNumber: '',
      numberOfInstalments: 1,
      paymentFrequency: 'monthly',
      preferredPaymentDay: '',
      customerPhone: '',
      alternativeNumber: '',
      statementType: 'mpesa',
      physicalAddress: '',
      employmentType: '',
      monthlyIncomeRange: '',
      otherIncomeSources: '',
      vehicleRegistration: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleYear: '',
      vehicleOwnership: '',
      vehicleOwner: '',
      agreedToTerms: false,
      mpesaPassword: '',
      employerName: '',
      jobPosition: '',
      workLocation: '',
      hrContact: '',
      hrEmail: '',
    },
  });

  const frequencyWatch = form.watch('paymentFrequency');
  const loanTypeWatch = form.watch('loanType');

  useEffect(() => {
    if (profile) {
        if (profile.phone && !form.getValues('customerPhone')) {
            form.setValue('customerPhone', profile.phone);
        }
        if (profile.idNumber && !form.getValues('idNumber')) {
            form.setValue('idNumber', profile.idNumber);
        }
    }
  }, [profile, form]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setter(null);
    }
  };

  async function onSubmit(values: z.infer<typeof applySchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const customerName = profile?.name || user.displayName || 'Customer';
      const applicationData = {
        ...values,
        customerName: customerName,
        accountNumber: profile?.accountNumber || 'N/A',
      };
      
      // Upload documents if they exist
      if (idFrontFile) {
        await uploadKYCDocument(firestore, storage, {
            customerId: user.uid,
            customerName: customerName,
            type: 'id_front',
            fileName: 'ID Front',
            fileUrl: idFrontFile,
            uploadedBy: customerName
        });
      }
      
      if (idBackFile) {
        await uploadKYCDocument(firestore, storage, {
            customerId: user.uid,
            customerName: customerName,
            type: 'id_back',
            fileName: 'ID Back',
            fileUrl: idBackFile,
            uploadedBy: customerName
        });
      }

      if (mpesaFile) {
        await uploadKYCDocument(firestore, storage, {
            customerId: user.uid,
            customerName: customerName,
            type: 'mpesa_statement',
            fileName: 'M-Pesa Statement',
            fileUrl: mpesaFile,
            uploadedBy: customerName,
            documentPassword: values.mpesaPassword || undefined,
        } as any);
      }

      const loanDocRef = await submitCustomerApplication(firestore, user.uid, applicationData);
      
      // TRIGGER AI ANALYSIS AUTOMATICALLY IN BACKGROUND
      if (mpesaFile) {
        // Fire-and-forget: does NOT block the UI
        analyzeStatementAction(mpesaFile, values.mpesaPassword || undefined, values.principalAmount)
          .then(async (result) => {
            if (result.success && result.data) {
              // Write the AI report directly onto the loan document
              await updateDoc(doc(firestore, 'loans', loanDocRef.id), {
                aiAnalysis: result.data
              });
              console.log('[AI Analysis] Complete — risk:', result.data.riskLevel);
            } else {
              console.error('[AI Analysis] Failed:', result.error);
            }
          })
          .catch(err => console.error('[AI Analysis] Exception:', err));
      }

      setSubmittedType(values.loanType);
      setSubmittedPhone(values.customerPhone);
      setIsSuccess(true);
      toast({ title: 'Application Submitted', description: 'Your documents and application have been submitted successfully.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  interface RequirementItem {
    emoji: string;
    label: string;
    detail: string;
  }

  const getRequirements = (type: string): RequirementItem[] => {
    const base: RequirementItem[] = [
      { emoji: '🪪', label: 'National ID Card', detail: 'Front & back clear photos or scanned copy' },
      { emoji: '📱', label: 'M-Pesa Statement', detail: 'Last 3 months — PDF from M-Pesa app or Safaricom' },
    ];

    if (type.includes('Salary')) {
      return [
        ...base,
        { emoji: '💰', label: '3 Months Payslips', detail: 'Most recent 3 payslips showing your salary & employer' },
        { emoji: '🏢', label: 'Employment Details', detail: 'Employer name, department, and staff number' },
        { emoji: '🏦', label: 'Bank Statement (Optional)', detail: 'Last 3 months bank statement if salary is banked' },
      ];
    }

    if (type.includes('Business')) {
      return [
        ...base,
        { emoji: '📋', label: 'Business Permit', detail: 'Valid county business permit or trade licence' },
        { emoji: '🏪', label: 'Business Registration', detail: 'Certificate of incorporation or business name cert.' },
        { emoji: '📍', label: 'Business Location Info', detail: 'Physical address, maps pin, or description of premises' },
        { emoji: '💼', label: 'Business Bank/M-Pesa Statements', detail: 'Last 6 months showing business cash-flow' },
      ];
    }

    if (type.includes('Logbook')) {
      return [
        ...base,
        { emoji: '📖', label: 'Original Vehicle Logbook', detail: 'Must be in your name — clear photo of all pages' },
        { emoji: '📷', label: 'Vehicle Photos', detail: 'Front, back, sides, and dashboard with mileage visible' },
        { emoji: '🛡️', label: 'Comprehensive Insurance', detail: 'Optional — recommended but not mandatory for approval' },
        { emoji: '🔍', label: 'Vehicle Valuation Report', detail: 'From a certified auto valuer (we can assist)' },
        { emoji: '🪪', label: 'KRA PIN Certificate', detail: 'Valid KRA PIN certificate' },
      ];
    }

    // Quick Pesa default
    return [
      ...base,
      { emoji: '🪪', label: 'KRA PIN Certificate', detail: 'Valid KRA PIN for verification' },
    ];
  };

  const buildWhatsAppChecklist = (type: string, customerName: string, accountNumber: string): string => {
    const reqs = getRequirements(type);
    const checklist = reqs.map(r => `  ${r.emoji} *${r.label}*\n     _${r.detail}_`).join('\n\n');
    return [
      `✅ *Pezeka Credit — Loan Application Received*`,
      ``,
      `Hello *${customerName}*! We received your *${type}* application.`,
      `Member No: *${accountNumber}*`,
      ``,
      `📋 *REQUIRED DOCUMENTS CHECKLIST*`,
      `Please prepare and submit the following:`,
      ``,
      checklist,
      ``,
      `📌 *How to submit:*`,
      `Send clear photos/PDFs of each document via WhatsApp to this number or to your assigned credit officer.`,
      ``,
      `⏰ Processing begins once all documents are received.`,
      ``,
      `🔒 *Your data is protected.*`,
      `All information shared is handled strictly in accordance with the Kenya Data Protection Act, 2019. Your documents are used solely for loan assessment and will not be shared with third parties without your consent.`,
      ``,
      `Thank you for choosing Pezeka Credit! 🙏`,
    ].join('\n');
  };

  const handleNotifyTeam = () => {
    const teamNumber = '254757664047';
    const customerName = profile?.name || 'Customer';
    const accountNumber = profile?.accountNumber || 'N/A';
    const message = buildWhatsAppChecklist(submittedType, customerName, accountNumber);
    window.open(`https://wa.me/${teamNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSendToSelf = () => {
    const rawPhone = submittedPhone || profile?.phone || '';
    // Normalise to international format
    let phone = rawPhone.replace(/\s+/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (phone.startsWith('+')) phone = phone.slice(1);
    const customerName = profile?.name || 'Customer';
    const accountNumber = profile?.accountNumber || 'N/A';
    const message = buildWhatsAppChecklist(submittedType, customerName, accountNumber);
    if (phone.length >= 12) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      // Fallback: just open WhatsApp without a number (user picks contact)
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  // Legacy alias kept for any remaining references
  const handleWhatsAppSubmission = handleNotifyTeam;

  if (loansLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB]"><Loader2 className="animate-spin text-primary" /></div>;

  if (hasPendingApplication) {
      return (
          <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-full max-w-md space-y-8">
                  <div className="w-24 h-24 bg-amber-100 rounded-[2rem] flex items-center justify-center mx-auto shadow-sm"><AlertCircle className="h-12 w-12 text-amber-600" /></div>
                  <h1 className="text-3xl font-black text-[#1B2B33]">Application Pending</h1>
                  <p className="text-muted-foreground font-medium px-4">You already have an active loan application under review. Please wait for our team to process it.</p>
                  <Button onClick={() => router.push('/account')} className="w-full h-16 rounded-full bg-[#1B2B33] text-white text-lg font-black shadow-lg">Go to Dashboard</Button>
              </div>
          </div>
      );
  }

  if (isSuccess) {
    const requirements = getRequirements(submittedType);
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-6 pb-12">
        <div className="w-full max-w-lg space-y-6">

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-black text-[#1B2B33]">Application Received! 🎉</h1>
            <p className="text-muted-foreground font-medium px-4 text-sm leading-relaxed">
              Your <strong>{submittedType}</strong> application requires additional documents.
              Please check the checklist below and submit them via WhatsApp. Once received, your application will go under review.
            </p>
          </div>

          {/* WhatsApp notification banner */}
          <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-[#1B2B33]">Send your document checklist via WhatsApp</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Notify the Pezeka team or save the checklist to your own WhatsApp for easy reference.
              </p>
            </div>
          </div>

          {/* Document Checklist Card */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#0078D4]/10 flex items-center justify-center">
                  <ClipboardList className="h-4 w-4 text-[#0078D4]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#1B2B33]">Required Documents</h3>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Please prepare all items below</p>
                </div>
              </div>

              <div className="space-y-3">
                {requirements.map((req, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-gradient-to-r from-[#F8FAFB] to-white border border-muted/40 p-4 rounded-2xl"
                  >
                    <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{req.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-[#1B2B33] leading-tight">{req.label}</p>
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5 leading-snug">{req.detail}</p>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-[#0078D4]/40 flex-shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium leading-snug">
                  Processing begins once all documents are received. Send clear photos or PDFs via WhatsApp.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleSendToSelf}
              className="w-full h-14 rounded-full bg-[#25D366] hover:bg-[#1EBE5A] text-white font-black text-base shadow-lg shadow-[#25D366]/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Send className="h-5 w-5" />
              Send Checklist to My WhatsApp
            </Button>

            <Button
              onClick={handleNotifyTeam}
              variant="outline"
              className="w-full h-14 rounded-full border-[#25D366]/40 text-[#25D366] font-black text-base hover:bg-[#25D366]/5 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <MessageSquare className="h-5 w-5" />
              Notify Pezeka Team
            </Button>

            <Button
              onClick={() => router.push('/account')}
              variant="ghost"
              className="w-full h-12 rounded-full text-[#1B2B33]/60 font-black text-sm"
            >
              Go to Dashboard
            </Button>
          </div>

          {/* Data Protection Notice */}
          <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
            <ShieldCheck className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 font-medium leading-snug">
              <span className="font-black text-slate-600">Your data is protected.</span>{' '}
              All information you share is handled in strict compliance with the{' '}
              <span className="font-black">Kenya Data Protection Act, 2019</span>. Your documents are used solely for loan assessment and will never be shared with third parties without your consent.
            </p>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col">
      <div className="bg-[#1B2B33] text-white px-6 pt-12 pb-14 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-[0.03] rounded-full blur-3xl"></div>
              <div className="absolute top-12 -left-12 w-48 h-48 bg-[#0078D4] opacity-[0.05] rounded-full blur-3xl"></div>
          </div>

          <Button variant="ghost" size="sm" onClick={() => {
              if (step === 'form') setStep('details');
              else if (step === 'details') setStep('products');
              else router.back();
          }} className="text-white/60 hover:text-white hover:bg-white/10 -ml-2 mb-4 relative z-10">
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          
          <h1 className="text-3xl font-black tracking-tight text-white relative z-10">
              {step === 'products' && "Apply for a New Loan"}
              {step === 'details' && selectedProduct?.title}
              {step === 'form' && "Complete Application"}
          </h1>
          <p className="text-white/60 text-sm mt-1 relative z-10">
              {step === 'products' && "Get instant capital for your personal or business needs."}
              {step === 'details' && "Review product details and requirements."}
              {step === 'form' && "Please fill in all requested details accurately."}
          </p>
      </div>

      <div className="px-6 -mt-8 flex-1 overflow-hidden flex flex-col pb-6 relative z-10">
          <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden flex-1 flex flex-col bg-white">
              <CardContent className="p-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-full w-full">
                      
                      {step === 'products' && (
                          <div className="p-6 space-y-4">
                              <h2 className="text-lg font-black text-[#1B2B33] mb-4 mt-2">Our Loan Products</h2>
                              {LOAN_PRODUCTS.map((product) => {
                                  const Icon = product.icon;
                                  return (
                                  <div 
                                      key={product.id} 
                                      onClick={() => {
                                          setSelectedProduct(product);
                                          setStep('details');
                                      }}
                                      className="group bg-[#F8FAFB] hover:bg-[#0078D4]/5 border border-muted/30 p-5 rounded-[2rem] flex items-center justify-between cursor-pointer transition-all active:scale-95"
                                  >
                                      <div className="flex items-center gap-4">
                                          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                              <Icon className="h-6 w-6 text-[#0078D4]" />
                                          </div>
                                          <div>
                                              <h3 className="font-black text-[#1B2B33] text-base">{product.title}</h3>
                                              <p className="text-xs text-muted-foreground font-medium mt-0.5 line-clamp-2">{product.description}</p>
                                          </div>
                                      </div>
                                      <div className="w-8 h-8 rounded-full bg-[#1B2B33]/5 flex items-center justify-center flex-shrink-0 ml-2">
                                          <ChevronLeft className="h-4 w-4 text-[#1B2B33] rotate-180" />
                                      </div>
                                  </div>
                              )})}
                          </div>
                      )}

                      {step === 'details' && selectedProduct && (
                          <div className="p-8 pb-32 space-y-8 relative">
                              <div className="space-y-3">
                                  <h3 className="text-sm font-black uppercase text-[#1B2B33]">{selectedProduct.title} Details</h3>
                                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                                      {selectedProduct.description}
                                  </p>
                              </div>

                              <div className="space-y-4">
                                  <h3 className="text-xs font-black uppercase tracking-widest text-[#0078D4]">Key Features</h3>
                                  <ul className="space-y-3">
                                      {selectedProduct.features.map((feature, i) => (
                                          <li key={i} className="flex gap-3 text-sm font-medium text-muted-foreground">
                                              <CheckCircle2 className="h-5 w-5 text-[#0078D4] flex-shrink-0" />
                                              <span className="leading-tight">{feature}</span>
                                          </li>
                                      ))}
                                  </ul>
                              </div>

                              <div className="space-y-4">
                                  <h3 className="text-xs font-black uppercase tracking-widest text-[#1B2B33]">Requirements</h3>
                                  <div className="bg-[#1B2B33]/5 p-5 rounded-2xl space-y-3">
                                      {selectedProduct.requirements.map((req, i) => (
                                          <div key={i} className="flex items-start gap-3">
                                              <div className="w-1.5 h-1.5 rounded-full bg-[#1B2B33] mt-1.5 flex-shrink-0"></div>
                                              <span className="text-sm font-bold text-[#1B2B33] leading-tight">{req}</span>
                                          </div>
                                      ))}
                                  </div>
                              </div>

                              <div className="space-y-4 mb-8">
                                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Terms & Conditions</h3>
                                  <ul className="space-y-3">
                                      {selectedProduct.terms.map((term, i) => (
                                          <li key={i} className="flex gap-3 text-xs font-medium text-muted-foreground">
                                              <Info className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                                              <span>{term}</span>
                                          </li>
                                      ))}
                                  </ul>
                              </div>

                              <div className="fixed bottom-0 mt-8 left-0 right-0 p-6 bg-gradient-to-t from-[#F8FAFB] via-[#F8FAFB] to-transparent pt-12 pb-8 z-20">
                                  <Button 
                                      onClick={() => {
                                          form.setValue('loanType', selectedProduct.id);
                                          setStep('form');
                                      }} 
                                      className="w-full h-16 rounded-full bg-[#0078D4] hover:bg-[#0078D4]/90 text-white text-lg font-black shadow-xl shadow-[#0078D4]/20 transition-all active:scale-95"
                                  >
                                      Submit Additional Information
                                  </Button>
                              </div>
                          </div>
                      )}

                      {step === 'form' && (
                      <div className="p-8 pb-12">
                          <Form {...form}>
                              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                  {/* Hidden input for loanType as it's already selected */}
                                  <input type="hidden" {...form.register('loanType')} />

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <FormField control={form.control} name="principalAmount" render={({ field }) => (
                                          <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Requested Amount (KSH)</FormLabel><FormControl><Input type="number" placeholder="0" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                      )}/>
                                      <FormField control={form.control} name="idNumber" render={({ field }) => (
                                          <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">National ID Number</FormLabel><FormControl><Input placeholder="ID Card Number" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                      )}/>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <FormField control={form.control} name="numberOfInstalments" render={({ field }) => (
                                          <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Instalments</FormLabel><FormControl><Input type="number" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                      )}/>
                                      <FormField control={form.control} name="paymentFrequency" render={({ field }) => (
                                          <FormItem>
                                              <FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Frequency</FormLabel>
                                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                  <FormControl><SelectTrigger className="h-14 rounded-xl bg-white"><SelectValue placeholder="Frequency" /></SelectTrigger></FormControl>
                                                  <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                                              </Select>
                                              <FormMessage />
                                          </FormItem>
                                      )}/>
                                  </div>

                                  {frequencyWatch === 'weekly' && (
                                      <FormField control={form.control} name="preferredPaymentDay" render={({ field }) => (
                                          <FormItem>
                                              <FormLabel className="text-[10px] font-black uppercase text-[#0078D4]">Preferred Weekly Payment Day</FormLabel>
                                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                  <FormControl><SelectTrigger className="h-14 rounded-xl border-[#0078D4]/40 bg-[#0078D4]/5"><SelectValue placeholder="Select day" /></SelectTrigger></FormControl>
                                                  <SelectContent>{DAYS_OF_WEEK.map(day => (<SelectItem key={day} value={day}>{day}</SelectItem>))}</SelectContent>
                                              </Select>
                                          </FormItem>
                                      )}/>
                                  )}

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <FormField control={form.control} name="customerPhone" render={({ field }) => (
                                          <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Phone Number</FormLabel><FormControl><Input placeholder="0712 345 678" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                      )}/>
                                      <FormField control={form.control} name="alternativeNumber" render={({ field }) => (
                                          <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Alternative Phone (Optional)</FormLabel><FormControl><Input placeholder="Second contact" className="h-14 rounded-xl" {...field} /></FormControl></FormItem>
                                      )}/>
                                      </div>

                                  <div className="space-y-6 pt-4 border-t border-muted/30">
                                      <h3 className="text-sm font-black uppercase text-[#1B2B33]">Statement & Financial Info</h3>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <FormField control={form.control} name="statementType" render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Statement Type *</FormLabel>
                                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                      <FormControl><SelectTrigger className="h-14 rounded-xl bg-white"><SelectValue placeholder="Which statement will you provide?" /></SelectTrigger></FormControl>
                                                      <SelectContent><SelectItem value="mpesa">M-Pesa</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                                                  </Select>
                                                  <FormMessage />
                                              </FormItem>
                                          )}/>
                                          <FormField control={form.control} name="physicalAddress" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Physical Address (Residence) *</FormLabel><FormControl><Input placeholder="Your physical address" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                      </div>

                                      {form.watch('statementType') === 'mpesa' && (
                                        <div className="grid grid-cols-1 gap-6">
                                            <FormField control={form.control} name="mpesaPassword" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">M-Pesa Statement Password *</FormLabel><FormControl><Input placeholder="Statement PDF Password (e.g., ID or Phone)" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                            )}/>
                                        </div>
                                      )}

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <FormField control={form.control} name="employmentType" render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Employment / Business Type *</FormLabel>
                                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                      <FormControl><SelectTrigger className="h-14 rounded-xl bg-white"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                                      <SelectContent><SelectItem value="Employed">Employed</SelectItem><SelectItem value="Self-Employed">Self-Employed</SelectItem><SelectItem value="Business Owner">Business Owner</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                                                  </Select>
                                                  <FormMessage />
                                              </FormItem>
                                          )}/>
                                          <FormField control={form.control} name="monthlyIncomeRange" render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Monthly Income Range *</FormLabel>
                                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                      <FormControl><SelectTrigger className="h-14 rounded-xl bg-white"><SelectValue placeholder="Select range" /></SelectTrigger></FormControl>
                                                      <SelectContent>
                                                        <SelectItem value="Below 50,000">Below Ksh 50,000</SelectItem>
                                                        <SelectItem value="50,000 - 100,000">Ksh 50,000 - 100,000</SelectItem>
                                                        <SelectItem value="100,001 - 250,000">Ksh 100,001 - 250,000</SelectItem>
                                                        <SelectItem value="Over 250,000">Over Ksh 250,000</SelectItem>
                                                      </SelectContent>
                                                  </Select>
                                                  <FormMessage />
                                              </FormItem>
                                          )}/>
                                      </div>
                                      
                                      <FormField control={form.control} name="otherIncomeSources" render={({ field }) => (
                                          <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Other Income Sources (Optional)</FormLabel><FormControl><Input placeholder="e.g. Rental income, Farming" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                      )}/>
                                  </div>

                                  {loanTypeWatch === 'Salary Advance' && (
                                    <div className="space-y-6 pt-4 border-t border-muted/30">
                                      <h3 className="text-sm font-black uppercase text-[#1B2B33]">Employer Information</h3>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <FormField control={form.control} name="employerName" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Employer Name *</FormLabel><FormControl><Input placeholder="e.g. Safaricom PLC" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                          <FormField control={form.control} name="jobPosition" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Job Position *</FormLabel><FormControl><Input placeholder="e.g. Accountant" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <FormField control={form.control} name="workLocation" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Work Location *</FormLabel><FormControl><Input placeholder="e.g. Westlands, Nairobi" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                          <FormField control={form.control} name="hrContact" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">HR Contact Number *</FormLabel><FormControl><Input placeholder="0700 000 000" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <FormField control={form.control} name="hrEmail" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">HR Official Email *</FormLabel><FormControl><Input placeholder="hr@company.com" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                      </div>
                                    </div>
                                  )}

                                  {loanTypeWatch === 'Logbook Loan' && (
                                    <div className="space-y-6 pt-4 border-t border-muted/30">
                                      <h3 className="text-sm font-black uppercase text-[#1B2B33]">Vehicle Details</h3>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <FormField control={form.control} name="vehicleRegistration" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Vehicle Registration Number *</FormLabel><FormControl><Input placeholder="e.g. KDG 123A" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                          <FormField control={form.control} name="vehicleMake" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Make / Brand *</FormLabel><FormControl><Input placeholder="e.g. Toyota" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <FormField control={form.control} name="vehicleModel" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Model *</FormLabel><FormControl><Input placeholder="e.g. Vitz" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                          <FormField control={form.control} name="vehicleYear" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Year of Manufacture *</FormLabel><FormControl><Input placeholder="e.g. 2015" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <FormField control={form.control} name="vehicleOwnership" render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Ownership Type *</FormLabel>
                                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                      <FormControl><SelectTrigger className="h-14 rounded-xl bg-white"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                                      <SelectContent><SelectItem value="Individual">Individual</SelectItem><SelectItem value="Company">Company</SelectItem><SelectItem value="Joint">Joint</SelectItem></SelectContent>
                                                  </Select>
                                                  <FormMessage />
                                              </FormItem>
                                          )}/>
                                          <FormField control={form.control} name="vehicleOwner" render={({ field }) => (
                                              <FormItem><FormLabel className="text-[10px] font-black uppercase text-[#1B2B33]/40">Registered Owner (as per logbook) *</FormLabel><FormControl><Input placeholder="e.g. Simon Maina" className="h-14 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                                          )}/>
                                      </div>
                                    </div>
                                  )}

                                  <div className="space-y-6 pt-4 border-t border-muted/30">
                                      <h3 className="text-sm font-black uppercase text-[#1B2B33]">Document Uploads</h3>
                                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-2 mb-4">
                                        <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                          Please upload clear images or PDF documents. Maximum file size is 5MB per document. These will securely sync directly with your KYC profile.
                                        </p>
                                      </div>
                                      
                                      <div className="space-y-4">
                                          <div>
                                              <label className="text-[10px] font-black uppercase text-[#1B2B33]/40 block mb-2">ID Card (Front) *</label>
                                              <Input type="file" accept="image/*,.pdf" required onChange={(e) => handleFileUpload(e, setIdFrontFile)} className="h-12 pt-2.5 rounded-xl cursor-pointer" />
                                          </div>
                                          <div>
                                              <label className="text-[10px] font-black uppercase text-[#1B2B33]/40 block mb-2">ID Card (Back) *</label>
                                              <Input type="file" accept="image/*,.pdf" required onChange={(e) => handleFileUpload(e, setIdBackFile)} className="h-12 pt-2.5 rounded-xl cursor-pointer" />
                                          </div>
                                          {form.watch('statementType') === 'mpesa' && (
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-[#1B2B33]/40 block mb-2">M-Pesa Statement (PDF) *</label>
                                                <Input type="file" accept=".pdf" required onChange={(e) => handleFileUpload(e, setMpesaFile)} className="h-12 pt-2.5 rounded-xl cursor-pointer" />
                                            </div>
                                          )}
                                      </div>
                                  </div>

                                  <FormField control={form.control} name="agreedToTerms" render={({ field }) => (
                                      <FormItem className="flex flex-row items-start space-x-3 rounded-2xl border border-[#0078D4]/10 bg-[#0078D4]/5 p-6">
                                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-1" /></FormControl>
                                          <div className="space-y-2 leading-none">
                                              <FormLabel className="text-sm font-bold text-[#1B2B33]">I agree to the terms and conditions and I am aware of the Data Protection Act.</FormLabel>
                                              <p className="text-[10px] text-muted-foreground font-medium leading-snug">
                                                By submitting this form, you authorize our team to verify your information in compliance with Kenyan law.
                                              </p>
                                              <div className="flex items-start gap-1.5 pt-1">
                                                <ShieldCheck className="h-3.5 w-3.5 text-[#0078D4] flex-shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-[#0078D4] font-bold leading-snug">
                                                  Your data is protected under the Kenya Data Protection Act, 2019. It will only be used for loan assessment.
                                                </p>
                                              </div>
                                              <FormMessage />
                                          </div>
                                      </FormItem>
                                  )}/>

                                  <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-full bg-[#0078D4] text-white text-lg font-black shadow-lg shadow-[#0078D4]/20 transition-all active:scale-95">
                                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Submit Loan Application'}
                                  </Button>
                              </form>
                          </Form>
                      </div>
                      )}

                  </ScrollArea>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}