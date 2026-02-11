import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function LoansPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
        <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Loan
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Loan Records</CardTitle>
          <CardDescription>A list of all loans disbursed.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Loans table will go here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
