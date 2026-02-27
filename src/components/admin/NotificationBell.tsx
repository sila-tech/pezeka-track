'use client';

import { useMemo } from 'react';
import { useCollection } from '@/firebase';
import { Bell, HandCoins } from 'lucide-react';
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

export function NotificationBell() {
  const { data: loans, loading } = useCollection<Loan>('loans');

  const pendingApplications = useMemo(() => {
    if (!loans) return [];
    return loans
      .filter((l) => l.status === 'application')
      .sort((a, b) => b.disbursementDate.seconds - a.disbursementDate.seconds);
  }, [loans]);

  const count = pendingApplications.length;

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
        <ScrollArea className="h-[300px]">
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
              {pendingApplications.map((loan) => (
                <Link
                  key={loan.id}
                  href="/admin/loans"
                  className="flex flex-col gap-1 border-b p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-blue-100 p-1.5">
                      <HandCoins className="h-3 w-3 text-blue-600" />
                    </div>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-tight">New Loan Application</span>
                  </div>
                  <p className="text-sm">
                    <strong>{loan.customerName}</strong> requested Ksh {loan.principalAmount.toLocaleString()}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(loan.disbursementDate.seconds * 1000), 'PPP p')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2 text-center">
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link href="/admin/loans">View All Loans</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
