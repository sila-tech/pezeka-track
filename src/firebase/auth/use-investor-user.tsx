'use client';
import React from 'react';
import { useUser } from './use-user';
import { useDoc } from '../firestore/use-doc';
import { User } from 'firebase/auth';

// Define a more specific type for your investor profile from Firestore
interface InvestorProfileData {
  name?: string;
  initialInvestment?: number;
  currentBalance?: number;
  interestEntries?: any[];
}

// This will be the type of the user object returned by the hook
export interface InvestorUser extends User, InvestorProfileData {}

interface UseInvestorUser {
    user: InvestorUser | null;
    loading: boolean;
}

export const useInvestorUser = (): UseInvestorUser => {
    const { user, loading: userLoading } = useUser();
    // Fetch the profile document from the 'investors' collection using the user's UID
    const { data: profile, loading: profileLoading } = useDoc<InvestorProfileData>(user ? `investors/${user.uid}` : null);

    // Memoize the merged user object to prevent re-renders
    const mergedUser = React.useMemo(() => {
        if (user && profile) {
            return { ...user, ...profile };
        }
        if (user) { // Return the auth user even if profile is loading
            return user;
        }
        return null;
    }, [user, profile]);
    
    return { user: mergedUser as InvestorUser | null, loading: userLoading || profileLoading };
}
