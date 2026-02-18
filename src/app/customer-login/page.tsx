'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
} from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const emailSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

const phoneSchema = z.object({
  phone: z.string().min(10, { message: 'Please enter a valid phone number including country code.' }),
});

const codeSchema = z.object({
  code: z.string().min(6, { message: 'Verification code must be 6 digits.' }),
});

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}

export default function CustomerLoginPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);


  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '' },
  });

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });
  
  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (!loading && user) {
      router.push('/account');
    }
  }, [user, loading, router]);
  
  useEffect(() => {
    if (auth && recaptchaContainerRef.current && !window.recaptchaVerifier) {
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
      window.recaptchaVerifier = verifier;
      
      return () => {
        verifier.clear();
      };
    }
  }, [auth]);

  async function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    setIsSubmitting(true);
    if (isSignUp) {
      // Handle Sign Up
      try {
        await createUserWithEmailAndPassword(auth, values.email, values.password);
        toast({ title: 'Account Created', description: 'Welcome! Redirecting to your account...' });
        router.push('/account');
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Handle Sign In
      try {
        await signInWithEmailAndPassword(auth, values.email, values.password);
        toast({ title: 'Login Successful', description: 'Redirecting to your account...' });
        router.push('/account');
      } catch (error: any) {
         if (error.code === 'auth/user-not-found') {
            toast({ variant: 'destructive', title: 'Login Failed', description: 'No account found with this email. Please sign up.' });
        } else {
            toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  async function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
    setIsSubmitting(true);
    const appVerifier = window.recaptchaVerifier;
    try {
      const result = await signInWithPhoneNumber(auth, values.phone, appVerifier);
      setConfirmationResult(result);
      setShowCodeForm(true);
      toast({ title: 'Verification Code Sent', description: `A code has been sent to ${values.phone}.` });
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Failed to Send Code', description: 'Please ensure you use a valid phone number with a country code (e.g., +254...).' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onCodeSubmit(values: z.infer<typeof codeSchema>) {
    if (!confirmationResult) return;
    setIsSubmitting(true);
    try {
      await confirmationResult.confirm(values.code);
      toast({ title: 'Login Successful', description: 'Redirecting to your account...' });
      router.push('/account');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Verification Failed', description: 'The code you entered is incorrect.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div ref={recaptchaContainerRef}></div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Customer Portal</CardTitle>
          <CardDescription>{isSignUp ? 'Create your account to apply for a loan.' : 'Sign in to your account.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="phone">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="phone">Phone Number</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
            </TabsList>
            <TabsContent value="phone">
              {!showCodeForm ? (
                <Form {...phoneForm}>
                  <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-6 pt-4">
                    <FormField control={phoneForm.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl><Input placeholder="+254712345678" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Send Verification Code
                    </Button>
                  </form>
                </Form>
              ) : (
                <Form {...codeForm}>
                   <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-6 pt-4">
                    <FormField control={codeForm.control} name="code" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Code</FormLabel>
                        <FormControl><Input placeholder="Enter 6-digit code" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex flex-col gap-2">
                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Verify & Sign In
                      </Button>
                      <Button variant="link" size="sm" onClick={() => { setShowCodeForm(false); codeForm.reset(); setConfirmationResult(null); }}>
                        Use a different phone number
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </TabsContent>
            <TabsContent value="email">
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-6 pt-4">
                  <FormField control={emailForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input placeholder="you@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={emailForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex flex-col gap-4">
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isSignUp ? 'Create Account' : 'Sign In'}
                    </Button>
                    <div className="text-center text-sm">
                      {isSignUp ? (
                        <>
                          Already have an account?{' '}
                          <Button
                            type="button"
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => setIsSignUp(false)}
                          >
                            Sign In
                          </Button>
                        </>
                      ) : (
                        <>
                          Don't have an account?{' '}
                          <Button
                            type="button"
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => setIsSignUp(true)}
                          >
                            Sign Up
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
