
'use client';

import Link from 'next/link';
import { Menu, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import Image from 'next/image';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="px-4 lg:px-6 h-16 flex items-center bg-card border-b sticky top-0 z-50">
      <Link href="/" className="flex items-center justify-center" onClick={closeMenu}>
        <Image 
          src="/pezeka_logo_transparent.png" 
          alt="Pezeka Credit" 
          width={40} 
          height={40} 
          className="h-10 w-auto object-contain"
          onError={(e) => {
            // Fallback if logo is missing
            e.currentTarget.style.display = 'none';
          }}
        />
        <span className="ml-2 font-bold text-xl tracking-tight text-primary">Pezeka Credit</span>
      </Link>
      <nav className="ml-auto hidden md:flex items-center gap-4 sm:gap-6">
        <Link href="#products" className="text-sm font-medium hover:text-primary transition-colors">
          Products
        </Link>
        <Link href="#calculator" className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1">
          <Calculator className="h-4 w-4" />
          Calculator
        </Link>
        <Link href="#about" className="text-sm font-medium hover:text-primary transition-colors">
          About Us
        </Link>
        <Link href="#contact" className="text-sm font-medium hover:text-primary transition-colors">
          Contact
        </Link>
        <div className="h-6 w-px bg-border mx-2" />
        <PWAInstallButton showIconOnly variant="ghost" className="h-9 w-9 text-primary" />
        <Button asChild variant="default" size="sm" className="font-bold">
            <Link href="/customer-login">Customer Portal</Link>
        </Button>
      </nav>
      {mounted && (
        <div className="md:hidden ml-auto flex items-center gap-2">
          <PWAInstallButton showIconOnly variant="ghost" className="h-9 w-9 text-primary" />
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
                <SheetDescription>Access Pezeka products and portal</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-6">
                 <Link href="/" className="flex items-center gap-2 mb-4" onClick={closeMenu}>
                  <Image src="/pezeka_logo_transparent.png" alt="Logo" width={32} height={32} />
                  <span className="font-bold text-xl text-primary">Pezeka Credit</span>
                </Link>
                <Link href="#products" className="text-lg font-semibold hover:text-primary" onClick={closeMenu}>
                  Products
                </Link>
                <Link href="#calculator" className="text-lg font-semibold hover:text-primary flex items-center gap-2" onClick={closeMenu}>
                  <Calculator className="h-5 w-5" />
                  Calculator
                </Link>
                <Link href="#about" className="text-lg font-semibold hover:text-primary" onClick={closeMenu}>
                  About Us
                </Link>
                <Link href="#contact" className="text-lg font-semibold hover:text-primary" onClick={closeMenu}>
                  Contact
                </Link>
                <div className="pt-4 border-t mt-2">
                   <Button asChild className="w-full h-12 font-bold">
                      <Link href="/customer-login" onClick={closeMenu}>Customer Portal</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </header>
  );
}
