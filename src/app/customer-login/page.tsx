'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore, useAppUser } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { query, collection, where, getDocs, limit } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Phone,
  Lock,
  User,
  Mail,
  CreditCard,
  ChevronRight,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { upsertCustomer } from '@/lib/firestore';

const authSchema = z.object({
  identifier: z.string().optional(),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  idNumber: z.string().optional(),
  email: z.string().optional(),
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
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

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
        if (!values.firstName || !values.lastName || !values.phone || !values.idNumber || !values.password || !values.email) {
          toast({
            variant: 'destructive',
            title: 'Incomplete Registration',
            description: 'All fields are required to create an account.',
          });
          setIsSubmitting(false);
          return;
        }

        const referredBy =
          typeof window !== 'undefined'
            ? sessionStorage.getItem('referralCode') || undefined
            : undefined;

        const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const fullName = `${values.firstName} ${values.lastName}`;
        await updateProfile(cred.user, { displayName: fullName });

        await upsertCustomer(firestore, cred.user.uid, {
          name: fullName,
          phone: values.phone,
          email: values.email,
          idNumber: values.idNumber,
          referredBy: referredBy,
        });

        if (referredBy) sessionStorage.removeItem('referralCode');

        toast({ title: 'Account Created! 🎉', description: 'Welcome to Pezeka Credit!' });
        router.push('/account');
      } else {
        if (!values.identifier || values.identifier.length < 3) {
          toast({ variant: 'destructive', title: 'Error', description: 'Enter your email or phone number.' });
          setIsSubmitting(false);
          return;
        }

        let loginEmail = values.identifier;

        if (!values.identifier.includes('@')) {
          const customersRef = collection(firestore, 'customers');
          const q = query(customersRef, where('phone', '==', values.identifier), limit(1));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            toast({
              variant: 'destructive',
              title: 'Account Not Found',
              description: 'No member is registered with this phone number.',
            });
            setIsSubmitting(false);
            return;
          }

          const customerData = querySnapshot.docs[0].data();
          if (!customerData.email) {
            toast({
              variant: 'destructive',
              title: 'Configuration Error',
              description: 'This account has no linked email. Contact support.',
            });
            setIsSubmitting(false);
            return;
          }
          loginEmail = customerData.email;
        }

        await signInWithEmailAndPassword(auth, loginEmail, values.password);
        toast({ title: 'Welcome Back! 👋', description: 'Logged in successfully.' });
        router.push('/account');
      }
    } catch (e: any) {
      let errorMessage = e.message;
      if (e.code === 'auth/network-request-failed') {
        errorMessage = 'Connection error. Please check your internet.';
      } else if (e.code === 'auth/invalid-credential') {
        errorMessage = 'Incorrect credentials. Check your password or email/phone.';
      } else if (e.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      }
      toast({ variant: 'destructive', title: 'Authentication Failed', description: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleForgotPassword = async () => {
    if (!forgotEmail.includes('@')) {
      toast({ variant: 'destructive', title: 'Use Email', description: 'Enter your registered email address.' });
      return;
    }
    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      toast({ title: 'Email Sent ✉️', description: `Reset link sent to ${forgotEmail}.` });
      setShowForgot(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Reset Failed', description: error.message });
    } finally {
      setIsResetting(false);
    }
  };

  if (loading)
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#1B2B33]">
        <Loader2 className="h-10 w-10 animate-spin text-[#0078D4]" />
      </div>
    );

  // ── Forgot Password Screen ─────────────────────────────────────────
  if (showForgot) {
    return (
      <div className="min-h-screen bg-[#1B2B33] flex flex-col px-6 pt-14 pb-10">
        <button
          onClick={() => setShowForgot(false)}
          className="flex items-center gap-2 text-white/50 text-sm font-bold mb-10"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="space-y-2 mb-10">
          <h1 className="text-3xl font-black text-white">Forgot Password?</h1>
          <p className="text-white/50 text-sm font-medium">
            Enter your registered email and we'll send a reset link.
          </p>
        </div>

        <div className="bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 px-5 py-4 mb-5">
          <Mail className="h-5 w-5 text-white/40 flex-shrink-0" />
          <input
            type="email"
            placeholder="your@email.com"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            className="bg-transparent flex-1 text-white placeholder-white/30 text-base font-medium outline-none"
          />
        </div>

        <Button
          onClick={handleForgotPassword}
          disabled={isResetting}
          className="w-full h-16 rounded-2xl bg-[#0078D4] hover:bg-[#006CBE] text-white font-black text-lg shadow-xl shadow-[#0078D4]/30"
        >
          {isResetting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Reset Link'}
        </Button>
      </div>
    );
  }

  // ── Main Login / Register ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1B2B33] flex flex-col">

      {/* Hero branding section */}
      <div className="relative px-6 pt-16 pb-10 overflow-hidden flex-shrink-0">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-[#0078D4] opacity-[0.08] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-24 -left-16 w-56 h-56 bg-blue-400 opacity-[0.06] rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 mb-8 w-16 h-16 rounded-[1.25rem] bg-white/10 border border-white/10 flex items-center justify-center shadow-lg shadow-black/20">
          <img src="/pezeka_logo_transparent.png" alt="Pezeka" className="h-10 w-10 object-contain" />
        </div>

        <div className="relative z-10 space-y-2">
          <h1 className="text-4xl font-black text-white leading-tight">
            {isSignUp ? 'Join Pezeka\nCredit 🚀' : 'Welcome\nBack 👋'}
          </h1>
          <p className="text-white/50 text-sm font-medium">
            {isSignUp
              ? 'Create your member account to start applying for loans.'
              : 'Sign in to access your loan dashboard.'}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 bg-[#F8FAFB] rounded-t-[2.5rem] px-6 pt-8 pb-12 overflow-y-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onAuthSubmit)} className="space-y-4">

            {/* ── REGISTER FIELDS ── */}
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <div className="bg-white border border-muted rounded-2xl flex items-center gap-3 px-4 py-3.5">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <FormControl>
                            <input
                              placeholder="First name"
                              {...field}
                              value={field.value ?? ''}
                              className="flex-1 bg-transparent text-[#1B2B33] font-medium text-sm placeholder-muted-foreground outline-none min-w-0"
                            />
                          </FormControl>
                        </div>
                        <FormMessage className="text-xs px-1" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <div className="bg-white border border-muted rounded-2xl flex items-center gap-3 px-4 py-3.5">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <FormControl>
                            <input
                              placeholder="Last name"
                              {...field}
                              value={field.value ?? ''}
                              className="flex-1 bg-transparent text-[#1B2B33] font-medium text-sm placeholder-muted-foreground outline-none min-w-0"
                            />
                          </FormControl>
                        </div>
                        <FormMessage className="text-xs px-1" />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <div className="bg-white border border-muted rounded-2xl flex items-center gap-3 px-4 py-4">
                        <Phone className="h-4 w-4 text-[#0078D4] flex-shrink-0" />
                        <FormControl>
                          <input
                            placeholder="Phone number (07XX XXX XXX)"
                            type="tel"
                            {...field}
                            value={field.value ?? ''}
                            className="flex-1 bg-transparent text-[#1B2B33] font-medium text-sm placeholder-muted-foreground outline-none"
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-xs px-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="idNumber"
                  render={({ field }) => (
                    <FormItem>
                      <div className="bg-white border border-muted rounded-2xl flex items-center gap-3 px-4 py-4">
                        <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <FormControl>
                          <input
                            placeholder="National ID number"
                            {...field}
                            value={field.value ?? ''}
                            className="flex-1 bg-transparent text-[#1B2B33] font-medium text-sm placeholder-muted-foreground outline-none"
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-xs px-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <div className="bg-white border border-muted rounded-2xl flex items-center gap-3 px-4 py-4">
                        <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <FormControl>
                          <input
                            placeholder="Email address"
                            type="email"
                            {...field}
                            value={field.value ?? ''}
                            className="flex-1 bg-transparent text-[#1B2B33] font-medium text-sm placeholder-muted-foreground outline-none"
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-xs px-1" />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* ── LOGIN IDENTIFIER ── */}
            {!isSignUp && (
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <div className="bg-white border border-muted rounded-2xl flex items-center gap-3 px-4 py-4">
                      <Phone className="h-4 w-4 text-[#0078D4] flex-shrink-0" />
                      <FormControl>
                        <input
                          placeholder="Phone number or email"
                          {...field}
                          value={field.value ?? ''}
                          className="flex-1 bg-transparent text-[#1B2B33] font-semibold text-base placeholder-muted-foreground outline-none"
                        />
                      </FormControl>
                    </div>
                    <FormMessage className="text-xs px-1" />
                  </FormItem>
                )}
              />
            )}

            {/* ── PASSWORD ── */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="bg-white border border-muted rounded-2xl flex items-center gap-3 px-4 py-4">
                    <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <FormControl>
                      <input
                        placeholder="Password"
                        type={showPassword ? 'text' : 'password'}
                        {...field}
                        value={field.value ?? ''}
                        className="flex-1 bg-transparent text-[#1B2B33] font-semibold text-base placeholder-muted-foreground outline-none"
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-muted-foreground flex-shrink-0"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FormMessage className="text-xs px-1" />
                </FormItem>
              )}
            />

            {/* Forgot password link */}
            {!isSignUp && (
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs font-bold text-[#0078D4]"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 rounded-2xl bg-[#1B2B33] hover:bg-[#0d1f27] text-white font-black text-lg shadow-xl shadow-[#1B2B33]/20 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </Button>

            {/* Toggle mode */}
            <div className="text-center pt-2">
              <span className="text-sm text-muted-foreground font-medium">
                {isSignUp ? 'Already a member?' : 'New to Pezeka?'}
              </span>{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  form.reset();
                }}
                className="text-sm font-black text-[#0078D4]"
              >
                {isSignUp ? 'Sign in here' : 'Register here'}
              </button>
            </div>

          </form>
        </Form>

        {/* Data protection notice */}
        <div className="flex items-start gap-2.5 bg-white border border-muted rounded-2xl px-4 py-3 mt-6">
          <ShieldCheck className="h-4 w-4 text-[#0078D4] flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground font-medium leading-snug">
            <span className="font-black text-[#1B2B33]">Your data is protected.</span>{' '}
            All information is secured in compliance with the Kenya Data Protection Act, 2019.
          </p>
        </div>
      </div>
    </div>
  );
}
