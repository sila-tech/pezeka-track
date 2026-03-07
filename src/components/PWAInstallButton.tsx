'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'outline' | 'default' | 'ghost' | 'secondary';
  showIconOnly?: boolean;
}

export function PWAInstallButton({ className, variant = 'outline', showIconOnly = false }: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
      setDeferredPrompt(null);
    } else {
      console.log('User dismissed the PWA install prompt');
    }
  };

  // If already installed or prompt not available, don't show the button
  if (isInstalled || !deferredPrompt) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={showIconOnly ? 'icon' : 'default'}
      onClick={handleInstallClick}
      className={cn("gap-2", className)}
      title="Install Pezeka App"
    >
      <Download className="h-4 w-4" />
      {!showIconOnly && <span>Install App</span>}
    </Button>
  );
}
