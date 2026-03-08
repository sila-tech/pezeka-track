'use client';

import dynamic from 'next/dynamic';

const WhatsAppButton = dynamic(() => import('@/components/landing/WhatsAppButton'), { ssr: false });
const PWARegister = dynamic(() => import('@/components/PWARegister').then(mod => mod.PWARegister), { ssr: false });

export default function ClientOverlays() {
  return (
    <>
      <WhatsAppButton />
      <PWARegister />
    </>
  );
}
