
'use client';

import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';

export default function AgentSignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFB]">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        {children}
      </main>
      <Footer />
    </div>
  );
}
