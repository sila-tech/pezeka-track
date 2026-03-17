
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { query, collection, where, getDocs, doc, writeBatch } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { upsertCustomer, getUserByReferralCode, addReferral } from '@/lib/firestore';

const authSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }).optional().or(z.literal('')),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

export default function CustomerLoginPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
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
        if (!values.firstName || !values.lastName || !values.phone || values.phone.length < 10 || !values.password) {
          toast({ 
            variant: 'destructive', 
            title: 'Missing Information', 
            description: 'Name, valid Phone number, and Password are required for registration.' 
          });
          setIsSubmitting(false); 
          return;
        }

        // 1. Create the Auth Account
        const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const fullName = `${values.firstName} ${values.lastName}`;
        await updateProfile(cred.user, { displayName: fullName });
        
        // 2. Link existing loans if any
        const loansQuery = query(collection(firestore, 'loans'), where('customerPhone', '==', values.phone));
        const loansSnapshot = await getDocs(loansQuery);
        
        if (!loansSnapshot.empty) {
            const batch = writeBatch(firestore);
            loansSnapshot.docs.forEach((loanDoc) => {
                batch.update(doc(firestore, 'loans', loanDoc.id), {
                    customerId: cred.user.uid,
                    customerEmail: values.email,
                    updatedAt: new Date()
                });
            });
            await batch.commit();
            toast({ title: 'Profile Synced', description: 'We found and linked your existing loan history!' });
        }

        // 3. Referral Handling
        let referredByUid = "";
        let referredByCode = "";
        let referrerName = "";
        const savedRefCode = sessionStorage.getItem('pezeka_referral_code');
        
        if (savedRefCode) {
            const referrer = await getUserByReferralCode(firestore, savedRefCode);
            if (referrer) {
                referredByUid = referrer.uid;
                referredByCode = savedRefCode;
                referrerName = referrer.name;
                
                // Log the referral conversion
                await addReferral(firestore, {
                    referrerId: referredByUid,
                    referrerName: referrerName,
                    refereeId: cred.user.uid,
                    refereeName: fullName
                });
                
                sessionStorage.removeItem('pezeka_referral_code'); // Done with it
            }
        }

        // 4. Create/Update Customer Document
        await upsertCustomer(firestore, cred.user.uid, {
            name: fullName,
            phone: values.phone,
            email: values.email,
            referredBy: referredByUid,
            referredByCode: referredByCode
        });

        toast({ title: 'Account Created', description: 'Welcome to Pezeka Credit!' });
      } else {
        if (!values.password) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter your password.' });
            setIsSubmitting(false);
            return;
        }
        await signInWithEmailAndPassword(auth, values.email, values.password);
        toast({ title: 'Welcome Back!', description: 'Logged in successfully.' });
      }
      router.push('/account');
    } catch (e: any) { 
      toast({ 
        variant: 'destructive', 
        title: 'Authentication Failed', 
        description: e.message || 'Check your credentials and try again.' 
      }); 
    } finally { 
      setIsSubmitting(false); 
    }
  }

  const handleForgotPassword = async () => {
    const email = form.getValues('email');
    if (!email || !z.string().email().safeParse(email).success) {
      toast({ variant: 'destructive', title: 'Email Required', description: 'Please enter a valid email address first.' });
      return;
    }

    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: 'Email Sent', description: `A password reset link has been sent to ${email}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Reset Failed', description: error.message });
    } finally {
      setIsResetting(false);
    }
  };

  if (loading || user) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="w-full max-w-md flex flex-col items-center">
      <div className="mb-6">
        <img src="/pezeka_logo_transparent.png" alt="Pezeka Logo" className="h-20 w-20 object-contain" />
      </div>
      <Card className="w-full shadow-lg border-t-4 border-t-primary">
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
                <FormItem>
                  <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      {!isSignUp && (
                          <Button type="button" variant="link" className="px-0 font-normal h-auto text-xs" onClick={handleForgotPassword} disabled={isResetting}>
                              {isResetting ? 'Sending...' : 'Forgot Password?'}
                          </Button>
                      )}
                  </div>
                  <FormControl><Input type="password" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
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
    </div>
  );
}
