import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FinancePage() {
  return (
    <div>
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
             <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Entry
            </Button>
        </div>
        <Tabs defaultValue="receipts">
            <TabsList>
                <TabsTrigger value="receipts">Daily Receipts</TabsTrigger>
                <TabsTrigger value="payouts">Daily Payouts</TabsTrigger>
                <TabsTrigger value="expenses">Daily Expenses</TabsTrigger>
            </TabsList>
            <TabsContent value="receipts">
                <Card>
                    <CardHeader>
                        <CardTitle>Daily Receipts</CardTitle>
                        <CardDescription>Amount received from customers.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Receipts table will go here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="payouts">
                <Card>
                    <CardHeader>
                        <CardTitle>Daily Payouts</CardTitle>
                        <CardDescription>Amount disbursed to customers, including costs.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Payouts table will go here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="expenses">
                <Card>
                    <CardHeader>
                        <CardTitle>Daily Expenses</CardTitle>
                        <CardDescription>Money spent on facilitation and other costs.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Expenses table will go here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
