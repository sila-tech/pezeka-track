'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Download } from 'lucide-react';
import Link from 'next/link';
import { useAppUser } from '@/firebase';

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
    title: 'Logbook Loan',
    description: 'Printable application form for vehicle-secured loans.',
    href: '/admin/application-forms/logbook',
  },
];

export default function ApplicationFormsPage() {
  const { user, loading } = useAppUser();
  
  const userRole = user?.role?.toLowerCase();
  const isAuthorized = user && (user.email === 'simon@pezeka.com' || userRole === 'finance' || userRole === 'staff');

  if (loading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAuthorized) return <div className="p-12 text-center">Access Denied</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-4">Application Forms</h1>
      <p className="text-muted-foreground mb-6">
        Here you can find all the printable loan application forms for your customers. Click "View Form" to see the document and then use the Print button to Save as PDF.
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => (
          <Card key={form.title}>
            <CardHeader>
              <CardTitle>{form.title}</CardTitle>
              <CardDescription>{form.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href={form.href} target="_blank">
                  <FileText className="mr-2 h-4 w-4" />
                  View & Print
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
