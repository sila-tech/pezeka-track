
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser, useAuth } from '@/firebase';
import { Loader2, Users, LogOut, LayoutDashboard, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import Link from 'next/link';

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAppUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/customer-login');
    }
    // Only Agents can access this portal
    if (!loading && user && user.role !== 'agent') {
        router.push('/account');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[#5BA9D0]" />
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F8FAFB]">
      <header className="px-6 h-16 flex items-center bg-white border-b border-muted sticky top-0 z-50">
        <Link href="/agent" className="flex items-center gap-2">
            <img src="/pezeka_logo_transparent.png" className="h-8 w-8" alt="Pezeka" />
            <span className="font-black text-lg text-[#1B2B33]">Agent Portal</span>
        </Link>
        <div className="ml-auto flex items-center gap-4">
            <span className="text-xs font-bold text-muted-foreground hidden sm:block">Hello, {user.name}</span>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
            </Button>
        </div>
      </header>
      <main className="flex-1 p-6 md:p-8">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
      </main>
    </div>
  );
}
