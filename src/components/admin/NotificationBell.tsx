'use client';

import { useMemo } from 'react';
import { useCollection } from '@/firebase';
import { Bell, HandCoins, UserPlus, Briefcase, Landmark } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import Link from 'next/link';

interface Loan {
  id: string;
  customerName: string;
  principalAmount: number;
  status: string;
  disbursementDate: { seconds: number; nanoseconds: number } | any;
}

interface Customer {
    id: string;
    name: string;
    createdAt: { seconds: number; nanoseconds: number } | any;
}

interface InvestmentApplication {
    uid: string;
    name: string;
    amount: number;
    status: string;
    createdAt: { seconds: number; nanoseconds: number } | any;
}

interface Investor {
    uid: string;
    name: string;
    deposits: { depositId: string; amount: number; status: string; date: any }[];
}

export function NotificationBell() {
  const { data: loans, loading: loansLoading } = useCollection<Loan>('loans');
  const { data: customers, loading: customersLoading } = useCollection<Customer>('customers');
  const { data: invApps, loading: invAppsLoading } = useCollection<InvestmentApplication>('investmentApplications');
  const { data: investors, loading: investorsLoading } = useCollection<Investor>('investors');

  const getTimestamp = (date: any) => {
    if (!date) return 0;
    if (typeof date.seconds === 'number') return date.seconds;
    if (date instanceof Date) return Math.floor(date.getTime() / 1000);
    if (typeof date === 'string') {
        const d = new Date(date);
        return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
    }
    return 0;
  };

  const notifications = useMemo(() => {
    const list: any[] = [];

    if (loans) {
        loans.filter(l => l.status === 'application').forEach(l => {
            list.push({
                id: `loan-${l.id}`,
                type: 'loan',
                title: 'New Loan Application',
                description: `${l.customerName || 'Customer'} requested Ksh ${(l.principalAmount || 0).toLocaleString()}`,
                date: l.disbursementDate,
                href: '/admin/loans',
                icon: <HandCoins className="h-3 w-3 text-blue-600" />,
                bg: 'bg-blue-100'
            });
        });
    }

    if (customers) {
        customers.forEach(c => {
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const ts = getTimestamp(c.createdAt);
            if (ts > 0 && ts * 1000 > sevenDaysAgo) {
                list.push({
                    id: `cust-${c.id}`,
                    type: 'customer',
                    title: 'New Customer Joined',
                    description: `${c.name || 'Anonymous'} just created an account`,
                    date: c.createdAt,
                    href: '/admin/customers',
                    icon: <UserPlus className="h-3 w-3 text-green-600" />,
                    bg: 'bg-green-100'
                });
            }
        });
    }

    if (invApps) {
        invApps.filter(a => a.status === 'pending').forEach(a => {
            list.push({
                id: `invapp-${a.uid}`,
                type: 'investment_app',
                title: 'New Investment App',
                description: `${a.name || 'User'} applied to invest Ksh ${(a.amount || 0).toLocaleString()}`,
                date: a.createdAt,
                href: '/admin/investors',
                icon: <Briefcase className="h-3 w-3 text-purple-600" />,
                bg: 'bg-purple-100'
            });
        });
    }

    if (investors) {
        investors.forEach(inv => {
            const pendingDeposits = inv.deposits?.filter(d => d.status === 'pending') || [];
            pendingDeposits.forEach(d => {
                list.push({
                    id: `deposit-${d.depositId}`,
                    type: 'deposit',
                    title: 'Investment Deposit',
                    description: `${inv.name || 'Investor'} notified deposit of Ksh ${(d.amount || 0).toLocaleString()}`,
                    date: d.date,
                    href: '/admin/investors',
                    icon: <Landmark className="h-3 w-3 text-amber-600" />,
                    bg: 'bg-amber-100'
                });
            });
        });
    }

    return list.sort((a, b) => getTimestamp(b.date) - getTimestamp(a.date));
  }, [loans, customers, invApps, investors]);

  const count = notifications.length;
  const loading = loansLoading || customersLoading || invAppsLoading || investorsLoading;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]"
            >
              {count > 9 ? '9+' : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-4">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {count > 0 && <Badge variant="secondary">{count} New</Badge>}
        </div>
        <ScrollArea className="h-[350px]">
          {loading ? (
            <div className="flex h-20 items-center justify-center italic text-muted-foreground text-sm">
              Loading...
            </div>
          ) : count === 0 ? (
            <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
              No new notifications
            </div>
          ) : (
            <div className="grid">
              {notifications.map((notif) => {
                const ts = getTimestamp(notif.date);
                return (
                  <Link
                    key={notif.id}
                    href={notif.href}
                    className="flex flex-col gap-1 border-b p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`rounded-full p-1.5 ${notif.bg}`}>
                        {notif.icon}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-tight">{notif.title}</span>
                    </div>
                    <p className="text-sm">
                      {notif.description}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {ts > 0 ? format(new Date(ts * 1000), 'PPP p') : 'N/A'}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2 text-center">
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link href="/admin/loans">Manage Everything</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}