'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { upsertCustomer } from '@/lib/firestore';

const authSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().min(10, { message: 'Please enter a valid phone number.' }).optional(),
}).superRefine((data, ctx) => {
    // Phone is required for signup
    if (ctx.path.length === 0 && !data.phone && !data.firstName) {
        // Just a placeholder for refined logic if needed
    }
});

export default function CustomerLoginPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '', firstName: '', lastName: '', phone: '' },
  });

  useEffect(() => {
    if (!loading && user) router.push('/account');
  }, [user, loading, router]);
  
  async function onEmailSubmit(values: z.infer<typeof authSchema>) {
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        if (!values.firstName || !values.lastName || !values.phone) {
          toast({ variant: 'destructive', title: 'Missing Information', description: 'Name and Phone are required for registration.' });
          setIsSubmitting(false); return;
        }
        const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const fullName = `${values.firstName} ${values.lastName}`;
        await updateProfile(cred.user, { displayName: fullName });
        
        // Create customer record in Firestore immediately
        await upsertCustomer(firestore, cred.user.uid, {
            name: fullName,
            phone: values.phone,
        });

        toast({ title: 'Account Created', description: 'Welcome to Pezeka Credit!' });
      } else {
        await signInWithEmailAndPassword(auth, values.email, values.password);
        toast({ title: 'Logged in' });
      }
      router.push('/account');
    } catch (e: any) { toast({ variant: 'destructive', title: 'Authentication Failed', description: e.message }); } finally { setIsSubmitting(false); }
  }

  if (loading || user) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Card className="w-full max-w-md shadow-lg border-t-4 border-t-primary">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Customer Portal</CardTitle>
        <CardDescription>{isSignUp ? 'Create your account to start your application' : 'Sign in to manage your loans'}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-4 pt-4">
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="0712 345 678" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </>
            )}
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="email@example.com" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
            <div className="text-center text-sm">
              <Button type="button" variant="link" onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? 'Already have an account? Sign in' : 'Don\'t have an account? Sign up'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
