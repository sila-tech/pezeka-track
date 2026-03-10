'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { ArrowRight } from 'lucide-react';

export default function Hero() {
  return (
    <section id="home" className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-white to-muted/20">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px] items-center">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-green-400 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
            <Image
              src="https://picsum.photos/seed/finance-hero/600/600"
              width={600}
              height={600}
              alt="Pezeka Hero"
              data-ai-hint="happy business people"
              className="relative mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last shadow-2xl"
              priority
            />
          </div>
          <div className="flex flex-col justify-center space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl xl:text-7xl/none text-balance">
                Unlock Your <span className="text-primary">Financial Goals</span> with Pezeka
              </h1>
              <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-lg/relaxed font-medium">
                Fast, transparent, and reliable loan solutions tailored to your unique needs. We bridge the gap between your ambitions and your reality.
              </p>
            </div>
            <div className="flex flex-col gap-3 min-[400px]:flex-row">
              <Button asChild size="lg" className="rounded-full h-12 px-8">
                <Link href="#products">
                  View Our Loans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <PWAInstallButton variant="outline" className="rounded-full h-12 px-8" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
