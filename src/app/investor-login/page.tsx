'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { createInvestorProfile } from '@/lib/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

const signupSchema = z.object({
    name: z.string().min(2, { message: 'Please enter your full name.' }),
    email: z.string().email({ message: 'Please enter a valid email.' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});


export default function InvestorLoginPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const form = useForm<z.infer<typeof loginSchema> | z.infer<typeof signupSchema>>({
    resolver: zodResolver(isSignUp ? signupSchema : loginSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  
  useEffect(() => {
    form.reset();
  }, [isSignUp, form]);


  useEffect(() => {
    if (!loading && user) {
      router.push('/investor-dashboard');
    }
  }, [user, loading, router]);
  

  async function onSubmit(values: z.infer<typeof loginSchema> | z.infer<typeof signupSchema>) {
    setIsSubmitting(true);
    if (isSignUp) {
      // Handle Sign Up
      const signupValues = values as z.infer<typeof signupSchema>;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, signupValues.email, signupValues.password);
        await createInvestorProfile(firestore, userCredential.user.uid, { name: signupValues.name, email: signupValues.email });
        toast({ title: 'Account Created', description: 'Welcome! Redirecting to your dashboard...' });
        router.push('/investor-dashboard');
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Handle Sign In
      const loginValues = values as z.infer<typeof loginSchema>;
      try {
        await signInWithEmailAndPassword(auth, loginValues.email, loginValues.password);
        toast({ title: 'Login Successful', description: 'Redirecting to your dashboard...' });
        router.push('/investor-dashboard');
      } catch (error: any) {
         if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' ) {
            toast({ variant: 'destructive', title: 'Login Failed', description: 'No account found with this email. Please sign up.' });
        } else {
            toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
        }
      } finally {
        setIsSubmitting(false);
      }
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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Investor Portal</CardTitle>
          <CardDescription>{isSignUp ? 'Create your investor account.' : 'Sign in to your investor account.'}</CardDescription>
        </CardHeader>
        <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                  {isSignUp && (
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )} />
                  )}
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input placeholder="you@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
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
        </CardContent>
      </Card>
    </>
  );
}
