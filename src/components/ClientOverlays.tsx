'use client';

import dynamic from 'next/dynamic';

const WhatsAppButton = dynamic(() => import('@/components/landing/WhatsAppButton'), { ssr: false });

export default function ClientOverlays() {
  return (
    <>
      <WhatsAppButton />
    </>
  );
}
