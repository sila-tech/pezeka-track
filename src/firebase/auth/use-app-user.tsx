'use client';
import React from 'react';
import { useUser } from './use-user';
import { useDoc } from '../firestore/use-doc';
import { User } from 'firebase/auth';

interface UserProfileData {
  role?: 'staff' | 'finance';
  status?: 'pending' | 'approved' | 'rejected';
  name?: string;
  uid?: string;
  email?: string;
}

export interface AppUser extends UserProfileData {
    uid: string;
    email: string | null;
    displayName: string | null;
    emailVerified: boolean;
}

interface UseAppUser {
    user: AppUser | null;
    loading: boolean;
}

export const useAppUser = (): UseAppUser => {
    const { user, loading: authLoading } = useUser();
    const { data: profile, loading: profileLoading } = useDoc<UserProfileData>(user ? `users/${user.uid}` : null);

    const isLoading = authLoading || (!!user && profileLoading);

    const mergedUser = React.useMemo(() => {
        if (!user || isLoading) return null;
        
        // Safely extract primitive properties from the Firebase User object
        const baseUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
        };

        if (profile) {
            return { ...baseUser, ...profile };
        }
        return baseUser;
    }, [user, profile, isLoading]);
    
    return { user: mergedUser as AppUser | null, loading: isLoading };
}
