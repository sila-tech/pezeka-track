'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { Loader2, LogOut, LayoutDashboard, Users, Landmark, HandCoins, FileDown, Menu, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';


const NavLinks = ({ isFinance, onLinkClick }: { isFinance: boolean, onLinkClick?: () => void }) => (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
    <Link
        href="/dashboard"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        onClick={onLinkClick}
    >
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
    </Link>
    <Link
        href="/dashboard/customers"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        onClick={onLinkClick}
    >
        <Users className="h-4 w-4" />
        Customers
    </Link>
    <Link
        href="/dashboard/loans"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        onClick={onLinkClick}
    >
        <HandCoins className="h-4 w-4" />
        Loans
    </Link>
    {isFinance && (
        <Link
            href="/dashboard/finance"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            onClick={onLinkClick}
        >
            <FileDown className="h-4 w-4" />
            Finance
        </Link>
    )}
     <Link
        href="/dashboard/application-forms"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        onClick={onLinkClick}
    >
        <FileText className="h-4 w-4" />
        Application Forms
    </Link>
    </nav>
);


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    const { user, loading } = useUser();
    const router = useRouter();
    const auth = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (loading) return;

        if (!user) {
            router.push('/login');
            return;
        }

        const isAuthorized = user.email === 'simon@pezeka.com' || 
                             user.email?.endsWith('@finance.pezeka.com') ||
                             user.email?.endsWith('@staff.pezeka.com');

        if (!isAuthorized) {
            signOut(auth).then(() => {
                router.push('/login');
            });
        }
    }, [user, loading, router, auth]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    }

    if (loading || !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const isFinance = user.email === 'simon@pezeka.com' || user.email?.endsWith('@finance.pezeka.com');

    return (
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-card md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                <Landmark className="h-6 w-6 text-primary" />
                <span>Pezeka Credit</span>
                </Link>
            </div>
            <div className="flex-1">
                <NavLinks isFinance={isFinance} />
            </div>
            <div className="mt-auto p-4">
                <Button onClick={handleLogout} variant="ghost" className="w-full justify-start">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
            </div>
        </div>
        <div className="flex flex-col">
            <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0">
                 <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                  <Link href="/dashboard" className="flex items-center gap-2 font-semibold" onClick={() => setMobileMenuOpen(false)}>
                    <Landmark className="h-6 w-6 text-primary" />
                    <span>Pezeka Credit</span>
                  </Link>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                    <NavLinks isFinance={isFinance} onLinkClick={() => setMobileMenuOpen(false)} />
                </div>
                 <div className="mt-auto p-4 border-t">
                  <Button onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }} variant="ghost" className="w-full justify-start">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            
            <div className="w-full flex-1">
                {/* Header content like a search bar can go here */}
            </div>
            </header>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
            {children}
            </main>
        </div>
        </div>
    );
}
