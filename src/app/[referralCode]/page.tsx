
'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * referral code route handler.
 * Captures codes like pezeka.com/CODE and redirects to sign-up.
 */
export default function ReferralRedirectPage() {
    const router = useRouter();
    const params = useParams();
    const code = params.referralCode as string;

    useEffect(() => {
        if (code && typeof window !== 'undefined') {
            // Store the referral code in session storage
            sessionStorage.setItem('referralCode', code);
            
            // Short delay for visual feedback then redirect to login/signup
            const timer = setTimeout(() => {
                router.replace('/customer-login');
            }, 1000);

            return () => clearTimeout(timer);
        } else {
            router.replace('/');
        }
    }, [code, router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFB] text-[#1B2B33] p-6 text-center">
            <div className="mb-8">
                <img src="/pezeka_logo_transparent.png" alt="Pezeka" className="h-20 w-20 mx-auto object-contain animate-pulse" />
            </div>
            <div className="space-y-4">
                <h1 className="text-2xl font-black">Validating Invite...</h1>
                <p className="text-muted-foreground max-w-xs mx-auto">Connecting you to Pezeka Credit via your friend's invitation.</p>
                <div className="flex justify-center pt-4">
                    <Loader2 className="h-10 w-10 text-[#5BA9D0] animate-spin" />
                </div>
            </div>
        </div>
    );
}
