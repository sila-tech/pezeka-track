'use client';

import Link from 'next/link';
import { Landmark, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="px-4 lg:px-6 h-14 flex items-center bg-card border-b sticky top-0 z-50">
      <Link href="/" className="flex items-center justify-center" onClick={closeMenu}>
        <Landmark className="h-6 w-6 text-primary" />
        <span className="ml-2 font-semibold text-lg">Pezeka Credit</span>
      </Link>
      <nav className="ml-auto hidden md:flex items-center gap-4 sm:gap-6">
        <Link href="#products" className="text-sm font-medium hover:underline underline-offset-4">
          Products
        </Link>
        <Link href="#about" className="text-sm font-medium hover:underline underline-offset-4">
          About Us
        </Link>
        <Link href="#contact" className="text-sm font-medium hover:underline underline-offset-4">
          Contact
        </Link>
        <Button asChild variant="outline">
          <Link href="/investor-login">Investor Portal</Link>
        </Button>
        <Button asChild>
            <Link href="/customer-login">Customer Portal</Link>
        </Button>
      </nav>
      <div className="md:hidden ml-auto">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <div className="grid gap-4 py-6">
               <Link href="/" className="flex items-center justify-center" onClick={closeMenu}>
                <Landmark className="h-6 w-6 text-primary" />
                <span className="ml-2 font-semibold text-lg">Pezeka Credit</span>
              </Link>
              <Link href="#products" className="text-lg font-medium" onClick={closeMenu}>
                Products
              </Link>
              <Link href="#about" className="text-lg font-medium" onClick={closeMenu}>
                About Us
              </Link>
              <Link href="#contact" className="text-lg font-medium" onClick={closeMenu}>
                Contact
              </Link>
              <Button asChild className="w-full" variant="outline">
                <Link href="/investor-login" onClick={closeMenu}>Investor Portal</Link>
              </Button>
              <Button asChild className="w-full">
                  <Link href="/customer-login" onClick={closeMenu}>Customer Portal</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
