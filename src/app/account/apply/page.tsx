'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react';

import { useUser, useFirestore, useDoc } from '@/firebase';
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

const applySchema = z.object({
  loanType: z.string().min(1, 'Please select a loan product.'),
  principalAmount: z.coerce.number().min(500, 'Minimum amount is Ksh 500.'),
  idNumber: z.string().min(5, 'National ID is required.'),
  numberOfInstalments: z.coerce.number().int().min(1, 'At least 1 instalment is required.'),
  paymentFrequency: z.enum(['daily', 'weekly', 'monthly']),
  customerPhone: z.string().min(10, 'Valid phone number is required.'),
  alternativeNumber: z.string().optional(),
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and conditions.',
  }),
});

export default function ApplyPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: profile } = useDoc<any>(user ? `customers/${user.uid}` : null);

  const form = useForm<z.infer<typeof applySchema>>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      loanType: 'Quick Pesa (1 Month)',
      principalAmount: 0,
      idNumber: '',
      numberOfInstalments: 1,
      paymentFrequency: 'monthly',
      customerPhone: '',
      alternativeNumber: '',
      agreedToTerms: false,
    },
  });

  // Pre-fill phone number when profile data arrives
  useEffect(() => {
    if (profile?.phone && !form.getValues('customerPhone')) {
      form.setValue('customerPhone', profile.phone);
    }
    if (profile?.idNumber && !form.getValues('idNumber')) {
        form.setValue('idNumber', profile.idNumber);
    }
  }, [profile, form]);

  async function onSubmit(values: z.infer<typeof applySchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const applicationData = {
        ...values,
        customerName: profile?.name || user.displayName || 'Customer',
      };
      
      await submitCustomerApplication(firestore, user.uid, applicationData);
      setIsSuccess(true);
      toast({ title: 'Application Submitted', description: 'We have received your loan request.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
      return (
          <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div className="space-y-2">
                  <h1 className="text-2xl font-black text-[#1B2B33]">Application Successful!</h1>
                  <p className="text-muted-foreground max-w-xs mx-auto">Your request has been received. Our team will review it and get back to you shortly.</p>
              </div>
              <Button onClick={() => router.push('/account')} className="w-full max-w-xs bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 font-bold h-12 rounded-xl">
                  Return to Dashboard
              </Button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col">
      {/* Header Area - Static */}
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

      {/* Form Body - Scrollable Container */}
      <div className="px-6 -mt-8 flex-1 overflow-hidden flex flex-col pb-6">
          <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-navy-900/10 overflow-hidden flex-1 flex flex-col">
              <CardContent className="p-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-full w-full">
                      <div className="p-8 pb-12">
                          <Form {...form}>
                              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                  {/* Loan Product */}
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

                                  {/* Terms Checkbox */}
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
                                                      I agree to the terms and conditions of Pezeka Credit Ltd.
                                                  </FormLabel>
                                                  <p className="text-[10px] text-muted-foreground font-medium">
                                                      By submitting this form, you authorize our team to verify your information.
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
