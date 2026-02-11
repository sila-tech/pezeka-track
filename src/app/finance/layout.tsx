"use client";
import { Logo } from "@/components/logo";
import { PageHeader } from "@/components/page-header";
import { 
  SidebarProvider, 
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { useUser, useFirestore, useDoc, setDocumentNonBlocking, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { LayoutDashboard, ArrowDownToDot, ArrowUpFromDot, CircleDollarSign } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function FinanceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/finance/login');
    }
    // Also redirect if the user is not a finance user
    if (!isUserLoading && user && !user.email?.endsWith('@finance.com')) {
      router.push('/staff/login');
    }
  }, [user, isUserLoading, router]);

  // This logic remains to create a user profile document, which can be useful for storing user-specific data,
  // but it's no longer used for authorization in this layout.
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, "users", user.uid) : null, [firestore, user]);
  const { data: userDoc, isLoading: isUserDocLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (user && !isUserDocLoading && !userDoc && user.email) {
      // User is logged in, but no user document exists. Let's create one.
      const newUserDoc = {
        id: user.uid,
        username: user.email,
        email: user.email,
        role: 'admin', // All finance users are admins
        firstName: user.email.split('@')[0] || 'New',
        lastName: 'User',
      };
      
      const userDocToCreateRef = doc(firestore, "users", user.uid);
      setDocumentNonBlocking(userDocToCreateRef, newUserDoc, { merge: false });
    }
  }, [user, userDoc, isUserDocLoading, firestore]);
  
  // The loading screen now only needs to wait for the auth state.
  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Client-side check for a better UX. The real security is in the Firestore rules.
  if (!user.email?.endsWith('@finance.com')) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Access Denied. Redirecting...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" side="left" collapsible="icon">
        <SidebarHeader>
          <Logo href="/finance" />
        </SidebarHeader>
        <SidebarContent>
            <SidebarMenu>
                <SidebarMenuItem>
                <SidebarMenuButton asChild>
                    <Link href="/finance">
                    <LayoutDashboard />
                    Dashboard
                    </Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator />
            <SidebarGroup>
                <SidebarGroupLabel>Daily Records</SidebarGroupLabel>
                <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="/finance/receipts">
                            <ArrowDownToDot />
                            Receipts
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="/finance/payouts">
                            <ArrowUpFromDot />
                            Payouts
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="/finance/expenses">
                            <CircleDollarSign />
                            Expenses
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <PageHeader loginPath="/finance/login" />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
