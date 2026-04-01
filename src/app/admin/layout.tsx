'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppUser, useAuth } from '@/firebase';
import { Loader2, LogOut, LayoutDashboard, Users, HandCoins, FileDown, Menu, FileText, ShieldCheck, Briefcase, Mail, Share2, FolderKey } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { AINotificationBell } from '@/components/admin/AINotificationBell';
import { cn } from '@/lib/utils';

const NavLinks = ({ user, onLinkClick }: { user: any, onLinkClick?: () => void }) => {
    const pathname = usePathname();
    const userRole = user?.role?.toLowerCase()?.trim();
    const isSuperAdmin = user?.email?.toLowerCase()?.trim() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
    const isFinance = userRole === 'finance';
    const canSeeSensitive = isSuperAdmin || isFinance;

    const linkClass = (path: string) => cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
        pathname === path ? "bg-primary/10 text-primary font-bold shadow-sm" : "text-muted-foreground"
    );

    return (
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4 gap-1">
            <Link href="/admin" className={linkClass("/admin")} onClick={onLinkClick}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
            </Link>
            
            <Link href="/admin/customers" className={linkClass("/admin/customers")} onClick={onLinkClick}>
                <Users className="h-4 w-4" />
                Customers
            </Link>

            <Link href="/admin/referrals" className={linkClass("/admin/referrals")} onClick={onLinkClick}>
                <Share2 className="h-4 w-4" />
                Referrals
            </Link>

            <Link href="/admin/loans" className={linkClass("/admin/loans")} onClick={onLinkClick}>
                <HandCoins className="h-4 w-4" />
                Loans
            </Link>

            <Link href="/admin/application-forms" className={linkClass("/admin/application-forms")} onClick={onLinkClick}>
                <FileText className="h-4 w-4" />
                Application Forms
            </Link>

            {/* KYC Repository is now visible to all authorized administrators */}
            <Link href="/admin/kyc" className={linkClass("/admin/kyc")} onClick={onLinkClick}>
                <FolderKey className="h-4 w-4" />
                KYC Repository
            </Link>

            {canSeeSensitive && (
                <>
                    <Link href="/admin/finance" className={linkClass("/admin/finance")} onClick={onLinkClick}>
                        <FileDown className="h-4 w-4" />
                        Finance
                    </Link>

                    <Link href="/admin/mail" className={linkClass("/admin/mail")} onClick={onLinkClick}>
                        <Mail className="h-4 w-4" />
                        Mail
                    </Link>

                    <Link href="/admin/investors" className={linkClass("/admin/investors")} onClick={onLinkClick}>
                        <Briefcase className="h-4 w-4" />
                        Investors
                    </Link>

                    <Link href="/admin/users" className={linkClass("/admin/users")} onClick={onLinkClick}>
                        <ShieldCheck className="h-4 w-4" />
                        User Management
                    </Link>
                </>
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
    const userRole = user?.role?.toLowerCase()?.trim();
    const isSuperAdmin = user?.email?.toLowerCase()?.trim() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
    const isFinance = userRole === 'finance';
    const isStaff = userRole === 'staff';
    const isAuthorized = user && (isSuperAdmin || isFinance || isStaff);

    useEffect(() => {
        if (!loading && !isAuthorized && !isLoginPage) {
            router.replace('/admin/login');
        }
    }, [user, loading, isAuthorized, isLoginPage, router]);
    
    if (isLoginPage) return <>{children}</>;
    
    if (loading || !isAuthorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const handleLogout = async () => {
        await signOut(auth);
        router.replace('/admin/login');
    }

    return (
        <div className="grid h-screen w-full overflow-hidden md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-card md:block overflow-y-auto">
            <div className="flex h-full flex-col gap-2">
            <div className="flex h-16 items-center border-b px-4 lg:h-[64px] lg:px-6">
                <Link href="/admin" className="flex items-center gap-2 font-bold text-primary">
                    <img src="/pezeka_logo_transparent.png" alt="Pezeka" className="h-8 w-8 object-contain" />
                    <span className="tracking-tight">Pezeka Admin</span>
                </Link>
            </div>
            <div className="flex-1 py-4">
                <NavLinks user={user} />
            </div>
            <div className="mt-auto p-4 flex flex-col gap-2 border-t">
                <div className="px-2 py-2 mb-2 bg-muted/50 rounded-lg">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground px-1 mb-1">Logged in as</p>
                    <p className="text-xs font-bold truncate px-1 text-primary">{user?.name || user?.email}</p>
                    <p className="text-[10px] text-muted-foreground px-1 uppercase">{user?.role || 'Admin'}</p>
                </div>
                <Button onClick={handleLogout} variant="ghost" className="w-full justify-start h-9 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
            </div>
        </div>
        <div className="flex flex-col overflow-hidden">
            <header className="flex h-16 items-center gap-4 border-b bg-card px-4 lg:h-[64px] lg:px-6 shrink-0">
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
                 <div className="flex h-16 items-center border-b px-4 lg:h-[64px] lg:px-6">
                  <Link href="/admin" className="flex items-center gap-2 font-bold text-primary" onClick={() => setMobileMenuOpen(false)}>
                    <img src="/pezeka_logo_transparent.png" alt="Logo" className="h-8 w-8 object-contain" />
                    <span>Pezeka Credit</span>
                  </Link>
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                    <NavLinks user={user} onLinkClick={() => setMobileMenuOpen(false)} />
                </div>
                 <div className="mt-auto p-4 border-t flex flex-col gap-2 bg-muted/20">
                  <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <div className="ml-auto flex items-center gap-4">
                <AINotificationBell />
                <NotificationBell />
            </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-background">
                <div className="mx-auto max-w-[1600px] w-full">{children}</div>
            </main>
        </div>
        </div>
    );
}