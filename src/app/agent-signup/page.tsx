
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { registerAgent } from '@/lib/firestore';
import Link from 'next/link';

const agentSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name.'),
  email: z.string().email('Please enter a valid email address.'),
  phone: z.string().min(10, 'Please enter a valid phone number.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export default function AgentSignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof agentSchema>>({
    resolver: zodResolver(agentSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
  });

  async function onSubmit(values: z.infer<typeof agentSchema>) {
    setIsSubmitting(true);
    try {
      // 1. Create the Auth account
      const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
      await updateProfile(cred.user, { displayName: values.fullName });

      // 2. Create the UserProfile in Firestore
      await registerAgent(firestore, cred.user.uid, {
          email: values.email,
          name: values.fullName,
          phone: values.phone
      });

      toast({ 
          title: 'Registration Successful', 
          description: 'Your agent account has been created and is awaiting approval.' 
      });
      
      router.push('/agent');
    } catch (e: any) {
      toast({ 
          variant: 'destructive', 
          title: 'Signup Failed', 
          description: e.message || 'An error occurred during registration.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
      {/* Brand Value Side */}
      <div className="space-y-8 p-4">
          <div className="space-y-2">
              <h1 className="text-4xl font-black text-[#1B2B33] leading-tight">
                  Grow Your Business as a <span className="text-[#5BA9D0]">Pezeka Agent</span>
              </h1>
              <p className="text-muted-foreground text-lg">
                  Join our network of partners and earn commissions by connecting entrepreneurs with the capital they need.
              </p>
          </div>

          <div className="space-y-6">
              <BenefitItem 
                icon={<TrendingUp className="h-6 w-6 text-[#5BA9D0]" />}
                title="Attractive Commissions"
                description="Earn a percentage of every verified loan disbursement you refer."
              />
              <BenefitItem 
                icon={<ShieldCheck className="h-6 w-6 text-[#5BA9D0]" />}
                title="Trusted Brand"
                description="Partner with a reliable, transparent credit provider in Kenya."
              />
              <BenefitItem 
                icon={<Users className="h-6 w-6 text-[#5BA9D0]" />}
                title="Agent Dashboard"
                description="Real-time tracking of your referrals and earnings status."
              />
          </div>
      </div>

      {/* Form Side */}
      <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-[#1B2B33] text-white p-8">
          <CardTitle className="text-2xl font-black">Partner Sign Up</CardTitle>
          <CardDescription className="text-white/60">Fill in your details to start your application.</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" className="h-12 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="john@example.com" className="h-12 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="0712 345 678" className="h-12 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>Secure Password</FormLabel><FormControl><Input type="password" placeholder="Min. 6 characters" className="h-12 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <Button type="submit" className="w-full h-14 rounded-full text-lg font-black bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 transition-all active:scale-95 shadow-xl shadow-[#5BA9D0]/20" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Apply to Join'}
              </Button>

              <div className="text-center pt-2">
                  <p className="text-xs text-muted-foreground">
                      Already have an account? <Link href="/customer-login" className="text-[#5BA9D0] font-bold hover:underline">Sign In</Link>
                  </p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function BenefitItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="space-y-1">
                <h3 className="font-bold text-[#1B2B33]">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
        </div>
    );
}
