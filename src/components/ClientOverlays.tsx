
'use client';

import { usePathname } from 'next/navigation';
import WhatsAppButton from '@/components/landing/WhatsAppButton';
import { useAppUser } from '@/firebase/auth/use-app-user';

/**
 * @fileOverview Manages client-side only overlays and floating UI elements.
 */

export default function ClientOverlays() {
  const pathname = usePathname();
  const { user, loading } = useAppUser();
  
  // Only show on the absolute root path, and only if we are certain no user is logged in
  const isLandingPage = pathname === '/';
  const showWhatsApp = isLandingPage && !user && !loading;

  if (!showWhatsApp) return null;

  return (
    <>
      <WhatsAppButton />
    </>
  );
}
