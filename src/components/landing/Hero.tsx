'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { ArrowRight } from 'lucide-react';

export default function Hero() {
  return (
    <section id="home" className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-white to-muted/20">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="grid gap-10 lg:grid-cols-[1fr_450px] xl:grid-cols-[1fr_550px] items-center">
          <div className="flex flex-col justify-center space-y-8">
            <div className="space-y-6">
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl xl:text-7xl/none text-[#1B2B33] text-balance leading-[1.1]">
                Unlock Your <br />
                <span className="relative inline-block">
                  Financial Goals
                  <span className="absolute bottom-1 left-0 w-full h-[6px] bg-[#5BA9D0] -z-10 rounded-full opacity-60"></span>
                </span> <br />
                with Pezeka
              </h1>
              <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-lg/relaxed font-medium">
                Fast, transparent, and reliable loan solutions tailored to your unique needs. We bridge the gap between your ambitions and your reality.
              </p>
            </div>
            <div className="flex flex-col gap-4 min-[400px]:flex-row">
              <Button asChild size="lg" className="rounded-full h-14 px-8 bg-[#5BA9D0] hover:bg-[#5BA9D0]/90 text-white border-none text-lg font-black shadow-lg shadow-[#5BA9D0]/20">
                <Link href="#products">
                  View Our Loans
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <PWAInstallButton variant="outline" className="rounded-full h-14 px-8 border-muted text-[#1B2B33] font-bold" />
            </div>
          </div>
          <div className="relative group lg:order-last">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#5BA9D0] to-green-400 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
            <div className="relative aspect-square sm:aspect-video lg:aspect-square overflow-hidden rounded-3xl shadow-2xl">
              <Image
                src="https://picsum.photos/seed/finance-hero/800/800"
                fill
                alt="Pezeka Hero"
                data-ai-hint="happy business people"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
