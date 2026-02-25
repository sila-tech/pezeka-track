'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInvestorUser } from '@/firebase';
import { Loader2, LogOut, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import Link from 'next/link';

export default function InvestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useInvestorUser();
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/investor-login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/investor-login');
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <div className="flex items-center gap-2 font-semibold">
                <Landmark className="h-6 w-6 text-primary" />
                <span>Investor Dashboard</span>
            </div>
            <div className="ml-auto flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden sm:inline-block">Welcome, {user.name || user.email}</span>
                <Button onClick={handleLogout} variant="outline">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </header>
        <main className="flex-1 p-4 sm:px-6 sm:py-6">
            {children}
        </main>
    </div>
  );
}
