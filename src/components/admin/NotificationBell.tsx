'use client';

import { useMemo } from 'react';
import { useCollection } from '@/firebase';
import { Bell, HandCoins, UserPlus } from 'lucide-react';
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
  disbursementDate: { seconds: number; nanoseconds: number };
}

interface Customer {
    id: string;
    name: string;
    createdAt: { seconds: number; nanoseconds: number };
}

export function NotificationBell() {
  const { data: loans, loading: loansLoading } = useCollection<Loan>('loans');
  const { data: customers, loading: customersLoading } = useCollection<Customer>('customers');

  const notifications = useMemo(() => {
    const list: any[] = [];

    if (loans) {
        loans.filter(l => l.status === 'application').forEach(l => {
            list.push({
                id: `loan-${l.id}`,
                type: 'loan',
                title: 'New Loan Application',
                description: `${l.customerName} requested Ksh ${l.principalAmount.toLocaleString()}`,
                date: l.disbursementDate,
                href: '/admin/loans',
                icon: <HandCoins className="h-3 w-3 text-blue-600" />,
                bg: 'bg-blue-100'
            });
        });
    }

    if (customers) {
        customers.forEach(c => {
            // Only show customers created in the last 7 days as "new" notifications
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            if (c.createdAt && c.createdAt.seconds * 1000 > sevenDaysAgo) {
                list.push({
                    id: `cust-${c.id}`,
                    type: 'customer',
                    title: 'New Customer Joined',
                    description: `${c.name} just created an account`,
                    date: c.createdAt,
                    href: '/admin/customers',
                    icon: <UserPlus className="h-3 w-3 text-green-600" />,
                    bg: 'bg-green-100'
                });
            }
        });
    }

    return list.sort((a, b) => b.date.seconds - a.date.seconds);
  }, [loans, customers]);

  const count = notifications.length;
  const loading = loansLoading || customersLoading;

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
              {notifications.map((notif) => (
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
                    {format(new Date(notif.date.seconds * 1000), 'PPP p')}
                  </span>
                </Link>
              ))}
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
