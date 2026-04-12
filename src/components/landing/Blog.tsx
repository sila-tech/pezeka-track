import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, BookOpen, Clock, ShieldAlert, TrendingUp } from 'lucide-react';

const blogPosts = [
  {
    slug: 'understanding-crb-clearance-kenya',
    title: 'Understanding CRB Clearance: How to Check Your Status in Kenya',
    excerpt: 'Demystify Credit Reference Bureaus and learn the steps to check your credit status, rebuild your score, and unlock better lending rates for your business.',
    icon: <BookOpen className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '5 min read',
    date: 'Apr 11, 2026'
  },
  {
    slug: 'spot-safe-versus-predatory-mobile-lenders',
    title: 'How to Spot Safe Mobile Lenders vs. Predatory Apps',
    excerpt: 'Avoid unregulated digital lenders and data-shaming traps. Learn how to verify legitimate lenders registered under the Data Protection Act for safe borrowing.',
    icon: <ShieldAlert className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '4 min read',
    date: 'Apr 02, 2026'
  },
  {
    slug: 'secured-vs-unsecured-business-loans',
    title: 'Secured vs. Unsecured Loans: Which is Best for Your Biashara?',
    excerpt: 'Should you use your vehicle logbook to secure a loan? We compare secured and unsecured credit facilities to help you choose the best growth engine for your SME.',
    icon: <TrendingUp className="h-6 w-6 text-[#5BA9D0]" />,
    readTime: '6 min read',
    date: 'Mar 28, 2026'
  }
];

export default function Blog() {
  return (
    <section id="blog" className="w-full py-12 md:py-24 lg:py-32 bg-white">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <div className="inline-block rounded-lg bg-[#5BA9D0]/10 text-[#5BA9D0] px-3 py-1 text-sm font-semibold">Latest Insights</div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-[#1B2B33]">Financial Advice & Resources</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Expert articles designed to help Kenyans navigate digital borrowing, understand credit scores, and grow their businesses safely.
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-6xl items-stretch gap-6 py-12 md:grid-cols-3 lg:gap-8">
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
