import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import Link from 'next/link';

const forms = [
  {
    title: 'Individual Short-Term Loan',
    description: 'Printable application form for individual short-term loans.',
    href: '/admin/application-forms/individual',
  },
  {
    title: 'Salary Advance Loan',
    description: 'Printable application form for salary-based loans.',
    href: '/admin/application-forms/salary',
  },
  {
    title: 'Car Logbook Loan',
    description: 'Printable application forms for securing a loan against a car logbook.',
    href: '/admin/application-forms/logbook',
  },
];

export default function ApplicationFormsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-4">Application Forms</h1>
      <p className="text-muted-foreground mb-6">
        Here you can find all the printable loan application forms for your customers.
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => (
          <Card key={form.title}>
            <CardHeader>
              <CardTitle>{form.title}</CardTitle>
              <CardDescription>{form.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={form.href} target="_blank">
                  <FileText className="mr-2 h-4 w-4" />
                  View Form
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
