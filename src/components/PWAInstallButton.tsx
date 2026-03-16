'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'outline' | 'default' | 'ghost' | 'secondary';
  showIconOnly?: boolean;
}

export function PWAInstallButton({ className, variant = 'outline', showIconOnly = false }: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

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
    if (!deferredPrompt) {
        // Fallback for browsers that don't support beforeinstallprompt yet
        if (!isIOS) {
            alert("To install: Tap your browser's menu (three dots) and select 'Install' or 'Add to Home Screen'.");
        }
        return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  };

  if (isInstalled) {
    return (
      <Button
        variant={variant}
        size={showIconOnly ? 'icon' : 'default'}
        className={cn("gap-2 text-green-600 border-green-200 bg-green-50", className)}
        disabled
      >
        <CheckCircle className="h-4 w-4" />
        {!showIconOnly && <span>App Installed</span>}
      </Button>
    );
  }

  // iOS Specific Tooltip instructions
  if (isIOS) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={variant}
                        size={showIconOnly ? 'icon' : 'default'}
                        className={cn("gap-2", className)}
                    >
                        <Smartphone className="h-4 w-4" />
                        {!showIconOnly && <span>Download App</span>}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs p-4 bg-white text-[#1B2B33] border shadow-xl">
                    <p className="font-bold mb-1">Install on iPhone:</p>
                    <p>Tap the <span className="inline-block px-1 border rounded bg-muted">Share</span> icon in Safari and select <span className="font-bold">"Add to Home Screen"</span>.</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
  }

  return (
    <Button
      variant={variant}
      size={showIconOnly ? 'icon' : 'default'}
      onClick={handleInstallClick}
      className={cn(
        "gap-2 transition-all", 
        deferredPrompt && "animate-pulse border-primary/50 shadow-md",
        className
      )}
      title="Install Pezeka App"
    >
      {deferredPrompt ? <Download className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
      {!showIconOnly && <span>{deferredPrompt ? 'Install App' : 'Download App'}</span>}
    </Button>
  );
}
