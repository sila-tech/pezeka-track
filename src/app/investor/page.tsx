'use client';

import { useInvestorUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LineChart, BarChart, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InvestorDashboardPage() {
  const { user, loading } = useInvestorUser();

  if (loading || !user) {
    return null; // Layout handles loading state
  }

  const initial = user.initialInvestment || 0;
  const current = user.currentBalance || 0;
  const growth = current - initial;
  const roi = initial > 0 ? (growth / initial) * 100 : 0;

  return (
    <div className="container mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Your Portfolio Overview</h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
                    <span className="text-muted-foreground">Ksh</span>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{initial.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Your initial capital</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Value</CardTitle>
                    <span className="text-muted-foreground">Ksh</span>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{current.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Includes principal + interest</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Portfolio Growth</CardTitle>
                    <span className="text-muted-foreground">Ksh</span>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {growth.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">Total interest earned</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Return on Investment (ROI)</CardTitle>
                    <span className="text-muted-foreground">%</span>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {roi.toFixed(2)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Percentage growth of your investment</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid gap-6 mt-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Performance</CardTitle>
                    <CardDescription>Your portfolio's value over time.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Alert>
                        <LineChart className="h-4 w-4" />
                        <AlertTitle>Coming Soon!</AlertTitle>
                        <AlertDescription>
                            A detailed performance graph will be available here soon.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Statements</CardTitle>
                    <CardDescription>Download your portfolio statements.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center gap-4 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        Generate and download your portfolio summaries in PDF or Excel format.
                    </p>
                    <Button disabled>Download Statement (Coming Soon)</Button>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
