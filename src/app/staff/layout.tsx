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
} from "@/components/ui/sidebar";
import { useUser, useFirestore, useDoc, setDocumentNonBlocking, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { LayoutDashboard, Users, HandCoins } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/staff/login');
    }
  }, [user, isUserLoading, router]);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, "users", user.uid) : null, [firestore, user]);
  const { data: userDoc, isLoading: isUserDocLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (user && !isUserDocLoading && !userDoc && user.email) {
      // User is logged in, but no user document exists. Let's create one.
      let role = 'staff'; // default role
      if (user.email.endsWith('@finance.com')) {
        role = 'admin';
      } else if (user.email.endsWith('@staff.com')) {
        role = 'staff';
      }

      const newUserDoc = {
        id: user.uid,
        username: user.email,
        email: user.email,
        role: role,
        firstName: user.email.split('@')[0] || 'New',
        lastName: 'User',
      };
      
      const userDocToCreateRef = doc(firestore, "users", user.uid);
      setDocumentNonBlocking(userDocToCreateRef, newUserDoc, { merge: false });
    }
  }, [user, userDoc, isUserDocLoading, firestore]);

  if (isUserLoading || !user || isUserDocLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!userDoc) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Creating user profile...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" side="left" collapsible="icon">
        <SidebarHeader>
          <Logo href="/staff/dashboard" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/staff/dashboard">
                  <LayoutDashboard />
                  Dashboard
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/staff/customers">
                  <Users />
                  Customers
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/staff/loans">
                  <HandCoins />
                  Loans
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <PageHeader loginPath="/staff/login" />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
