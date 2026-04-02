
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore, useAppUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { query, collection, where, getDocs, limit } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { upsertCustomer } from '@/lib/firestore';

const authSchema = z.object({
  identifier: z.string().min(3, { message: 'Enter your email or phone number.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }).optional().or(z.literal('')),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().min(10, 'Valid phone number is required.').optional().or(z.literal('')),
  idNumber: z.string().min(5, 'National ID is required.').optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
});

export default function CustomerLoginPage() {
  const { user, loading } = useAppUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      identifier: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      idNumber: '',
      email: '',
    },
  });

  useEffect(() => {
    if (!loading && user) {
        router.replace('/account');
    }
  }, [user, loading, router]);
  
  async function onAuthSubmit(values: z.infer<typeof authSchema>) {
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        // Enforce mandatory fields during sign-up
        if (!values.firstName || !values.lastName || !values.phone || !values.idNumber || !values.password || !values.email) {
          toast({ 
            variant: 'destructive', 
            title: 'Incomplete Registration', 
            description: 'All fields are required to create an account.' 
          });
          setIsSubmitting(false); 
          return;
        }

        const referredBy = typeof window !== 'undefined' ? sessionStorage.getItem('referralCode') || undefined : undefined;

        const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const fullName = `${values.firstName} ${values.lastName}`;
        await updateProfile(cred.user, { displayName: fullName });
        
        await upsertCustomer(firestore, cred.user.uid, {
            name: fullName,
            phone: values.phone,
            email: values.email,
            idNumber: values.idNumber,
            referredBy: referredBy
        });

        if (referredBy) {
            sessionStorage.removeItem('referralCode');
        }

        toast({ title: 'Account Created', description: 'Welcome to Pezeka Credit!' });
      } else {
        if (!values.password) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter your password.' });
            setIsSubmitting(false);
            return;
        }

        let loginEmail = values.identifier;

        // If identifier is not an email, assume it's a phone number and look up the email
        if (!values.identifier.includes('@')) {
            const customersRef = collection(firestore, 'customers');
            const q = query(customersRef, where('phone', '==', values.identifier), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'Account Not Found', description: 'No member is registered with this phone number.' });
                setIsSubmitting(false);
                return;
            }
            
            const customerData = querySnapshot.docs[0].data();
            if (!customerData.email) {
                toast({ variant: 'destructive', title: 'Configuration Error', description: 'This phone account does not have a linked email. Contact support.' });
                setIsSubmitting(false);
                return;
            }
            loginEmail = customerData.email;
        }

        await signInWithEmailAndPassword(auth, loginEmail, values.password);
        toast({ title: 'Welcome Back!', description: 'Logged in successfully.' });
      }
    } catch (e: any) { 
      let errorMessage = e.message;
      if (e.code === 'auth/network-request-failed') {
        errorMessage = 'Connection error. Please check your internet or try again later.';
      } else if (e.code === 'auth/invalid-credential') {
          errorMessage = 'Incorrect credentials. Check your password or email/phone.';
      }
      toast({ 
        variant: 'destructive', 
        title: 'Authentication Failed', 
        description: errorMessage 
      }); 
    } finally { 
      setIsSubmitting(false); 
    }
  }

  const handleForgotPassword = async () => {
    const identifier = form.getValues('identifier');
    if (!identifier) {
      toast({ variant: 'destructive', title: 'Email Required', description: 'Please enter your email address to reset password.' });
      return;
    }

    let resetEmail = identifier;

    if (!identifier.includes('@')) {
        toast({ variant: 'destructive', title: 'Use Email', description: 'Please enter your registered email address to receive a reset link.' });
        return;
    }

    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast({ title: 'Email Sent', description: `A reset link has been sent to ${resetEmail}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Reset Failed', description: error.message });
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="w-full max-w-md flex flex-col items-center">
      <div className="mb-6">
        <img src="/pezeka_logo_transparent.png" alt="Pezeka Logo" className="h-20 w-20 object-contain" />
      </div>
      <Card className="w-full shadow-lg border-t-4 border-t-primary rounded-3xl overflow-hidden">
        <CardHeader className="text-center bg-muted/20 pb-8">
          <CardTitle className="text-2xl font-black text-[#1B2B33]">{isSignUp ? 'Join Pezeka' : 'Member Sign In'}</CardTitle>
          <CardDescription className="font-medium">{isSignUp ? 'Complete your profile to start applying for loans' : 'Login with your registered Email or Phone'}</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAuthSubmit)} className="space-y-5">
              {isSignUp && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">First Name</FormLabel>
                        <FormControl><Input placeholder="John" {...field} className="h-12 rounded-xl" value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Last Name</FormLabel>
                        <FormControl><Input placeholder="Doe" {...field} className="h-12 rounded-xl" value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-xs uppercase tracking-widest text-primary">Phone Number</FormLabel>
                        <FormControl><Input placeholder="07XX XXX XXX" {...field} className="h-12 rounded-xl border-primary/30 focus:ring-primary" value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="idNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-xs uppercase tracking-widest text-primary">National ID</FormLabel>
                        <FormControl><Input placeholder="ID Card No" {...field} className="h-12 rounded-xl border-primary/30 focus:ring-primary" value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Email Address</FormLabel>
                      <FormControl><Input placeholder="email@example.com" {...field} className="h-12 rounded-xl" value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </>
              )}
              
              {!isSignUp && (
                <FormField control={form.control} name="identifier" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Email or Phone Number</FormLabel>
                    <FormControl><Input placeholder="07XX... or email@domain.com" {...field} className="h-12 rounded-xl" value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                      <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Password</FormLabel>
                      {!isSignUp && (
                          <Button type="button" variant="link" className="px-0 font-bold h-auto text-xs text-primary" onClick={handleForgotPassword} disabled={isResetting}>
                              {isResetting ? 'Sending...' : 'Forgot Password?'}
                          </Button>
                      )}
                  </div>
                  <FormControl><Input type="password" {...field} className="h-12 rounded-xl" value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full h-14 rounded-full font-black text-lg bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 transition-all active:scale-95" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {isSignUp ? 'Create Member Account' : 'Sign In to Portal'}
              </Button>
              <div className="text-center pt-2">
                <Button type="button" variant="ghost" className="font-bold text-sm hover:bg-transparent hover:text-primary" onClick={() => setIsSignUp(!isSignUp)}>
                  {isSignUp ? 'Already a member? Sign in here' : 'New to Pezeka? Register here'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
