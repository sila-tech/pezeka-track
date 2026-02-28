'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  
  const isAuthorizedAdmin = user && (user.email === 'simon@pezeka.com' || user.role === 'staff' || user.role === 'finance');

  useEffect(() => {
    if (!loading && isAuthorizedAdmin) {
      router.push('/admin');
    }
  }, [user, loading, isAuthorizedAdmin, router]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const isSimon = values.email === 'simon@pezeka.com';
    const isStaff = values.email.endsWith('@staff.pezeka.com');
    const isFinance = values.email.endsWith('@finance.pezeka.com');

    if (isSimon && values.password !== 'Symo@4927') {
         toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'Invalid password for the super admin account.',
        });
        return;
    }

    if (!isSimon && !isStaff && !isFinance) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'This email domain is not authorized for admin access.',
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const loggedInUser = userCredential.user;

      if (isSimon) {
        router.push('/admin');
        return;
      }
      
      const userDocRef = doc(firestore, 'users', loggedInUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        const role = isFinance ? 'finance' : 'staff';
        await setDoc(userDocRef, {
            uid: loggedInUser.uid,
            email: loggedInUser.email,
            role: role,
            name: loggedInUser.email?.split('@')[0] || "New Staff"
        });
        toast({ title: "Profile Provisioned", description: `Welcome! Your ${role} profile has been created automatically.` });
      }
      
      router.push('/admin');

    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password. Please check your credentials.';
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
  
  if (loading || (!loading && isAuthorizedAdmin)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!loading && user && !isAuthorizedAdmin) {
     return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
            <Card className="w-full max-w-sm">
                 <CardHeader>
                    <CardTitle>Access Restricted</CardTitle>
                    <CardDescription>
                        Your account does not have admin privileges.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => signOut(auth).then(() => router.push('/admin/login'))} className="w-full">
                        Logout
                    </Button>
                </CardContent>
            </Card>
        </main>
     )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Pezeka Credit</CardTitle>
          <CardDescription>
            Admin Management Portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@pezeka.com" {...field} />
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
              <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Login to Dashboard
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
