'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
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

const authSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});


export default function CustomerLoginPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);


  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '', firstName: '', lastName: '' },
  });

  useEffect(() => {
    if (!loading && user) {
      router.push('/account');
    }
  }, [user, loading, router]);
  

  async function onEmailSubmit(values: z.infer<typeof authSchema>) {
    setIsSubmitting(true);
    if (isSignUp) {
      if (!values.firstName || !values.lastName) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide both first and last names.' });
        setIsSubmitting(false);
        return;
      }
      // Handle Sign Up
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        await updateProfile(userCredential.user, {
          displayName: `${values.firstName} ${values.lastName}`
        });
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
         if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            toast({ variant: 'destructive', title: 'Login Failed', description: 'Invalid email or password. Please check your credentials.' });
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
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Customer Portal</CardTitle>
          <CardDescription>{isSignUp ? 'Create your account to apply for a loan.' : 'Sign in to your account.'}</CardDescription>
        </CardHeader>
        <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-4 pt-4">
                  {isSignUp && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="firstName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl><Input placeholder="John" {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="lastName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl><Input placeholder="Doe" {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl><Input placeholder="your@email.com" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" placeholder="••••••••" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex flex-col gap-4 mt-6">
                    <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
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
                            className="p-0 h-auto font-bold"
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
                            className="p-0 h-auto font-bold"
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