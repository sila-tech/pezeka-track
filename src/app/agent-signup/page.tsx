
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore, useUser, useAppUser } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, TrendingUp, Users, LogIn } from 'lucide-react';
import { registerAgent } from '@/lib/firestore';

const signupSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name.'),
  email: z.string().email('Please enter a valid email address.'),
  phone: z.string().min(10, 'Please enter a valid phone number.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export default function AgentSignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: userLoading } = useUser();
  const { user: appUser } = useAppUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already logged in as an agent
  useEffect(() => {
    if (appUser?.role === 'agent') {
      router.push('/agent');
    }
  }, [appUser, router]);

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
  });

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function handleApplyDirectly() {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await registerAgent(firestore, user.uid, {
        email: user.email!,
        name: user.displayName || 'Existing User',
        phone: 'Contact provided previously'
      });
      toast({ title: 'Application Submitted', description: 'Your account has been submitted for agent approval.' });
      router.push('/agent');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSignupSubmit(values: z.infer<typeof signupSchema>) {
    setIsSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
      await updateProfile(cred.user, { displayName: values.fullName });
      await registerAgent(firestore, cred.user.uid, {
          email: values.email,
          name: values.fullName,
          phone: values.phone
      });
      toast({ title: 'Registration Successful', description: 'Your agent account is awaiting approval.' });
      router.push('/agent');
    } catch (e: any) {
      let errorMessage = e.message || 'An error occurred during registration.';
      if (e.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
        setIsLogin(true);
      }
      toast({ variant: 'destructive', title: 'Signup Failed', description: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: 'Welcome Back', description: 'Redirecting to agent portal...' });
      router.push('/agent');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Login Failed', description: 'Invalid email or password.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mounted) {
    return (
        <div className="w-full flex items-center justify-center p-20">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground/20" />
        </div>
    );
  }

  return (
    <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
      {/* Brand Value Side */}
      <div className="space-y-8 p-4">
          <div className="space-y-2">
              <h1 className="text-4xl font-black text-[#1B2B33] leading-tight">
                  {isLogin ? 'Agent' : 'Partner'} Portal for <span className="text-[#5BA9D0]">Pezeka Credit</span>
              </h1>
              <p className="text-muted-foreground text-lg">
                  {isLogin 
                    ? 'Access your dashboard to manage referrals and track commissions.'
                    : 'Join our network of partners and earn commissions by connecting entrepreneurs with capital.'
                  }
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
          <CardTitle className="text-2xl font-black">{isLogin ? 'Agent Sign In' : 'Partner Sign Up'}</CardTitle>
          <CardDescription className="text-white/60">
              {isLogin ? 'Log in to your dashboard' : 'Fill in your details to start your application.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {user && !isLogin && !userLoading ? (
            <div className="space-y-6 py-4">
              <div className="p-6 bg-[#5BA9D0]/5 rounded-2xl border border-[#5BA9D0]/10 text-center">
                <p className="text-sm text-muted-foreground mb-2">You are already signed in as</p>
                <p className="font-black text-[#1B2B33] text-lg">{user.displayName || user.email}</p>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Would you like to use this account to apply for an agent partnership?
              </p>
              <Button onClick={handleApplyDirectly} disabled={isSubmitting} className="w-full h-14 rounded-full text-lg font-black bg-[#5BA9D0] hover:bg-[#5BA9D0]/90">
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Apply with this Account'}
              </Button>
              <div className="text-center">
                <Button variant="link" className="text-xs" onClick={() => auth.signOut()}>
                  Sign in with a different email
                </Button>
              </div>
            </div>
          ) : isLogin ? (
            <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
                    <FormField control={loginForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="agent@example.com" 
                              className="h-12 rounded-xl" 
                              {...field} 
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={loginForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              className="h-12 rounded-xl" 
                              {...field} 
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <Button type="submit" className="w-full h-14 rounded-full text-lg font-black bg-[#1B2B33] hover:bg-[#1B2B33]/90 text-white transition-all active:scale-95 shadow-xl shadow-[#1B2B33]/20" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
                        Sign In to Portal
                    </Button>
                    <div className="text-center pt-2">
                        <p className="text-xs text-muted-foreground">
                            New here? <button type="button" onClick={() => setIsLogin(false)} className="text-[#5BA9D0] font-bold hover:underline">Create a Partner Account</button>
                        </p>
                    </div>
                </form>
            </Form>
          ) : (
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-5">
                <FormField control={signupForm.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="John Doe" 
                        className="h-12 rounded-xl" 
                        {...field} 
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={signupForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="john@example.com" 
                        className="h-12 rounded-xl" 
                        {...field} 
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={signupForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0712 345 678" 
                        className="h-12 rounded-xl" 
                        {...field} 
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={signupForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secure Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Min. 6 characters" 
                        className="h-12 rounded-xl" 
                        {...field} 
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                
                <Button type="submit" className="w-full h-14 rounded-full text-lg font-black bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 transition-all active:scale-95 shadow-xl shadow-[#5BA9D0]/20" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Apply to Join'}
                </Button>

                <div className="text-center pt-2 flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">
                        Already have an account? <button type="button" onClick={() => setIsLogin(true)} className="text-[#5BA9D0] font-bold hover:underline">Sign In Instead</button>
                    </p>
                </div>
              </form>
            </Form>
          )}
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
