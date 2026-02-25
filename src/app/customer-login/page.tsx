'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const emailSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});


export default function CustomerLoginPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);


  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!loading && user) {
      router.push('/account');
    }
  }, [user, loading, router]);
  

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
          <CardTitle>Customer Portal</CardTitle>
          <CardDescription>{isSignUp ? 'Create your account to apply for a loan.' : 'Sign in to your account.'}</CardDescription>
        </CardHeader>
        <CardContent>
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-6 pt-4">
                  <FormField control={emailForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input placeholder="your@email.com" {...field} /></FormControl>
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
        </CardContent>
      </Card>
    </>
  );
}
