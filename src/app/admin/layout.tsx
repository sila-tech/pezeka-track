'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppUser, useAuth } from '@/firebase';
import { Loader2, LogOut, LayoutDashboard, Users, Landmark, HandCoins, FileDown, Menu, FileText, ShieldCheck, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { cn } from '@/lib/utils';
import { PWAInstallButton } from '@/components/PWAInstallButton';


const NavLinks = ({ isFinance, isSuperAdmin, isStaff, onLinkClick }: { isFinance: boolean, isSuperAdmin: boolean, isStaff: boolean, onLinkClick?: () => void }) => {
    const pathname = usePathname();
    
    const linkClass = (path: string) => cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
        pathname === path ? "bg-muted text-primary" : "text-muted-foreground"
    );

    // Finance can now access everything Super Admin can
    const isAdmin = isSuperAdmin || isFinance;

    return (
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            <Link href="/admin" className={linkClass("/admin")} onClick={onLinkClick}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
            </Link>
            
            <Link href="/admin/customers" className={linkClass("/admin/customers")} onClick={onLinkClick}>
                <Users className="h-4 w-4" />
                Customers
            </Link>

            <Link href="/admin/loans" className={linkClass("/admin/loans")} onClick={onLinkClick}>
                <HandCoins className="h-4 w-4" />
                Loans
            </Link>
            
            {isAdmin && (
                <Link href="/admin/finance" className={linkClass("/admin/finance")} onClick={onLinkClick}>
                    <FileDown className="h-4 w-4" />
                    Finance
                </Link>
            )}

            {(isStaff || isAdmin) && (
                <Link href="/admin/application-forms" className={linkClass("/admin/application-forms")} onClick={onLinkClick}>
                    <FileText className="h-4 w-4" />
                    Application Forms
                </Link>
            )}

            {isAdmin && (
                <Link href="/admin/investors" className={linkClass("/admin/investors")} onClick={onLinkClick}>
                    <Briefcase className="h-4 w-4" />
                    Investors
                </Link>
            )}

            {isAdmin && (
                <Link href="/admin/users" className={linkClass("/admin/users")} onClick={onLinkClick}>
                    <ShieldCheck className="h-4 w-4" />
                    User Management
                </Link>
            )}
        </nav>
    );
};


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    const { user, loading } = useAppUser();
    const router = useRouter();
    const pathname = usePathname();
    const auth = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const isLoginPage = pathname === '/admin/login';
    
    const userRole = user?.role?.toLowerCase();
    const isSuperAdmin = user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
    const isFinance = userRole === 'finance';
    const isStaff = userRole === 'staff';
    const isAuthorized = user && (isSuperAdmin || isFinance || isStaff);

    useEffect(() => {
        if (!loading && !isAuthorized && !isLoginPage) {
            router.push('/admin/login');
        }
    }, [user, loading, isAuthorized, isLoginPage, router]);
    
    if (isLoginPage) return <>{children}</>;
    
    if (loading || !isAuthorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/admin/login');
    }

    return (
        <div className="grid h-screen w-full overflow-hidden md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-card md:block overflow-y-auto">
            <div className="flex h-full flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/admin" className="flex items-center gap-2 font-semibold">
                < Landmark className="h-6 w-6 text-primary" />
                <span>Pezeka Credit</span>
                </Link>
            </div>
            <div className="flex-1 py-2">
                <NavLinks isFinance={isFinance} isSuperAdmin={isSuperAdmin} isStaff={isStaff} />
            </div>
            <div className="mt-auto p-4 flex flex-col gap-2 border-t">
                <PWAInstallButton className="w-full justify-start" variant="ghost" />
                <Button onClick={handleLogout} variant="ghost" className="w-full justify-start">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
            </div>
        </div>
        <div className="flex flex-col overflow-hidden">
            <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 shrink-0">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0">
                 <SheetHeader className="sr-only">
                    <SheetTitle>Pezeka Navigation</SheetTitle>
                    <SheetDescription>Access management modules.</SheetDescription>
                 </SheetHeader>
                 <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                  <Link href="/admin" className="flex items-center gap-2 font-semibold" onClick={() => setMobileMenuOpen(false)}>
                    <Landmark className="h-6 w-6 text-primary" />
                    <span>Pezeka Credit</span>
                  </Link>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                    <NavLinks isFinance={isFinance} isSuperAdmin={isSuperAdmin} isStaff={isStaff} onLinkClick={() => setMobileMenuOpen(false)} />
                </div>
                 <div className="mt-auto p-4 border-t flex flex-col gap-2">
                  <PWAInstallButton className="w-full justify-start" variant="ghost" />
                  <Button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} variant="ghost" className="w-full justify-start">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            
            <div className="ml-auto flex items-center gap-2">
                <NotificationBell />
            </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-background">
                <div className="mx-auto max-w-[1600px] w-full">
                    {children}
                </div>
            </main>
        </div>
        </div>
    );
}
