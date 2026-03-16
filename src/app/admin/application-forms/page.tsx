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
  
  // Robust case-insensitive check for all admin team members
  const userRole = user?.role?.toLowerCase();
  const isSuperAdmin = user?.email?.toLowerCase() === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
  const isAuthorized = user && (isSuperAdmin || userRole === 'staff' || userRole === 'finance');

  if (loading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-12 text-center bg-card rounded-xl border border-dashed">
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You do not have the required permissions to view the application forms dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-primary">Printable Application Forms</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Access and print official Pezeka Credit application documents for offline customer registration. These forms are required for physical KYC verification.
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => (
          <Card key={form.title} className="group hover:shadow-xl transition-all duration-300 border-t-4 border-t-primary/20 hover:border-t-primary">
            <CardHeader>
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-2 group-hover:bg-primary group-hover:text-white transition-colors">
                <FileText className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">{form.title}</CardTitle>
              <CardDescription className="text-sm min-h-[40px]">{form.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full font-bold" variant="outline">
                <Link href={form.href} target="_blank">
                  <Download className="mr-2 h-4 w-4" />
                  View & Print Form
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-muted/30 border p-6 rounded-xl space-y-2">
          <h3 className="font-bold flex items-center gap-2">
              <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full uppercase">Tip</span>
              Printing Instructions
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
              Once you open a form, click the <strong>"Print / Save as PDF"</strong> button at the top right. 
              For the best results, set your printer to <strong>Portrait</strong> orientation and <strong>A4</strong> paper size.
          </p>
      </div>
    </div>
  );
}
