'use client';
import { useInvestor, useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, LogOut } from 'lucide-react';

export default function InvestorDashboardPage() {
  const { investor } = useInvestor();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/investor-login');
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
            <Landmark className="h-6 w-6 text-primary" />
            <span>Investor Portal</span>
        </div>
        <div className="ml-auto">
            <Button onClick={handleLogout} variant="outline">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
            </Button>
        </div>
      </header>
      <main className="p-4 sm:px-6 sm:py-0">
          <Card>
            <CardHeader>
                <CardTitle>Welcome, {investor?.name || investor?.email}!</CardTitle>
                <CardDescription>
                    This is your investment dashboard. More features are coming soon.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-8">
                    <p className="text-muted-foreground">Your investment details will appear here.</p>
                </div>
            </CardContent>
          </Card>
      </main>
    </>
  );
}
