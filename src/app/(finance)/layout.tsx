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
import { LayoutDashboard, ArrowDownToDot, ArrowUpFromDot, CircleDollarSign } from "lucide-react";
import Link from "next/link";

export default function FinanceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
