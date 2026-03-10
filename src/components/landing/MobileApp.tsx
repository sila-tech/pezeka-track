'use client';

import { Smartphone, CheckCircle2, AppWindow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PWAInstallButton } from '@/components/PWAInstallButton';

export default function MobileApp() {
  return (
    <section id="app" className="w-full py-12 md:py-24 bg-white overflow-hidden">
      <div className="container px-4 md:px-6">
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary font-bold">
              Pezeka Mobile
            </div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Your Financial Partner, <br />
              <span className="text-primary">Now in Your Pocket</span>
            </h2>
            <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Experience the full power of Pezeka Credit on your smartphone. Manage loans, check balances, and apply for credit anytime, anywhere.
            </p>
            <ul className="grid gap-3 py-2">
              <li className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">Instant Loan Status Notifications</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">Secure Biometric Login Support</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">One-Tap Loan Applications</span>
              </li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <PWAInstallButton className="h-14 px-8 text-lg shadow-lg" variant="default" />
              <Button variant="outline" className="h-14 px-8 text-lg gap-2" asChild>
                <a href="#contact">
                  <AppWindow className="h-5 w-5" />
                  Support
                </a>
              </Button>
            </div>
          </div>
          <div className="relative flex justify-center lg:justify-end">
             <div className="absolute -z-10 inset-0 bg-primary/5 rounded-full blur-3xl scale-150" />
             <div className="relative border-[12px] border-muted-foreground/10 rounded-[3rem] p-2 bg-card shadow-2xl overflow-hidden w-[280px] h-[560px] transform hover:rotate-2 transition-transform duration-500">
                <div className="bg-primary h-full w-full rounded-[2.2rem] flex flex-col items-center justify-center p-6 text-center space-y-6">
                    <div className="rounded-2xl bg-white/20 p-4 backdrop-blur-sm">
                        <Smartphone className="h-16 w-16 text-white animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <p className="font-black text-2xl text-white tracking-tight">Pezeka App</p>
                        <p className="text-xs text-white/80 font-medium">Fast. Transparent. Reliable.</p>
                    </div>
                    <div className="w-full space-y-3 pt-8">
                        <div className="w-full h-2 bg-white/20 rounded-full" />
                        <div className="w-full h-2 bg-white/20 rounded-full" />
                        <div className="w-2/3 h-2 bg-white/20 rounded-full" />
                    </div>
                    <div className="mt-auto pb-4">
                        <div className="h-1 w-12 bg-white/40 rounded-full mx-auto" />
                    </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </section>
  );
}
