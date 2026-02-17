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
import Link from 'next/link';

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
    confirmationResult: ConfirmationResult;
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
    if (recaptchaContainerRef.current && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
    }
  }, [auth]);

  async function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: 'Login Successful', description: 'Redirecting to your account...' });
      router.push('/account');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        try {
          await createUserWithEmailAndPassword(auth, values.email, values.password);
          toast({ title: 'Account Created', description: 'Welcome! Redirecting to your account...' });
          router.push('/account');
        } catch (creationError: any) {
          toast({ variant: 'destructive', title: 'Sign Up Failed', description: creationError.message });
        }
      } else {
        toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
    setIsSubmitting(true);
    const appVerifier = window.recaptchaVerifier;
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, values.phone, appVerifier);
      window.confirmationResult = confirmationResult;
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
    if (!window.confirmationResult) return;
    setIsSubmitting(true);
    try {
      await window.confirmationResult.confirm(values.code);
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
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <div ref={recaptchaContainerRef}></div>
      <Link href="/" className="mb-4 text-sm text-primary hover:underline">← Back to Home</Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Customer Portal</CardTitle>
          <CardDescription>Sign in or create an account to apply for a loan.</CardDescription>
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
                      <Button variant="link" size="sm" onClick={() => { setShowCodeForm(false); codeForm.reset(); }}>
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
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign In / Sign Up
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
