import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function CustomersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Customer
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>A list of all customers in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Customer table will go here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
