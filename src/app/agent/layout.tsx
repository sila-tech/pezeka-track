'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppUser, useAuth } from '@/firebase';
import { Loader2, LogOut, ShieldAlert, User, LayoutDashboard, Share2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAppUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoginPage = pathname === '/agent/login';

  useEffect(() => {
    if (mounted && !loading && !isLoginPage) {
      if (!user) {
        router.push('/agent/login');
      } else if (user.role !== 'agent') {
        router.push('/account');
      }
    }
  }, [user, loading, router, isLoginPage, mounted]);

  // Prevent flash or errors during initial hydration
  if (!mounted) return null;

  // Allow the login page to render its own nested layout/content
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#5BA9D0]" />
      </div>
    );
  }

  // Not logged in (handled by useEffect redirect, but safety check)
  if (!user) return null;

  // Approval Check for Agents
  if (user.role === 'agent' && user.status !== 'approved') {
      return (
          <div className="min-h-screen flex flex-col bg-[#F8FAFB]">
              <header className="px-6 h-16 flex items-center bg-white border-b border-muted">
                <Link href="/" className="flex items-center gap-2">
                    <img src="/pezeka_logo_transparent.png" className="h-8 w-8" alt="Pezeka" />
                    <span className="font-black text-lg text-[#1B2B33]">Agent Portal</span>
                </Link>
                <div className="ml-auto">
                    <Button onClick={() => signOut(auth)} variant="ghost" size="sm" className="text-destructive">
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                    </Button>
                </div>
              </header>
              <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="max-w-md space-y-6">
                      <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                          <ShieldAlert className="h-12 w-12 text-orange-600" />
                      </div>
                      <div className="space-y-2">
                          <h1 className="text-2xl font-black text-[#1B2B33]">Awaiting Approval</h1>
                          <p className="text-muted-foreground">Your agent account is currently under review. Our team will verify your details and activate your referral link shortly.</p>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-muted shadow-sm">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                          <p className="text-lg font-black text-orange-600 uppercase">PENDING REVIEW</p>
                      </div>
                      <Button variant="outline" onClick={() => router.push('/')} className="w-full h-12 rounded-xl">
                          Return to Home
                      </Button>
                  </div>
              </main>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F8FAFB]">
      <header className="px-6 h-16 flex items-center bg-white border-b border-muted sticky top-0 z-50">
        <Link href="/agent" className="flex items-center gap-2">
            <img src="/pezeka_logo_transparent.png" className="h-8 w-8" alt="Pezeka" />
            <span className="font-black text-lg text-[#1B2B33] hidden sm:inline">Agent Portal</span>
        </Link>
        <nav className="ml-8 hidden md:flex items-center gap-6">
            <Link href="/agent" className={cn("text-sm font-bold transition-colors", pathname === '/agent' ? "text-[#5BA9D0]" : "text-[#1B2B33]/60 hover:text-[#5BA9D0]")}>
                Dashboard
            </Link>
        </nav>
        <div className="ml-auto flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-[#1B2B33] uppercase">Approved Agent</span>
            </div>
            <Button onClick={() => signOut(auth)} variant="ghost" size="sm" className="text-destructive font-bold hover:bg-destructive/5">
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
