import Image from 'next/image';

export default function About() {
  return (
    <section id="about" className="w-full py-12 md:py-24 lg:py-32">
      <div className="container grid items-center gap-6 px-4 md:px-6 lg:grid-cols-2 lg:gap-10">
        <div className="space-y-4">
           <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm">About Us</div>
          <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
            Your Trusted Financial Partner
          </h2>
          <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            Pezeka Credit is a trusted financial partner dedicated to providing accessible and reliable credit solutions. Our mission is to empower individuals and businesses to achieve their financial aspirations through transparent and responsible lending.
          </p>
           <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            With a focus on customer satisfaction and ethical practices, we strive to build long-lasting relationships with our clients, helping them navigate their financial journey with confidence.
          </p>
        </div>
        <div className="flex justify-center">
            <Image
                src="https://picsum.photos/seed/team-working/550/550"
                width={550}
                height={550}
                alt="About us"
                data-ai-hint="diverse team collaboration"
                className="overflow-hidden rounded-xl object-cover"
            />
        </div>
      </div>
    </section>
  );
}
