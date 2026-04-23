import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  return [
    { slug: 'quick-pesa-loan-kenya' },
    { slug: 'logbook-loan-kenya-guide' },
    { slug: 'salary-advance-loan-kenya' },
    { slug: 'loan-without-payslip-kenya' },
    { slug: 'small-business-loans-kenya-2026' },
    { slug: 'understanding-crb-clearance-kenya' },
    { slug: 'spot-safe-versus-predatory-mobile-lenders' },
    { slug: 'secured-vs-unsecured-business-loans' },
  ];
}

const ARTICLES: Record<string, { title: string; date: string; readTime: string; description: string; content: React.ReactNode }> = {
  'quick-pesa-loan-kenya': {
    title: 'Quick Pesa: How to Get a Fast Loan in Kenya Within Hours',
    date: 'Apr 12, 2026',
    readTime: '4 min read',
    description: 'Need emergency cash fast? Discover how Quick Pesa-style rapid loans work in Kenya, where to apply, and how Pezeka Credit can put money in your hands the same day.',
    content: (
      <>
        <p className="mb-4">
          Life in Kenya rarely gives advance warning. A sick child, a burst pipe, a business opportunity that disappears by morning — these moments demand fast access to cash. That's where Quick Pesa solutions come in: rapid loan products designed to put money in your hand within hours, not days.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">What is a Quick Pesa Loan?</h3>
        <p className="mb-4">
          A Quick Pesa loan is an umbrella term for any fast-disbursement credit facility with a streamlined application, minimal documentation, and rapid approval. Unlike traditional bank loans that involve weeks of vetting, Quick Pesa lenders focus on speed and accessibility — serving salaried employees, traders, and informal workers alike.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">How Fast Can You Get Funds?</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>Mobile Unsecured Loans:</strong> Apps like KCB M-Pesa or Fuliza can disburse in minutes but offer limited amounts (usually under Ksh 50,000).</li>
          <li><strong>Salary Advance Loans:</strong> With your payslip as collateral, a lender like Pezeka Credit can approve and disburse within the same business day.</li>
          <li><strong>Logbook Loans:</strong> Vehicle-backed loans take slightly longer (1–2 days for valuation) but unlock significantly larger amounts.</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Requirements for a Quick Loan at Pezeka</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>National ID or Passport</li>
          <li>Recent payslip OR vehicle logbook (depending on loan type)</li>
          <li>Active M-Pesa registered phone number</li>
          <li>3-month recent bank or M-Pesa statement</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Tips to Speed Up Your Application</h3>
        <ol className="list-decimal pl-6 mb-6 space-y-2">
          <li>Have all documents scanned and ready before you apply.</li>
          <li>Apply early in the day to benefit from same-day processing.</li>
          <li>Ensure your phone number matches the one on your National ID.</li>
          <li>Be upfront about your income source — incorrect information causes delays.</li>
        </ol>

        <div className="bg-[#5BA9D0]/10 p-6 rounded-lg mt-8 mb-4 border border-[#5BA9D0]/20">
          <h4 className="font-bold text-[#1B2B33] mb-2">Get Your Quick Loan at Pezeka Today</h4>
          <p className="text-sm">
            At Pezeka Credit, we've streamlined our process specifically for Kenyans who can't afford to wait. Apply online in minutes, and our team will call you back the same day. Whether it's Ksh 10,000 or Ksh 500,000 — we have a quick solution for you.
          </p>
        </div>
      </>
    )
  },
  'logbook-loan-kenya-guide': {
    title: 'Logbook Loans in Kenya: Unlock Big Capital Using Your Vehicle',
    date: 'Apr 10, 2026',
    readTime: '6 min read',
    description: 'Your car is worth more than you think. Learn exactly how logbook loans work in Kenya, the requirements, interest rates, and how to safely borrow against your vehicle.',
    content: (
      <>
        <p className="mb-4">
          If you own a vehicle in Kenya, you're sitting on one of the most powerful financial assets available to you. A logbook loan — also called a vehicle asset-backed loan — lets you borrow money using your car, motorcycle, or truck as collateral, while you continue using the vehicle throughout the loan term.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">What is a Logbook Loan?</h3>
        <p className="mb-4">
          A logbook loan is a secured credit facility where you temporarily transfer ownership of your vehicle's logbook to the lender. You keep and use the car — only the logbook (vehicle registration document) is held. When you complete repayment, the logbook is returned fully to your name.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">How Much Can You Borrow?</h3>
        <p className="mb-4">
          Most lenders in Kenya will advance between <strong>50% to 80%</strong> of your vehicle's current market value. For example:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>A vehicle worth <strong>Ksh 800,000</strong> could unlock up to <strong>Ksh 560,000</strong></li>
          <li>A vehicle worth <strong>Ksh 1,500,000</strong> could unlock up to <strong>Ksh 1,050,000</strong></li>
          <li>Even commercial vehicles like pickups and matatus qualify</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Logbook Loan Requirements in Kenya</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Original vehicle logbook in your name</li>
          <li>National ID of the registered owner</li>
          <li>Comprehensive or third-party vehicle insurance</li>
          <li>Vehicle valuation (usually arranged by the lender)</li>
          <li>GPS tracker installation (required by most lenders)</li>
          <li>Proof of income or business activity</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Interest Rates &amp; Repayment</h3>
        <p className="mb-4">
          Logbook loan interest rates in Kenya typically range from <strong>3% to 6% per month</strong>, with repayment terms of 3 to 24 months. Always ensure you understand the total cost of borrowing — including valuation fees, tracker installation, and any processing charges — before signing.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Risks to Be Aware Of</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>Repossession:</strong> If you default, the lender has a legal right to repossess and sell your vehicle.</li>
          <li><strong>Stay current on insurance:</strong> A lapse in insurance can be grounds for early recall of the loan.</li>
          <li><strong>Work with registered lenders only</strong> to ensure fair terms and legal protections.</li>
        </ul>

        <div className="bg-[#5BA9D0]/10 p-6 rounded-lg mt-8 mb-4 border border-[#5BA9D0]/20">
          <h4 className="font-bold text-[#1B2B33] mb-2">Logbook Loans at Pezeka Credit</h4>
          <p className="text-sm">
            Pezeka Credit offers transparent, competitive logbook loans with no hidden charges. We conduct free vehicle valuations and our process is designed to get you your funds within 24–48 hours of application. Keep your car, get your cash.
          </p>
        </div>
      </>
    )
  },
  'salary-advance-loan-kenya': {
    title: 'Salary Advance Loans in Kenya: Bridge the Gap Before Payday',
    date: 'Apr 08, 2026',
    readTime: '5 min read',
    description: 'Rent due before your salary arrives? A salary advance loan can save the day. Find out how payslip-backed loans work, who qualifies, and how to apply at Pezeka Credit.',
    content: (
      <>
        <p className="mb-4">
          Payday is still two weeks away but rent is due tomorrow, school fees are calling, or a medical bill has just landed — this is an all-too-familiar situation for Kenya's salaried workers. A salary advance loan is designed specifically to solve this problem: it bridges the income gap by lending you a portion of your salary before pay day arrives.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">How Does a Salary Advance Loan Work?</h3>
        <p className="mb-4">
          A salary advance loan uses your payslip as proof of income and your employer's payment track record as security. The lender advances you a percentage (usually 50%–90%) of your net salary, and the repayment is automatically deducted from your account when your salary arrives, or structured over 1–12 months.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Who Qualifies?</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Any employee with a confirmed, regular salary (government, NGO, corporate, or private sector)</li>
          <li>Minimum monthly salary of Ksh 15,000 (varies by lender)</li>
          <li>At least 3 months in current employment</li>
          <li>A bank account that receives your salary directly</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Documents Required</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>National ID or Passport</li>
          <li>Latest 3 payslips</li>
          <li>Bank statement showing salary credits (last 3–6 months)</li>
          <li>Employment confirmation letter or contract</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Salary Advance vs. Mobile App Loans</h3>
        <p className="mb-4">
          While mobile loans (like M-Shwari or Tala) are convenient, they often charge higher effective interest rates and have lower limits. A salary advance from a microfinance institution like Pezeka Credit offers:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Higher amounts — up to 90% of your net salary</li>
          <li>Longer repayment windows (up to 12 months)</li>
          <li>Lower monthly interest rates compared to mobile apps</li>
          <li>No impact on your CRB score if paid on time — in fact, it builds your credit history</li>
        </ul>

        <div className="bg-[#5BA9D0]/10 p-6 rounded-lg mt-8 mb-4 border border-[#5BA9D0]/20">
          <h4 className="font-bold text-[#1B2B33] mb-2">Salary Advance Loans at Pezeka Credit</h4>
          <p className="text-sm">
            With Pezeka Credit, salaried Kenyans can access up to Ksh 300,000 against their payslip with flexible repayment of up to 12 months. Apply today and receive your funds as early as tomorrow — no office visit required.
          </p>
        </div>
      </>
    )
  },
  'loan-without-payslip-kenya': {
    title: 'How to Get a Loan Without a Payslip in Kenya (2026 Guide)',
    date: 'Apr 04, 2026',
    readTime: '5 min read',
    description: 'Self-employed or in the informal sector? You can still access credit. Explore collateral-based and alternative-income loan options available to Kenyans without a formal payslip.',
    content: (
      <>
        <p className="mb-4">
          Kenya's informal sector employs over 83% of the working population. Yet most traditional lenders still demand a formal payslip — a document that millions of hustlers, traders, freelancers, and entrepreneurs simply don't have. The good news? You have more options than you think.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Why Lenders Ask for Payslips</h3>
        <p className="mb-4">
          A payslip is simply a lender's way of verifying regular income. It answers: "Can this person repay the loan?" If you don't have a payslip, you need to answer that question another way — and there are several legitimate ways to do so.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Loan Options Without a Payslip in Kenya</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            <strong>Logbook Loans:</strong> If you own a vehicle, your car is your payslip. Lenders can advance up to 80% of its value regardless of formal employment status.
          </li>
          <li>
            <strong>M-Pesa Business Loans:</strong> Services like KCB M-Pesa and Fuliza use your M-Pesa transaction history to determine creditworthiness — no payslip required.
          </li>
          <li>
            <strong>Bank Statement-Backed Loans:</strong> A consistent 6-month bank statement showing regular income inflows can substitute for a payslip at many microfinance lenders.
          </li>
          <li>
            <strong>LPO Financing:</strong> If you have a Local Purchase Order from a company or institution, some lenders will advance you funds against that order.
          </li>
          <li>
            <strong>Group/Chama Loans:</strong> Saccos and MCIs (Microfinance Credit Institutions) often lend to chama groups based on collective savings and guarantorship.
          </li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Alternative Documents to Prove Income</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>6-month M-Pesa statement showing consistent transactions</li>
          <li>Business permit or trade license</li>
          <li>KRA PIN certificate showing business activity</li>
          <li>Copy of rental income receipts</li>
          <li>Bank account statements showing regular deposits</li>
        </ul>

        <div className="bg-[#5BA9D0]/10 p-6 rounded-lg mt-8 mb-4 border border-[#5BA9D0]/20">
          <h4 className="font-bold text-[#1B2B33] mb-2">Pezeka Credit: For Kenya's Hustlers</h4>
          <p className="text-sm">
            We know that income in Kenya doesn't always come with a payslip. At Pezeka Credit, we evaluate your actual financial situation — your vehicle, your business activity, your bank history — to give you a fair chance at financing. Talk to us today.
          </p>
        </div>
      </>
    )
  },
  'small-business-loans-kenya-2026': {
    title: 'Best Loan Options for Small Businesses in Kenya in 2026',
    date: 'Apr 02, 2026',
    readTime: '7 min read',
    description: 'From dukas to boda bodas — explore the best financing options for Kenyan SMEs in 2026. Compare mobile loans, logbook loans, and microfinance to find the right fit for your biashara.',
    content: (
      <>
        <p className="mb-4">
          Kenya's small businesses are the engine of its economy. From the roadside mama mboga to the growing IT consultancy in Westlands, access to affordable capital is the single biggest difference between a business that survives and one that thrives. Here's a comprehensive guide to the best loan options for Kenyan SMEs in 2026.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">1. Microfinance Institution (MFI) Loans</h3>
        <p className="mb-4">
          MFIs like Pezeka Credit, Faulu, and Kenya Women Microfinance Bank are specifically designed for small businesses. They offer:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Loan amounts from Ksh 10,000 to Ksh 2,000,000</li>
          <li>Flexible repayment: weekly, monthly, or custom schedules</li>
          <li>Less paperwork than commercial banks</li>
          <li>Business mentorship and support</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">2. Logbook Business Loans</h3>
        <p className="mb-4">
          If your business owns a matatu, truck, pickup, or delivery vehicle, a logbook loan is one of the fastest ways to access working capital. You can use the loan to:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Buy stock in bulk to take advantage of seasonality</li>
          <li>Pay supplier deposits for LPO fulfillment</li>
          <li>Expand your operations or open a new branch</li>
          <li>Purchase additional business equipment</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">3. Government &amp; Development Fund Loans</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>Hustler Fund:</strong> Government-backed micro-credit via M-Pesa from Ksh 500 to Ksh 50,000</li>
          <li><strong>Youth Enterprise Development Fund:</strong> For businesses owned by Kenyans aged 18–35</li>
          <li><strong>Women Enterprise Fund:</strong> Subsidized loans for women-led businesses</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">4. Mobile Business Loans</h3>
        <p className="mb-4">
          For urgent working capital needs under Ksh 100,000, mobile lenders offer convenience but typically charge higher rates. Use them for short-term gaps, not long-term investment.
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Choosing the Right Loan</h3>
        <p className="mb-4">Ask yourself:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>How much do I need?</strong> Small urgent gaps → mobile loans. Big investments → logbook or MFI loans.</li>
          <li><strong>How long can I take to repay?</strong> Longer terms reduce monthly pressure and free up cash flow.</li>
          <li><strong>What's the true cost?</strong> Always calculate the APR (Annual Percentage Rate), not just the monthly rate.</li>
          <li><strong>Do I have collateral?</strong> Collateral unlocks larger amounts at lower rates.</li>
        </ul>

        <div className="bg-[#5BA9D0]/10 p-6 rounded-lg mt-8 mb-4 border border-[#5BA9D0]/20">
          <h4 className="font-bold text-[#1B2B33] mb-2">Grow Your Biashara with Pezeka Credit</h4>
          <p className="text-sm">
            Pezeka Credit specializes in powering Kenyan SMEs. Whether you're a trader, transporter, or service provider, we have a tailored loan product to match your cash flow. Apply online today and talk to a business credit specialist within the hour.
          </p>
        </div>
      </>
    )
  },
  'understanding-crb-clearance-kenya': {
    title: 'Understanding CRB Clearance: How to Check Your Status in Kenya',
    date: 'Apr 06, 2026',
    readTime: '5 min read',
    description: 'Demystify Credit Reference Bureaus and learn the steps to check your credit status, rebuild your score, and unlock better lending rates in Kenya.',
    content: (
      <>
        <p className="mb-4">
          For many Kenyans, the phrase &quot;CRB listed&quot; is synonymous with financial doom. However, understanding what the Credit Reference Bureau (CRB) actually does can demystify the process and even work to your advantage when applying for loans online.
        </p>
        
        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">What is the CRB?</h3>
        <p className="mb-4">
          The CRB is a firm that collects data from various financial institutions regarding loans. They gather information on how individuals repay their debts and provide this data to lenders to help them assess creditworthiness. In Kenya, being &quot;listed&quot; simply means you have a credit file — it can be a positive listing (you pay on time) or a negative listing (you default on payments).
        </p>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">How to Check Your CRB Status</h3>
        <p className="mb-4">You are legally entitled to one free credit report per year from any licensed CRB in Kenya, such as Metropol, TransUnion, or Creditinfo.</p>
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
            At Pezeka, we believe in giving our customers an opportunity to rebuild. We perform fair assessments and specialize in logbook loans and salary advances where your collateral or payslip can act as a guarantee, even if your CRB score isn&apos;t perfect.
          </p>
        </div>
      </>
    )
  },
  'spot-safe-versus-predatory-mobile-lenders': {
    title: 'How to Spot Safe Mobile Lenders vs. Predatory Apps',
    date: 'Mar 28, 2026',
    readTime: '4 min read',
    description: 'Avoid unregulated digital lenders and data-shaming traps. Learn how to verify legitimate lenders registered under the Data Protection Act for safe borrowing.',
    content: (
      <>
        <p className="mb-4">
          The rise of digital lending in Kenya has brought unprecedented convenience. However, it has also given rise to predatory loan apps that exploit desperate borrowers using aggressive and illegal debt-shaming tactics.
        </p>
        
        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Signs of a Predatory Lender</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
           <li><strong>Excessive Permissions:</strong> They explicitly demand complete access to your phone's contacts, photo gallery, and call logs during installation.</li>
           <li><strong>Debt Shaming:</strong> They threaten to call or text everyone in your contact list if you default by even one day to embarrass you into paying.</li>
           <li><strong>Hidden Fees:</strong> They deduct massive "processing fees" upfront and charge exorbitant daily late fees that spiral out of control.</li>
           <li><strong>Unregistered:</strong> They are not licensed by the Central Bank of Kenya (CBK) or the Office of the Data Protection Commissioner (ODPC).</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">How to Verify a Safe Lender</h3>
        <p className="mb-4">
          Before applying for any online loan, visit the CBK website to review the directory of licensed Digital Credit Providers (DCPs). Legitimate lenders like Pezeka Credit adhere strictly to the Data Protection Act — meaning your personal contacts and data are utterly secure and NEVER used for debt-collection harassment.
        </p>

        <p className="mb-4 font-bold text-[#5BA9D0]">
          Remember: A legitimate lender will evaluate your capacity to pay, not your capacity to be humiliated.
        </p>
      </>
    )
  },
  'secured-vs-unsecured-business-loans': {
    title: 'Secured vs. Unsecured Loans: Which is Best for Your Biashara?',
    date: 'Mar 22, 2026',
    readTime: '6 min read',
    description: 'Should you use your vehicle logbook to secure a loan? We compare secured and unsecured credit facilities to help you choose the best growth engine for your SME.',
    content: (
      <>
        <p className="mb-4">
          Whether you're looking to stock up produce for your Duka, repair hardware, or expand your service business, determining the right type of capital is critical. In Kenya, loans generally fall into two categories: Secured and Unsecured.
        </p>
        
        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Unsecured Loans (Instant Mobile Loans)</h3>
        <p className="mb-4">These are the popular mobile app loans that do not require any collateral.</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
           <li><strong>Pros:</strong> Fast disbursement, no paperwork, zero risk to your assets.</li>
           <li><strong>Cons:</strong> Very low limits (often capped under Ksh 50,000), much higher short-term interest rates, shorter repayment windows (usually 30 days).</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Secured Loans (e.g., Logbook Loans)</h3>
        <p className="mb-4">
          A secured loan is backed by an asset you own. For many Kenyans, the most popular secured loan is the Logbook Loan, where your vehicle acts as the guarantee.
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
           <li><strong>Pros:</strong> Massive capital access (up to Ksh 1M+ depending on vehicle value), far lower interest rates, longer repayment periods for healthier business cash flow.</li>
           <li><strong>Cons:</strong> A slightly longer application process (vehicle valuation and tracker installation), and if you completely default, the lender may auction the asset.</li>
        </ul>

        <h3 className="text-2xl font-bold mt-8 mb-4 text-[#1B2B33]">Which should you choose?</h3>
        <p className="mb-4">
          If you just need Ksh 5,000 to buy emergency stock for the weekend, an <strong>unsecured loan</strong> is quickest. But if you have a massive LPO to supply goods worth Ksh 300,000 and you need reasonable rates to ensure you actually make a profit, leveraging your car for a <strong>secured logbook loan</strong> is the smarter business decision.
        </p>
      </>
    )
  }
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = ARTICLES[slug];
  if (!post) return { title: 'Article Not Found | Pezeka Credit' };
  return {
    title: `${post.title} | Pezeka Credit Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      siteName: 'Pezeka Credit',
    },
  };
}

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

              <div className="mt-16 pt-8 border-t">
                  <h3 className="text-xl font-bold text-[#1B2B33] mb-4">Ready to Apply?</h3>
                  <p className="text-muted-foreground mb-6">Pezeka Credit offers fast, transparent loans for salaried employees and business owners across Kenya. Apply in minutes — no office visit required.</p>
                  <Button asChild className="bg-[#5BA9D0] hover:bg-[#4a95ba] text-white">
                      <Link href="/#apply">Apply for a Loan Today</Link>
                  </Button>
              </div>
          </div>
      </main>
      <Footer />
    </div>
  );
}
