import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, ShieldCheck, BarChart3, Users, ArrowRight, Wallet, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const investmentTypes = [
  {
    icon: <PieChart className="h-10 w-10 text-[#5BA9D0]" />,
    title: 'Standard Growth Portfolio',
    description: "Our core investment vehicle designed for consistent, steady growth. Your capital is diversified across a high-performing credit pool, ensuring stability and reliable wealth accumulation over time.",
    benefits: ['Daily compounding growth', 'Low risk profile', 'Ideal for long-term wealth']
  },
  {
    icon: <Wallet className="h-10 w-10 text-[#5BA9D0]" />,
    title: 'Corporate Investment',
    description: "Tailored for businesses and institutions looking to optimize their cash reserves. Benefit from institutional-grade oversight and a structured approach to managing your corporate liquid assets.",
    benefits: ['High liquidity', 'Dedicated account manager', 'Comprehensive reporting']
  },
  {
    icon: <BarChart3 className="h-10 w-10 text-[#5BA9D0]" />,
    title: 'Target Savings Plan',
    description: "Whether you are saving for a home, education, or a major purchase, our target-based plans provide the discipline and growth needed to reach your financial milestones faster.",
    benefits: ['Goal-specific tracking', 'Flexible deposit schedules', 'Automated reminders']
  },
  {
    icon: <Users className="h-10 w-10 text-[#5BA9D0]" />,
    title: 'Community Impact Bonds',
    description: "Invest with purpose. Your capital directly supports local entrepreneurs and small businesses in Kenya, fostering economic growth while you earn competitive returns on your contribution.",
    benefits: ['Direct social impact', 'Transparent allocation', 'Vetted credit opportunities']
  }
];

export default function InvestorSection() {
  return (
    <section id="invest" className="w-full py-20 lg:py-32 bg-white overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-[#5BA9D0]/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-96 h-96 bg-[#1B2B33]/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="container px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
          <div className="space-y-3">
            <div className="inline-block rounded-full bg-[#5BA9D0]/10 px-4 py-1.5 text-sm font-bold text-[#5BA9D0] border border-[#5BA9D0]/20">
              Wealth Creation
            </div>
            <h2 className="text-4xl font-black tracking-tight sm:text-6xl text-[#1B2B33]">
              Become an investor at <span className="text-[#5BA9D0]">Pezeka</span>
            </h2>
            <p className="max-w-[800px] text-muted-foreground text-lg md:text-xl font-medium leading-relaxed">
              Grow your wealth while empowering local businesses. Join a community of savvy investors 
              backing the future of Kenyan entrepreneurship.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {investmentTypes.map((type, index) => (
            <Card key={index} className="border-none shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-[#5BA9D0]/10 transition-all duration-500 group overflow-hidden bg-white">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {type.icon}
              </div>
              <CardHeader className="space-y-4 pb-4">
                <div className="p-3 bg-slate-50 w-fit rounded-2xl group-hover:bg-[#5BA9D0]/10 transition-colors duration-500">
                  {type.icon}
                </div>
                <CardTitle className="text-2xl font-bold text-[#1B2B33]">{type.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <CardDescription className="text-base text-muted-foreground leading-relaxed">
                  {type.description}
                </CardDescription>
                
                <ul className="space-y-3">
                  {type.benefits.map((benefit, bIndex) => (
                    <li key={bIndex} className="flex items-center gap-3 text-sm font-semibold text-[#1B2B33]/80">
                      <div className="h-5 w-5 rounded-full bg-green-50 flex items-center justify-center">
                        <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-20 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="h-14 px-10 rounded-2xl bg-[#1B2B33] hover:bg-[#1B2B33]/90 text-white font-black text-lg shadow-xl shadow-[#1B2B33]/20 group">
            <Link href="/investor-login" className="flex items-center gap-2">
              Start Investing Now
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-14 px-10 rounded-2xl border-2 border-[#1B2B33]/10 hover:bg-slate-50 font-bold text-lg">
            <Link href="#contact">Talk to an Advisor</Link>
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-y border-slate-100">
            <div className="text-center space-y-1">
                <p className="text-2xl font-black text-[#1B2B33]">Secure</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Asset Backed</p>
            </div>
            <div className="text-center space-y-1">
                <p className="text-2xl font-black text-[#1B2B33]">Easy</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Digital Process</p>
            </div>
            <div className="text-center space-y-1">
                <p className="text-2xl font-black text-[#1B2B33]">Impact</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Kenyan Growth</p>
            </div>
            <div className="text-center space-y-1">
                <p className="text-2xl font-black text-[#1B2B33]">Fast</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Quick Withdrawals</p>
            </div>
        </div>
      </div>
    </section>
  );
}
