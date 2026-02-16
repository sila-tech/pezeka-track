import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, Briefcase, UserCheck } from 'lucide-react';

const products = [
  {
    icon: <UserCheck className="h-8 w-8 text-primary" />,
    title: 'Personal Loans',
    description: 'Flexible personal loans for your individual needs, from emergency expenses to personal projects.',
  },
  {
    icon: <Briefcase className="h-8 w-8 text-primary" />,
    title: 'Business Loans',
    description: 'Fuel your business growth with our SME loans, designed to provide working capital and support expansion.',
  },
  {
    icon: <DollarSign className="h-8 w-8 text-primary" />,
    title: 'Logbook Loans',
    description: 'Unlock the value of your vehicle with a logbook loan. Quick access to cash when you need it most.',
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
        <div className="mx-auto grid max-w-5xl items-start gap-6 py-12 lg:grid-cols-3 lg:gap-12">
          {products.map((product) => (
            <Card key={product.title} className="bg-card">
              <CardHeader className="flex flex-col items-center text-center space-y-4 p-8">
                {product.icon}
                <div className="space-y-2">
                    <CardTitle>{product.title}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
