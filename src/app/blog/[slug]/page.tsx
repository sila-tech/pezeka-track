import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';

export async function generateStaticParams() {
  return [
    { slug: 'understanding-crb-clearance-kenya' },
    { slug: 'spot-safe-versus-predatory-mobile-lenders' },
    { slug: 'secured-vs-unsecured-business-loans' },
  ]
}

const ARTICLES: Record<string, { title: string, date: string, readTime: string, content: React.ReactNode }> = {
  'understanding-crb-clearance-kenya': {
    title: 'Understanding CRB Clearance: How to Check Your Status in Kenya',
    date: 'Apr 11, 2026',
    readTime: '5 min read',
    content: (
      <>
        <p className="mb-4">
          For many Kenyans, the phrase &quot;CRB listed&quot; is synonymous with financial doom. However, understanding what the Credit Reference Bureau (CRB) actually does and how it functions can demystify the process and even work to your advantage when applying for loans online.
        </p>
        
        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">What is the CRB?</h3>
        <p className="mb-4">
          The CRB is a firm that collects data from various financial institutions regarding loans. They gather information on how individuals repay their debts and provide this data to lenders to help them assess an individual&quot;s creditworthiness. In Kenya, being &quot;listed&quot; simply means you have a credit file—it can be a positive listing (you pay on time) or a negative listing (you default on payments).
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">How to Check Your CRB Status</h3>
        <p className="mb-4">
          You are legally entitled to one free credit report per year from any licensed CRB in Kenya, such as Metropol, TransUnion, or Creditinfo. To access your report:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
           <li><strong>Metropol:</strong> Dial *433#, register, and access your Crystobol score.</li>
           <li><strong>TransUnion:</strong> Download the TransUnion Nipashe app or text your name to 21272.</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">How to Rebuild Your Credit Score</h3>
        <p className="mb-4">
          If you have a negative listing, it is not the end of the road. To clear your name, you must contact the lender who submitted the negative report, negotiate a payment plan, and clear the defaulted amount. Once cleared, the lender updates your status, and you can apply for a Clearance Certificate from the CRB.
        </p>

        <div className="bg-[#5BA9D0]/10 p-6 rounded-lg mt-8 mb-4 border border-[#5BA9D0]/20">
          <h4 className="font-bold text-[#1B2B33] mb-2">Our Stance at Pezeka Credit</h4>
          <p className="text-sm">
            At Pezeka, we believe in giving our customers an opportunity to rebuild. We perform fair assessments and specialize in logbook loans and salary advances where your collateral or payslip can act as a guarantee, even if your CRB score isn&quot;t perfect.
          </p>
        </div>
      </>
    )
  },
  'spot-safe-versus-predatory-mobile-lenders': {
    title: 'How to Spot Safe Mobile Lenders vs. Predatory Apps',
    date: 'Apr 02, 2026',
    readTime: '4 min read',
    content: (
      <>
        <p className="mb-4">
          The rise of digital lending in Kenya has brought unprecedented convenience. However, it has also given rise to predatory loan apps that exploit desperate borrowers using aggressive and illegal debt-shaming tactics.
        </p>
        
        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Signs of a Predatory Lender</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
           <li><strong>Excessive Permissions:</strong> They explicitly demand complete access to your phone’s contacts, photo gallery, and call logs during installation.</li>
           <li><strong>Debt Shaming:</strong> They threaten to call or text everyone in your contact list if you default by even one day to embarrass you into paying.</li>
           <li><strong>Hidden Fees:</strong> They deduct massive "processing fees" upfront and charge exorbitant daily late fees that spiral out of control.</li>
           <li><strong>Unregistered:</strong> They are not licensed by the Central Bank of Kenya (CBK) or the Office of the Data Protection Commissioner (ODPC).</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">How to Verify a Safe Lender</h3>
        <p className="mb-4">
          Before applying for any online loan, visit the CBK website to review the directory of licensed Digital Credit Providers (DCPs). Legitimate lenders like Pezeka Credit adhere strictly to the Data Protection Act—meaning your personal contacts and data are utterly secure and NEVER used for debt-collection harassment.
        </p>

        <p className="mb-4 font-bold text-[#5BA9D0]">
          Remember: A legitimate lender will evaluate your capacity to pay, not your capacity to be humiliated.
        </p>
      </>
    )
  },
  'secured-vs-unsecured-business-loans': {
    title: 'Secured vs. Unsecured Loans: Which is Best for Your Biashara?',
    date: 'Mar 28, 2026',
    readTime: '6 min read',
    content: (
      <>
        <p className="mb-4">
          Whether you’re looking to stock up produce for your Duka, repair hardware, or expand your service business, determining the right type of capital is critical. In Kenya, loans generally fall into two categories: Secured and Unsecured.
        </p>
        
        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Unsecured Loans (Instant Mobile Loans)</h3>
        <p className="mb-4">
          These are the popular mobile app loans that do not require any collateral. They rely entirely on your credit history or M-Pesa transaction history.
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
           <li><strong>Pros:</strong> Fast disbursement, no paperwork, zero risk to your assets.</li>
           <li><strong>Cons:</strong> Very low limits (often capped under Ksh 50,000), much higher short-term interest rates, shorter repayment windows (usually 30 days).</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Secured Loans (e.g., Logbook Loans)</h3>
        <p className="mb-4">
          A secured loan is backed by an asset you own. For many Kenyans, the most popular secured loan is the Logbook Loan, where your vehicle acts as the guarantee.
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
           <li><strong>Pros:</strong> You can access massive capital (up to Ksh 1M+ depending on your car"s value), far lower interest rates, and longer repayment periods allowing for healthier business cash flow.</li>
           <li><strong>Cons:</strong> A slightly longer application process (involves valuing the car and placing a tracker), and if you completely default, the lender has the right to auction the asset.</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Which should you choose?</h3>
        <p className="mb-4">
          If you just need Ksh 5,000 to buy emergency stock for the weekend, an <strong>unsecured loan</strong> is quickest. But if you have a massive LPO to supply goods worth Ksh 300,000 and you need reasonable rates to ensure you actually make a profit, leveraging your car for a <strong>secured logbook loan</strong> is the smarter business decision.
        </p>
      </>
    )
  }
};

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = ARTICLES[resolvedParams.slug];

  if (!post) {
    notFound();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main className="flex-1 bg-white">
          <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">
              <Button asChild variant="ghost" className="mb-8 -ml-4 text-muted-foreground hover:text-[#1B2B33]">
                  <Link href="/#blog"><ArrowLeft className="h-4 w-4 mr-2" /> Back to all articles</Link>
              </Button>
              <article>
                  <header className="mb-10 space-y-4">
                      <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground mb-4">
                          <span className="flex items-center"><Calendar className="h-4 w-4 mr-1" /> {post.date}</span>
                          <span className="flex items-center"><Clock className="h-4 w-4 mr-1" /> {post.readTime}</span>
                      </div>
                      <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#1B2B33] leading-tight">
                        {post.title}
                      </h1>
                  </header>
                  <div className="prose prose-lg prose-slate max-w-none text-[#334155] leading-relaxed">
                      {post.content}
                  </div>
              </article>
          </div>
      </main>
      <Footer />
    </div>
  );
}
