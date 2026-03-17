'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser } from '@/firebase';
import { Loader2 } from 'lucide-react';

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
        if (!user) {
            router.replace('/customer-login');
        } else if (user.role === 'agent') {
            router.replace('/agent');
        }
    }
  }, [user, loading, router]);

  if (loading || !user || user.role === 'agent') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <div className="flex min-h-screen w-full flex-col bg-muted/40">{children}</div>;
}
