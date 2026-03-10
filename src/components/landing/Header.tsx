'use client';

import Link from 'next/link';
import { Landmark, Menu, Calculator, Smartphone } from 'lucide-react';
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
    <header className="px-4 lg:px-6 h-14 flex items-center bg-card border-b sticky top-0 z-50">
      <Link href="/" className="flex items-center justify-center" onClick={closeMenu}>
        <Landmark className="h-6 w-6 text-primary" />
        <span className="ml-2 font-semibold text-lg tracking-tight">Pezeka Credit</span>
      </Link>
      <nav className="ml-auto hidden md:flex items-center gap-4 sm:gap-6">
        <Link href="#products" className="text-sm font-medium hover:underline underline-offset-4">
          Products
        </Link>
        <Link href="#calculator" className="text-sm font-medium hover:underline underline-offset-4 flex items-center gap-1">
          <Calculator className="h-4 w-4" />
          Calculator
        </Link>
        <Link href="#app" className="text-sm font-medium hover:underline underline-offset-4 flex items-center gap-1">
          <Smartphone className="h-4 w-4" />
          Mobile App
        </Link>
        <Link href="#about" className="text-sm font-medium hover:underline underline-offset-4">
          About Us
        </Link>
        <Link href="#contact" className="text-sm font-medium hover:underline underline-offset-4">
          Contact
        </Link>
        <PWAInstallButton variant="ghost" className="text-sm font-medium h-auto py-0 hover:bg-transparent" />
        <Button asChild variant="default" size="sm">
            <Link href="/customer-login">Customer Portal</Link>
        </Button>
      </nav>
      {mounted && (
        <div className="md:hidden ml-auto flex items-center gap-2">
          <PWAInstallButton showIconOnly variant="ghost" className="h-9 w-9" />
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
                 <Link href="/" className="flex items-center justify-center" onClick={closeMenu}>
                  <Landmark className="h-6 w-6 text-primary" />
                  <span className="ml-2 font-semibold text-lg">Pezeka Credit</span>
                </Link>
                <Link href="#products" className="text-lg font-medium" onClick={closeMenu}>
                  Products
                </Link>
                <Link href="#calculator" className="text-lg font-medium flex items-center gap-2" onClick={closeMenu}>
                  <Calculator className="h-5 w-5" />
                  Calculator
                </Link>
                <Link href="#app" className="text-lg font-medium flex items-center gap-2" onClick={closeMenu}>
                  <Smartphone className="h-5 w-5" />
                  Mobile App
                </Link>
                <Link href="#about" className="text-lg font-medium" onClick={closeMenu}>
                  About Us
                </Link>
                <Link href="#contact" className="text-lg font-medium" onClick={closeMenu}>
                  Contact
                </Link>
                <div className="pt-2 border-t mt-2">
                   <PWAInstallButton className="w-full justify-start mb-4" variant="outline" />
                   <Button asChild className="w-full">
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
