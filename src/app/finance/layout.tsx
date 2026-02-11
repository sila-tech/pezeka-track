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
import { LayoutDashboard, ArrowDownToDot, ArrowUpFromDot, CircleDollarSign, Users, HandCoins } from "lucide-react";
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
  }, [user, isUserLoading, router]);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, "users", user.uid) : null, [firestore, user]);
  const { data: userDoc, isLoading: isUserDocLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (user && !isUserDocLoading && !userDoc && user.email) {
      // User is logged in, but no user document exists. Let's create one for Simon.
      const newUserDoc = {
        id: user.uid,
        username: user.email,
        email: user.email,
        role: 'admin',
        firstName: 'Simon',
        lastName: 'Admin',
      };
      
      const userDocToCreateRef = doc(firestore, "users", user.uid);
      setDocumentNonBlocking(userDocToCreateRef, newUserDoc, { merge: false });
    }
  }, [user, userDoc, isUserDocLoading, firestore]);
  
  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
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
                <SidebarGroupLabel>Management</SidebarGroupLabel>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href="/finance/customers">
                                <Users />
                                Customers
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href="/finance/loans">
                                <HandCoins />
                                Loans
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
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
