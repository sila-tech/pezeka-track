import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import ClientOverlays from '@/components/ClientOverlays';
import { PWARegister } from '@/components/PWARegister';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Pezeka Credit Ltd',
  description: 'Affordable Credit, Real Opportunities',
  icons: {
    icon: [
      { url: '/pezeka_logo_transparent.png', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('font-sans antialiased')}>
        <PWARegister />
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <Toaster />
        <ClientOverlays />
      </body>
    </html>
  );
}
