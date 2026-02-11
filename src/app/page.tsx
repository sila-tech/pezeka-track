import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <div className="flex items-center gap-4 text-primary">
          <CreditCard className="h-12 w-12" />
          <h1 className="text-4xl font-bold tracking-tight font-headline md:text-5xl">PezekaTrack</h1>
        </div>
        <p className="max-w-md text-muted-foreground">Your in-house solution for loan and finance management.</p>
        <div className="flex flex-col gap-4 pt-8 sm:flex-row">
            <Button asChild size="lg" className="w-48">
              <Link href="/dashboard">Staff Portal</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-48">
              <Link href="/finance">Finance Portal</Link>
            </Button>
        </div>
      </div>
    </main>
  );
}
