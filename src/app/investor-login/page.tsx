'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useInvestorUser } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

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

export default function InvestorLoginPage() {
  const { user, loading } = useInvestorUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!loading && user) {
      router.push('/investor');
    }
  }, [user, loading, router]);

  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: 'Login Successful', description: 'Redirecting to your dashboard...' });
      router.push('/investor');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Login Failed', description: 'Invalid email or password.' });
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Investor Portal</CardTitle>
        <CardDescription>Sign in to view your portfolio dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onLoginSubmit)} className="space-y-6">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input placeholder="you@investor.com" {...field} /></FormControl>
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
