'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth, useAppUser, useFirestore } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export default function AdminLoginPage() {
  const { user, loading } = useAppUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });
  
  const isAuthorized = user && (user.email === 'simon@pezeka.com' || user.role === 'staff' || user.role === 'finance');

  useEffect(() => {
    // If the user is loaded and authorized, redirect them to the admin dashboard.
    if (!loading && isAuthorized) {
      router.push('/admin');
    }
  }, [user, loading, isAuthorized, router]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const isSimon = values.email === 'simon@pezeka.com';
    const isStaff = values.email.endsWith('@staff.pezeka.com');
    const isFinance = values.email.endsWith('@finance.pezeka.com');

    // Check if the email domain is permitted for admin/staff/finance access.
    if (!isSimon && !isStaff && !isFinance) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'This email domain is not authorized for admin access.',
      });
      return;
    }
    
    // Specific password check for the super admin.
    if (isSimon && values.password !== 'Symo@4927') {
        toast({
            variant: "destructive",
            title: "Login Failed",
            description: "Incorrect password for super admin.",
        });
        return;
    }

    setIsSubmitting(true);
    try {
      // 1. Attempt to sign in. Do not create an account.
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const loggedInUser = userCredential.user;
      
      // 2. Verify that a user profile exists in Firestore.
      const userDocRef = doc(firestore, 'users', loggedInUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      // 3. If no profile exists, this is an invalid login.
      if (!userDocSnap.exists()) {
        await signOut(auth); // Sign out the authenticated but unauthorized user.
        throw new Error("User profile not found. Please contact an administrator to set up your account.");
      }
      
      // 4. If profile exists, redirect to the dashboard.
      router.push('/admin');

    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No user found with this email. Please contact an administrator.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      }

      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  // While loading user data or if the user is already authorized, show a spinner.
  // The useEffect will handle the redirect.
  if (loading || (!loading && isAuthorized)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If the user is not loading and not authorized, show the login form.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Pezeka Credit | Admin</CardTitle>
          <CardDescription>
            Enter your credentials to access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="admin@pezeka.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
