'use client';
import React from 'react';
import { useUser } from './use-user';
import { useDoc } from '../firestore/use-doc';
import { User } from 'firebase/auth';

// Define a more specific type for your user profile from Firestore
interface UserProfileData {
  role?: 'staff' | 'finance';
  name?: string;
  uid?: string;
  email?: string;
}

// This will be the type of the user object returned by the hook
export interface AppUser extends User, UserProfileData {}

interface UseAppUser {
    user: AppUser | null;
    loading: boolean;
}

export const useAppUser = (): UseAppUser => {
    const { user, loading: userLoading } = useUser();
    // Fetch the profile document from Firestore using the user's UID
    const { data: profile, loading: profileLoading } = useDoc<UserProfileData>(user ? `users/${user.uid}` : null);

    // Memoize the merged user object to prevent re-renders
    const mergedUser = React.useMemo(() => {
        if (user && profile) {
            return { ...user, ...profile };
        }
        return user;
    }, [user, profile]);
    
    return { user: mergedUser as AppUser | null, loading: userLoading || profileLoading };
}
