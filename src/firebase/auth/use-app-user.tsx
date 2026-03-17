'use client';
import React from 'react';
import { useUser } from './use-user';
import { useDoc } from '../firestore/use-doc';
import { User } from 'firebase/auth';

// Define a more specific type for your user profile from Firestore
interface UserProfileData {
  role?: 'staff' | 'finance' | 'agent';
  status?: 'pending' | 'approved' | 'rejected';
  name?: string;
  uid?: string;
  email?: string;
  referralCode?: string;
}

// This will be the type of the user object returned by the hook
export interface AppUser extends User, UserProfileData {}

interface UseAppUser {
    user: AppUser | null;
    loading: boolean;
}

/**
 * Custom hook that merges Firebase Auth state with the user's Firestore profile.
 * Ensures the loading state persists until BOTH Auth and Profile data are resolved.
 */
export const useAppUser = (): UseAppUser => {
    const { user, loading: authLoading } = useUser();
    
    // Fetch the profile document from Firestore using the user's UID
    // We only attempt this if we have a valid Auth user
    const { data: profile, loading: profileLoading } = useDoc<UserProfileData>(user ? `users/${user.uid}` : null);

    // Consolidate the loading state. 
    // We are loading if Auth is still resolving, OR if we have a user but are still fetching their profile.
    const isLoading = authLoading || (!!user && profileLoading);

    // Memoize the merged user object
    const mergedUser = React.useMemo(() => {
        if (!user || isLoading) return null;
        
        // If profile exists, merge it. If not, it's likely a standard customer.
        if (profile) {
            return { ...user, ...profile };
        }
        
        return user;
    }, [user, profile, isLoading]);
    
    return { user: mergedUser as AppUser | null, loading: isLoading };
}
