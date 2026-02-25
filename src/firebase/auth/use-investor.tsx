'use client';
import React from 'react';
import { useUser } from './use-user';
import { useDoc } from '../firestore/use-doc';
import { User } from 'firebase/auth';

interface InvestorProfileData {
  role?: 'investor';
  name?: string;
  uid?: string;
  email?: string;
}

export interface Investor extends User, InvestorProfileData {}

interface UseInvestor {
    investor: Investor | null;
    loading: boolean;
}

export const useInvestor = (): UseInvestor => {
    const { user, loading: userLoading } = useUser();
    // Fetch the investor profile from Firestore using the user's UID.
    const { data: profile, loading: profileLoading } = useDoc<InvestorProfileData>(user ? `investors/${user.uid}` : null);

    const investorUser = React.useMemo(() => {
        // Only proceed if we have an authenticated user AND a matching investor profile.
        if (user && profile) {
            return { ...user, ...profile };
        }
        return null; // Return null if there's no profile, effectively logging them out of the investor section.
    }, [user, profile]);
    
    return { investor: investorUser as Investor | null, loading: userLoading || profileLoading };
}
