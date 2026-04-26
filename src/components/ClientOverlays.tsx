
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
  
  // Show on the landing page (root path)
  const isLandingPage = pathname === '/';
  // Hide if in the customer portal area
  const isPortal = pathname.includes('/account') || pathname.includes('/apply') || pathname.includes('/history') || pathname.includes('/profile');
  
  // Show on landing page, or potentially other non-portal pages if desired
  const showWhatsApp = isLandingPage && !isPortal;

  if (!showWhatsApp) return null;

  return (
    <>
      <WhatsAppButton />
    </>
  );
}
