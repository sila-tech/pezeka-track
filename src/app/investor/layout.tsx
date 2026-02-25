'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInvestor } from '@/firebase';
import { Loader2 } from 'lucide-react';

export default function InvestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { investor, loading } = useInvestor();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !investor) {
      router.push('/investor-login');
    }
  }, [investor, loading, router]);

  if (loading || !investor) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <div className="flex min-h-screen w-full flex-col bg-muted/40">{children}</div>;
}
