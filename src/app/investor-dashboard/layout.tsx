'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { Loader2, Landmark, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import Link from 'next/link';

export default function InvestorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/investor-login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
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
            <Link href="/" className="flex items-center gap-2 font-semibold">
                <Landmark className="h-6 w-6 text-primary" />
                <span>Pezeka Credit</span>
            </Link>
            <div className="ml-auto">
                <Button onClick={handleLogout} variant="outline">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </header>
      {children}
    </div>
  );
}
