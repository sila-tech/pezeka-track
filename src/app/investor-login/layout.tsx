'use client';

import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';

export default function InvestorLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {children}
      </main>
      <Footer />
    </div>
  );
}
