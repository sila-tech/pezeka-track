import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function Hero() {
  return (
    <section id="home" className="w-full py-12 md:py-24 lg:py-32">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
          <Image
            src="https://picsum.photos/seed/finance-hero/600/600"
            width={600}
            height={600}
            alt="Hero"
            data-ai-hint="happy people business"
            className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last"
          />
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                Unlock Your Financial Goals with Pezeka Credit
              </h1>
              <p className="max-w-[600px] text-muted-foreground md:text-xl">
                We provide fast, transparent, and reliable loan solutions tailored to your unique needs. Whether it's for personal ambitions or business growth, our simple application process is your first step towards success.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button asChild size="lg">
                <Link href="/application-form">Apply for a Loan</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#products">Our Products</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
