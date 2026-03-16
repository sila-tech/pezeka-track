'use client';

import Link from 'next/link';
import { Menu, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { PWAInstallButton } from '@/components/PWAInstallButton';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="px-4 lg:px-6 h-16 flex items-center bg-white border-b border-muted sticky top-0 z-50 shadow-sm">
      <Link href="/" className="flex items-center justify-center" onClick={closeMenu}>
        <img 
          src="/pezeka_logo_transparent.png" 
          alt="Pezeka Credit" 
          className="h-10 w-10 object-contain"
        />
        <span className="ml-2 font-bold text-xl tracking-tight text-[#1B2B33]">Pezeka Credit</span>
      </Link>
      <nav className="ml-auto hidden md:flex items-center gap-4 sm:gap-6">
        <Link href="#products" className="text-sm font-bold text-[#1B2B33] hover:text-[#5BA9D0] transition-colors">
          Products
        </Link>
        <Link href="#calculator" className="text-sm font-bold text-[#1B2B33] hover:text-[#5BA9D0] transition-colors flex items-center gap-1">
          <Calculator className="h-4 w-4" />
          Calculator
        </Link>
        <Link href="#about" className="text-sm font-bold text-[#1B2B33] hover:text-[#5BA9D0] transition-colors">
          About Us
        </Link>
        <Link href="#contact" className="text-sm font-bold text-[#1B2B33] hover:text-[#5BA9D0] transition-colors">
          Contact
        </Link>
        <div className="h-6 w-px bg-muted mx-2" />
        <PWAInstallButton showIconOnly variant="ghost" className="h-9 w-9 text-[#5BA9D0] hover:bg-muted" />
        <Button asChild variant="default" size="sm" className="font-bold bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 text-white border-none rounded-md px-6">
            <Link href="/customer-login">Customer Portal</Link>
        </Button>
      </nav>
      {mounted && (
        <div className="md:hidden ml-auto flex items-center gap-2">
          <PWAInstallButton showIconOnly variant="ghost" className="h-9 w-9 text-[#5BA9D0] hover:bg-muted" />
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="text-[#1B2B33] border-muted bg-transparent hover:bg-muted">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-white border-l border-muted">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
                <SheetDescription>Access Pezeka products and portal</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-6">
                 <Link href="/" className="flex items-center gap-2 mb-4" onClick={closeMenu}>
                  <img src="/pezeka_logo_transparent.png" alt="Logo" className="h-8 w-8 object-contain" />
                  <span className="font-bold text-xl text-[#1B2B33]">Pezeka Credit</span>
                </Link>
                <Link href="#products" className="text-lg font-bold text-[#1B2B33] hover:text-[#5BA9D0]" onClick={closeMenu}>
                  Products
                </Link>
                <Link href="#calculator" className="text-lg font-bold text-[#1B2B33] hover:text-[#5BA9D0] flex items-center gap-2" onClick={closeMenu}>
                  <Calculator className="h-5 w-5" />
                  Calculator
                </Link>
                <Link href="#about" className="text-lg font-bold text-[#1B2B33] hover:text-[#5BA9D0]" onClick={closeMenu}>
                  About Us
                </Link>
                <Link href="#contact" className="text-lg font-bold text-[#1B2B33] hover:text-[#5BA9D0]" onClick={closeMenu}>
                  Contact
                </Link>
                <div className="pt-4 border-t border-muted mt-2">
                   <Button asChild className="w-full h-12 font-bold bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 text-white border-none rounded-md">
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
