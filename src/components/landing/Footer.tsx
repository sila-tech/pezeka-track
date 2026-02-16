import Link from 'next/link';
import { Landmark } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
            <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
                <Landmark className="h-6 w-6 text-primary" />
                <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                    &copy; {new Date().getFullYear()} Pezeka Credit Ltd. All rights reserved.
                </p>
            </div>
             <nav className="flex gap-4 sm:gap-6">
                <Link href="#" className="text-sm hover:underline underline-offset-4">
                Terms of Service
                </Link>
                <Link href="#" className="text-sm hover:underline underline-offset-4">
                Privacy Policy
                </Link>
            </nav>
        </div>
    </footer>
  );
}
