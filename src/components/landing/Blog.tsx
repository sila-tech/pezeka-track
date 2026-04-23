import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, BookOpen, Clock, ShieldAlert, TrendingUp, Zap, Car, Briefcase, HelpCircle, Building2 } from 'lucide-react';

const blogPosts = [
  {
    slug: 'quick-pesa-loan-kenya',
    title: 'Quick Pesa: How to Get a Fast Loan in Kenya Within Hours',
    excerpt: 'Need emergency cash fast? Discover how Quick Pesa-style rapid loans work in Kenya, where to apply, and how Pezeka Credit can put money in your hands the same day.',
    icon: <Zap className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '4 min read',
    date: 'Apr 12, 2026'
  },
  {
    slug: 'logbook-loan-kenya-guide',
    title: 'Logbook Loans in Kenya: Unlock Big Capital Using Your Vehicle',
    excerpt: 'Your car is worth more than you think. Learn exactly how logbook loans work, the requirements, interest rates, and how to safely borrow against your vehicle to grow your business.',
    icon: <Car className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '6 min read',
    date: 'Apr 10, 2026'
  },
  {
    slug: 'salary-advance-loan-kenya',
    title: 'Salary Advance Loans in Kenya: Bridge the Gap Before Payday',
    excerpt: 'Rent due before your salary arrives? A salary advance loan can save the day. Find out how payslip-backed loans work, who qualifies, and how to apply at Pezeka Credit.',
    icon: <Briefcase className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '5 min read',
    date: 'Apr 08, 2026'
  },
  {
    slug: 'understanding-crb-clearance-kenya',
    title: 'Understanding CRB Clearance: How to Check Your Status in Kenya',
    excerpt: 'Demystify Credit Reference Bureaus and learn the steps to check your credit status, rebuild your score, and unlock better lending rates for your business.',
    icon: <BookOpen className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '5 min read',
    date: 'Apr 06, 2026'
  },
  {
    slug: 'loan-without-payslip-kenya',
    title: 'How to Get a Loan Without a Payslip in Kenya (2026 Guide)',
    excerpt: 'Self-employed or in the informal sector? You can still access credit. Explore collateral-based and alternative-income loan options available to Kenyans without a formal payslip.',
    icon: <HelpCircle className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '5 min read',
    date: 'Apr 04, 2026'
  },
  {
    slug: 'small-business-loans-kenya-2026',
    title: 'Best Loan Options for Small Businesses in Kenya in 2026',
    excerpt: 'From dukas to boda bodas — explore the best financing options for Kenyan SMEs in 2026. Compare mobile loans, logbook loans, and microfinance to find the right fit for your biashara.',
    icon: <Building2 className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '7 min read',
    date: 'Apr 02, 2026'
  },
  {
    slug: 'spot-safe-versus-predatory-mobile-lenders',
    title: 'How to Spot Safe Mobile Lenders vs. Predatory Apps',
    excerpt: 'Avoid unregulated digital lenders and data-shaming traps. Learn how to verify legitimate lenders registered under the Data Protection Act for safe borrowing.',
    icon: <ShieldAlert className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '4 min read',
    date: 'Mar 28, 2026'
  },
  {
    slug: 'secured-vs-unsecured-business-loans',
    title: 'Secured vs. Unsecured Loans: Which is Best for Your Biashara?',
    excerpt: 'Should you use your vehicle logbook to secure a loan? We compare secured and unsecured credit facilities to help you choose the best growth engine for your SME.',
    icon: <TrendingUp className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '6 min read',
    date: 'Mar 22, 2026'
  }
];

export default function Blog() {
  return (
    <section id="blog" className="w-full py-12 md:py-24 lg:py-32 bg-white">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <div className="inline-block rounded-lg bg-[#5BA9D0]/10 text-[#5BA9D0] px-3 py-1 text-sm font-semibold">Latest Insights</div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-[#1B2B33]">Financial Advice &amp; Resources</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Expert articles designed to help Kenyans navigate digital borrowing, understand credit scores, and grow their businesses safely.
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-6xl items-stretch gap-6 py-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {blogPosts.map((post) => (
            <Card key={post.slug} className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-muted/60">
              <CardHeader className="space-y-4 p-6 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  {post.icon}
                  <span className="flex items-center text-xs font-medium text-muted-foreground"><Clock className="h-3 w-3 mr-1"/> {post.readTime}</span>
                </div>
                <div className="space-y-2">
                    <CardTitle className="leading-tight text-xl text-[#1B2B33]">{post.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{post.date}</p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-6">
                 <CardDescription className="text-sm/relaxed line-clamp-3 text-slate-600">{post.excerpt}</CardDescription>
              </CardContent>
              <CardFooter className="p-6 pt-0 mt-auto">
                 <Button asChild variant="ghost" className="w-full group text-[#5BA9D0] hover:text-[#5BA9D0] hover:bg-[#5BA9D0]/10">
                  <Link href={`/blog/${post.slug}`}>
                    Read Full Article <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
