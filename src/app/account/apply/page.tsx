
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ChevronLeft, Loader2, CheckCircle2, Share2, FileText, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';

import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { submitCustomerApplication } from '@/lib/firestore';
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

const applySchema = z.object({
  loanType: z.string().min(1, 'Please select a loan product.'),
  principalAmount: z.coerce.number().min(500, 'Minimum amount is Ksh 500.'),
  idNumber: z.string().min(5, 'National ID is required.'),
  numberOfInstalments: z.coerce.number().int().min(1, 'At least 1 instalment is required.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  preferredPaymentDay: z.string().optional(),
  customerPhone: z.string().min(10, 'Valid phone number is required.'),
  alternativeNumber: z.string().optional(),
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and data protection policy.',
  }),
});

export default function ApplyPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedType, setSubmittedType] = useState('');

  const { data: profile } = useDoc<any>(user ? `customers/${user.uid}` : null);

  const userLoansQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      return query(collection(firestore, 'loans'), where('customerId', '==', user.uid));
  }, [user, firestore]);

  const { data: customerLoans, isLoading: loansLoading } = useCollection<any>(userLoansQuery);

  const hasPendingApplication = useMemo(() => {
      return customerLoans?.some(l => l.status === 'application');
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
      agreedToTerms: false,
    },
  });

  const frequencyWatch = form.watch('paymentFrequency');

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

  async function onSubmit(values: z.infer<typeof applySchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const applicationData = {
        ...values,
        customerName: profile?.name || user.displayName || 'Customer',
        accountNumber: profile?.accountNumber || 'N/A',
      };
      
      await submitCustomerApplication(firestore, user.uid, applicationData);
      setSubmittedType(values.loanType);
      setIsSuccess(true);
      toast({ title: 'Application Submitted', description: 'We have received your loan request.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  const getRequirements = (type: string) => {
      const items = [
          "Original ID Card (Front & Back) - Mandatory",
          "M-Pesa Statement (6 Months PDF) - Mandatory",
          "M-Pesa Statement Password - Mandatory"
      ];

      if (type.includes('Salary')) {
          items.push("Latest 3 Months Payslips");
      } else if (type.includes('Business')) {
          items.push("Business Permit / License");
          items.push("Business Physical Location Description");
      } else if (type.includes('Logbook')) {
          items.push("Copy of Vehicle Logbook");
      }

      return items;
  };

  const handleWhatsAppSubmission = () => {
      const phoneNumber = "254757664047";
      const requirements = getRequirements(submittedType);
      const reqList = requirements.map(r => `• ${r}`).join('\n');
      const message = `Hello Pezeka Credit Team,\n\nI have just submitted my application for a *${submittedType}* via the portal.\n\nHere are my supporting documents:\n${reqList}\n\nMy Name: ${profile?.name || user?.displayName || 'Member'}\nMember No: ${profile?.accountNumber || 'N/A'}`;
      
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
  };

  if (loansLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }

  if (hasPendingApplication) {
      return (
          <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
              <div className="w-full max-w-md space-y-8">
                  <div className="space-y-4">
                      <div className="w-24 h-24 bg-amber-100 rounded-[2rem] flex items-center justify-center mx-auto shadow-sm">
                          <AlertCircle className="h-12 w-12 text-amber-600" />
                      </div>
                      <div className="space-y-2">
                          <h1 className="text-3xl font-black text-[#1B2B33] tracking-tight">Application Pending</h1>
                          <p className="text-muted-foreground font-medium leading-relaxed px-4">
                              You already have a loan application in progress. To ensure the best service, we process one application at a time.
                          </p>
                      </div>
                  </div>

                  <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                      <CardContent className="p-8 space-y-6">
                          <div className="space-y-2 py-4 bg-[#F8FAFB] rounded-2xl border border-muted/50">
                              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Current Status</p>
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none font-black text-xs px-4 py-1 uppercase tracking-tighter">
                                  Under Review
                              </Badge>
                          </div>
                          
                          <div className="text-left bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 items-start">
                              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                              <p className="text-xs font-bold text-blue-800/80 leading-relaxed italic">
                                  "Our credit team is currently reviewing your previous submission. You'll be notified via SMS/Email once a decision is made."
                              </p>
                          </div>

                          <Button 
                            onClick={() => router.push('/account')} 
                            className="w-full h-16 rounded-full bg-[#1B2B33] hover:bg-[#1B2B33]/90 text-white text-lg font-black shadow-lg shadow-navy-900/20"
                          >
                              Back to My Dashboard
                          </Button>
                      </CardContent>
                  </Card>
              </div>
          </div>
      );
  }

  if (isSuccess) {
      return (
          <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-6 pb-12">
              <div className="w-full max-w-lg space-y-8">
                  <div className="text-center space-y-4">
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                          <CheckCircle2 className="h-10 w-10 text-green-600" />
                      </div>
                      <div className="space-y-2">
                          <h1 className="text-3xl font-black text-[#1B2B33] tracking-tight">Application Received!</h1>
                          <p className="text-muted-foreground font-medium px-4">To help us approve your <strong>{submittedType}</strong> faster, kindly forward the following documents via WhatsApp:</p>
                      </div>
                  </div>

                  <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
                      <CardContent className="p-8 space-y-6">
                          <div className="space-y-4">
                              <h3 className="text-xs font-black uppercase tracking-widest text-[#5BA9D0] flex items-center gap-2">
                                  <FileText className="h-4 w-4" /> Required Checklist
                              </h3>
                              <div className="space-y-3">
                                  {getRequirements(submittedType).map((req, i) => (
                                      <div key={i} className="flex items-start gap-3 bg-[#F8FAFB] p-4 rounded-2xl border border-muted/50 transition-all hover:border-[#5BA9D0]/30">
                                          <div className="h-5 w-5 rounded-full bg-white border-2 border-[#5BA9D0] flex-shrink-0 mt-0.5"></div>
                                          <span className="text-sm font-bold text-[#1B2B33]">{req}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>

                          <div className="bg-[#1B2B33] rounded-2xl p-6 text-white space-y-4">
                              <div className="flex items-center gap-2 text-[#5BA9D0]">
                                  <ShieldCheck className="h-5 w-5" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Data Protection Guaranteed</span>
                              </div>
                              <p className="text-xs text-white/70 leading-relaxed italic">
                                  "Your information is handled in strict compliance with the Data Protection Act. We only use these documents for credit scoring and identity verification."
                              </p>
                          </div>

                          <div className="space-y-3 pt-2">
                              <Button 
                                onClick={handleWhatsAppSubmission} 
                                className="w-full h-16 rounded-full bg-[#25D366] hover:bg-[#25D366]/90 text-white font-black text-lg shadow-lg shadow-green-500/20 group"
                              >
                                  <Share2 className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
                                  Submit Documents on WhatsApp
                              </Button>
                              <Button 
                                variant="ghost" 
                                onClick={() => router.push('/account')} 
                                className="w-full text-muted-foreground font-bold"
                              >
                                  Return to My Dashboard
                              </Button>
                          </div>
                      </CardContent>
                  </Card>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col">
      <div className="bg-[#1B2B33] text-white px-6 pt-12 pb-14 shrink-0">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()} 
            className="text-white/60 hover:text-white hover:bg-white/10 -ml-2 mb-4"
          >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
          </Button>
          <h1 className="text-3xl font-black tracking-tight leading-tight text-white">Apply for a New Loan</h1>
          <p className="text-white/60 text-sm mt-1">Get instant capital for your personal or business needs.</p>
      </div>

      <div className="px-6 -mt-8 flex-1 overflow-hidden flex flex-col pb-6">
          <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-navy-900/10 overflow-hidden flex-1 flex flex-col">
              <CardContent className="p-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-full w-full">
                      <div className="p-8 pb-12">
                          <Form {...form}>
                              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                  <FormField
                                      control={form.control}
                                      name="loanType"
                                      render={({ field }) => (
                                          <FormItem>
                                              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40">Loan Product</FormLabel>
                                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                  <FormControl>
                                                      <SelectTrigger className="h-14 rounded-xl border-[#5BA9D0]/20 bg-white shadow-sm focus:ring-[#5BA9D0]">
                                                          <SelectValue placeholder="Select product" />
                                                      </SelectTrigger>
                                                  </FormControl>
                                                  <SelectContent>
                                                      <SelectItem value="Quick Pesa (1 Month)">Quick Pesa (1 Month)</SelectItem>
                                                      <SelectItem value="Salary Advance">Salary Advance</SelectItem>
                                                      <SelectItem value="Individual & Business Loan">Business Loan</SelectItem>
                                                      <SelectItem value="Logbook Loan">Logbook Loan</SelectItem>
                                                  </SelectContent>
                                              </Select>
                                              <FormMessage />
                                          </FormItem>
                                      )}
                                  />

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <FormField
                                          control={form.control}
                                          name="principalAmount"
                                          render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40">Requested Amount (KSH)</FormLabel>
                                                  <FormControl>
                                                      <Input type="number" placeholder="0" className="h-14 rounded-xl border-[#5BA9D0]/20 shadow-sm focus:ring-[#5BA9D0]" {...field} />
                                                  </FormControl>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                      <FormField
                                          control={form.control}
                                          name="idNumber"
                                          render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40">National ID Number</FormLabel>
                                                  <FormControl>
                                                      <Input placeholder="ID Card Number" className="h-14 rounded-xl border-[#5BA9D0]/20 shadow-sm focus:ring-[#5BA9D0]" {...field} />
                                                  </FormControl>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <FormField
                                          control={form.control}
                                          name="numberOfInstalments"
                                          render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40">Instalments</FormLabel>
                                                  <FormControl>
                                                      <Input type="number" className="h-14 rounded-xl border-[#5BA9D0]/20 shadow-sm focus:ring-[#5BA9D0]" {...field} />
                                                  </FormControl>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                      <FormField
                                          control={form.control}
                                          name="paymentFrequency"
                                          render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40">Frequency</FormLabel>
                                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                      <FormControl>
                                                          <SelectTrigger className="h-14 rounded-xl border-[#5BA9D0]/20 bg-white shadow-sm focus:ring-[#5BA9D0]">
                                                              <SelectValue placeholder="Frequency" />
                                                          </SelectTrigger>
                                                      </FormControl>
                                                      <SelectContent>
                                                          <SelectItem value="daily">Daily</SelectItem>
                                                          <SelectItem value="weekly">Weekly</SelectItem>
                                                          <SelectItem value="monthly">Monthly</SelectItem>
                                                      </SelectContent>
                                                  </Select>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                  </div>

                                  {frequencyWatch === 'weekly' && (
                                      <FormField
                                          control={form.control}
                                          name="preferredPaymentDay"
                                          render={({ field }) => (
                                              <FormItem className="animate-in slide-in-from-top-2 duration-300">
                                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#5BA9D0]">Preferred Weekly Payment Day</FormLabel>
                                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                      <FormControl>
                                                          <SelectTrigger className="h-14 rounded-xl border-[#5BA9D0]/40 bg-[#5BA9D0]/5 shadow-sm focus:ring-[#5BA9D0]">
                                                              <SelectValue placeholder="Select day of week" />
                                                          </SelectTrigger>
                                                      </FormControl>
                                                      <SelectContent>
                                                          {DAYS_OF_WEEK.map(day => (
                                                              <SelectItem key={day} value={day}>{day}</SelectItem>
                                                          ))}
                                                      </SelectContent>
                                                  </Select>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                  )}

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <FormField
                                          control={form.control}
                                          name="customerPhone"
                                          render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40">Phone Number</FormLabel>
                                                  <FormControl>
                                                      <Input placeholder="0712 345 678" className="h-14 rounded-xl border-[#5BA9D0]/20 shadow-sm focus:ring-[#5BA9D0]" {...field} />
                                                  </FormControl>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                      <FormField
                                          control={form.control}
                                          name="alternativeNumber"
                                          render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#1B2B33]/40">Alternative Phone (Optional)</FormLabel>
                                                  <FormControl>
                                                      <Input placeholder="Second contact" className="h-14 rounded-xl border-[#5BA9D0]/20 shadow-sm focus:ring-[#5BA9D0]" {...field} />
                                                  </FormControl>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                  </div>

                                  <FormField
                                      control={form.control}
                                      name="agreedToTerms"
                                      render={({ field }) => (
                                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border border-[#5BA9D0]/10 bg-[#5BA9D0]/5 p-6 transition-colors hover:bg-[#5BA9D0]/10">
                                              <FormControl>
                                                  <Checkbox
                                                      checked={field.value}
                                                      onCheckedChange={field.onChange}
                                                      className="mt-1 border-[#5BA9D0] data-[state=checked]:bg-[#5BA9D0]"
                                                  />
                                              </FormControl>
                                              <div className="space-y-1 leading-none">
                                                  <FormLabel className="text-sm font-bold text-[#1B2B33]">
                                                      I agree to the terms and conditions and I am aware of the Data Protection Act of Pezeka Credit Ltd.
                                                  </FormLabel>
                                                  <p className="text-[10px] text-muted-foreground font-medium">
                                                      By submitting this form, you authorize our team to verify your information in compliance with Kenyan law.
                                                  </p>
                                                  <FormMessage />
                                              </div>
                                          </FormItem>
                                      )}
                                  />

                                  <Button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="w-full h-16 rounded-full bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 text-white text-lg font-black shadow-lg shadow-[#5BA9D0]/20 transition-all active:scale-95"
                                  >
                                      {isSubmitting ? (
                                          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing Request...</>
                                      ) : (
                                          'Submit Loan Application'
                                      )}
                                  </Button>
                              </form>
                          </Form>
                      </div>
                  </ScrollArea>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
