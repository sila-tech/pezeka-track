'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, CheckCircle } from 'lucide-react';
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
      setIsInstalled(true);
    }
  };

  // If installed, show a "Installed" status button instead of returning null
  // This satisfies the user's request to see the icon/button on the landing page
  if (isInstalled) {
    return (
      <Button
        variant={variant}
        size={showIconOnly ? 'icon' : 'default'}
        className={cn("gap-2 text-primary border-primary/20 bg-primary/5", className)}
        disabled
      >
        <CheckCircle className="h-4 w-4" />
        {!showIconOnly && <span>App Installed</span>}
      </Button>
    );
  }

  // If prompt not available (e.g. on Desktop Safari or already rejected), 
  // show a "Get Android App" button that links to info
  if (!deferredPrompt) {
    return (
      <Button
        variant={variant}
        size={showIconOnly ? 'icon' : 'default'}
        className={cn("gap-2", className)}
        asChild
      >
        <a href="#app">
          <Smartphone className="h-4 w-4" />
          {!showIconOnly && <span>Get Mobile App</span>}
        </a>
      </Button>
    );
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
      {!showIconOnly && <span>Download App</span>}
    </Button>
  );
}
