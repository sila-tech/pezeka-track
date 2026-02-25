import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import WhatsAppButton from '@/components/landing/WhatsAppButton';

export const metadata: Metadata = {
  title: 'Pezeka Credit Ltd',
  description: 'In-house credit management system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('font-sans antialiased')}>
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <Toaster />
        <WhatsAppButton />
      </body>
    </html>
  );
}
