import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, Briefcase, UserCheck, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const products = [
  {
    icon: <UserCheck className="h-8 w-8 text-primary" />,
    title: 'Individual Short-Term Loans',
    description: "Access the funds you need for life's important moments. Our personal loans offer competitive rates and flexible terms for everything from home renovations to unexpected expenses.",
    href: '/customer-login'
  },
  {
    icon: <Banknote className="h-8 w-8 text-primary" />,
    title: 'Salary Advance Loans',
    description: 'Get a quick and convenient loan against your salary. Ideal for emergencies and short-term cash needs with a straightforward repayment plan.',
    href: '/customer-login'
  },
  {
    icon: <DollarSign className="h-8 w-8 text-primary" />,
    title: 'Logbook Loans',
    description: "Leverage your vehicle's value to get fast and secure financing. Our logbook loans provide immediate cash to address urgent needs without selling your asset.",
    href: '/customer-login'
  },
  {
    icon: <Briefcase className="h-8 w-8 text-primary" />,
    title: 'Business Loans',
    description: 'Power your business ambitions with our tailored SME loan products. Get the working capital you need to scale operations, purchase inventory, or invest in new opportunities.',
    href: '/customer-login'
  },
];

export default function Products() {
  return (
    <section id="products" className="w-full py-12 md:py-24 lg:py-32 bg-muted">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm">Our Products</div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Our Loan Products</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              We offer a variety of loan products designed to meet the diverse needs of our customers.
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-5xl items-stretch gap-6 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {products.map((product) => (
            <Card key={product.title} className="bg-card flex flex-col">
              <CardHeader className="flex flex-col items-center text-center space-y-4 p-6">
                {product.icon}
                <div className="space-y-2">
                    <CardTitle>{product.title}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="mt-auto p-6 pt-0">
                 <Button asChild className="w-full">
                  <Link href={product.href}>Apply Now</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
