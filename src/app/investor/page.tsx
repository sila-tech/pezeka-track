'use client';

import { useMemo } from 'react';
import { useUser, useDoc } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileText, Bell } from 'lucide-react';

interface Investor {
  id: string;
  uid: string;
  name: string;
  email: string;
  totalInvestment: number;
  currentBalance: number;
  createdAt: { seconds: number; nanoseconds: number };
}

export default function InvestorPage() {
  const { user, loading: userLoading } = useUser();
  
  const { data: portfolio, loading: portfolioLoading } = useDoc<Investor>(user ? `investors/${user.uid}` : null);
  
  const roi = useMemo(() => {
    if (!portfolio || !portfolio.totalInvestment) return 0;
    return ((portfolio.currentBalance - portfolio.totalInvestment) / portfolio.totalInvestment) * 100;
  }, [portfolio]);
  
  const isLoading = userLoading || portfolioLoading;

  return (
    <div className="py-6">
      <h1 className="text-3xl font-bold tracking-tight mb-4">
        Welcome, {portfolio?.name || user?.email}!
      </h1>

      {isLoading && (
        <div className="flex items-center justify-center p-12">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !portfolio && (
        <Alert variant="destructive">
            <AlertTitle>Portfolio Not Found</AlertTitle>
            <AlertDescription>We could not find an investment portfolio associated with your account. Please contact support for assistance.</AlertDescription>
        </Alert>
      )}

      {!isLoading && portfolio && (
        <>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Invested Amount</CardTitle>
                        <span className="text-muted-foreground">Ksh</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{portfolio.totalInvestment.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Portfolio Value</CardTitle>
                         <span className="text-muted-foreground">Ksh</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{portfolio.currentBalance.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Return on Investment (ROI)</CardTitle>
                        <span className="text-muted-foreground">%</span>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-destructive'}`}>{roi.toFixed(2)}%</div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                        <CardDescription>Important updates about your portfolio.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert>
                            <Bell className="h-4 w-4" />
                            <AlertTitle>No new notifications</AlertTitle>
                            <AlertDescription>
                                You're all caught up! We'll let you know when there's something new.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Statements</CardTitle>
                        <CardDescription>Download your portfolio summaries.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Alert>
                            <FileText className="h-4 w-4" />
                            <AlertTitle>Feature Coming Soon</AlertTitle>
                            <AlertDescription>
                                The ability to download statements is not yet available.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        </>
      )}
    </div>
  );
}
