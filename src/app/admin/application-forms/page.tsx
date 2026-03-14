'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
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
  
  // Since AdminLayout already protects this route group for Staff, Finance, and Super Admin,
  // we can allow access to any user who has reached this dashboard.
  const isAuthorized = !!user;

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to view this section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Application Forms</h1>
        <p className="text-muted-foreground mt-1">
          Download printable forms for offline customer registration. Use the <strong>Print / Save as PDF</strong> button inside each form.
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => (
          <Card key={form.title} className="hover:shadow-md transition-shadow border-t-2 border-t-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">{form.title}</CardTitle>
              <CardDescription className="text-xs h-10">{form.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" variant="outline">
                <Link href={form.href} target="_blank">
                  <FileText className="mr-2 h-4 w-4" />
                  View & Download
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
