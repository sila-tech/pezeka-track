
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Component that listens for referral codes in the URL and saves them to session storage.
 * URL format: pezeka.com?ref=PZ-CODE
 */
export default function ReferralTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const referralCode = searchParams.get('ref');
    if (referralCode) {
      // Save the code so it's available during sign up even if they navigate away
      sessionStorage.setItem('pezeka_referral_code', referralCode);
      console.log(`[Referral System] Tracking code detected: ${referralCode}`);
    }
  }, [searchParams]);

  return null;
}
