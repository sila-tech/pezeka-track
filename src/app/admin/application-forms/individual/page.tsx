'use client';

import { Button } from '@/components/ui/button';
import { Printer, Home } from 'lucide-react';
import Link from 'next/link';

const FormLine = ({ label, className }: { label: string; className?: string }) => (
  <div className={`flex items-end mt-4 ${className}`}>
    <span className="font-medium whitespace-nowrap text-sm">{label}</span>
    <span className="w-full border-b border-black ml-2"></span>
  </div>
);

const Checkbox = ({ label }: { label: string }) => (
  <span className="mr-4 text-sm">
    <span className="inline-block w-4 h-4 border border-black mr-1 align-middle -mb-0.5"></span>
    {label}
  </span>
);

export default function ApplicationFormPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-gray-100">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-area, #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            padding: 0;
            margin: 0;
          }
          .no-print {
            display: none;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
        }
        .page-break {
            page-break-before: always;
        }
      `}</style>
      <div className="max-w-4xl mx-auto bg-white shadow-lg">
        <header className="flex justify-between items-center p-4 border-b no-print">
            <Button variant="outline" asChild>
                <Link href="/admin/application-forms">
                    <Home className="mr-2 h-4 w-4" />
                    Back to Forms
                </Link>
            </Button>
            <h1 className="text-xl font-bold text-gray-800">Individual Loan Application</h1>
            <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Save as PDF
            </Button>
        </header>

        <div id="printable-area" className="p-8 text-black">
          {/* Page 1 */}
          <div>
            <div className="flex flex-col items-center text-center mb-4">
              <img src="/pezeka_logo_transparent.png" alt="Pezeka Logo" className="h-20 w-20 mb-2 object-contain" />
              <h1 className="text-xl font-bold uppercase">Pezeka Limited</h1>
              <p className="font-semibold">Affordable Credit, Real Opportunities</p>
              <p className="text-sm">Email: pezekalimited@gmail.com | Phone: +254 757 664047</p>
            </div>
            <hr className="border-t-2 border-black my-4" />

            <h2 className="text-lg font-bold text-center mb-2 uppercase">Individual Short-Term Loan Application Form</h2>
            <div className="flex justify-between text-sm mb-4">
              <div className="w-2/3"><FormLine label="Official’s Name" /></div>
              <div className="w-1/3 ml-4"><FormLine label="Loan A/C No." /></div>
            </div>

            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">1. CLIENT’S PERSONAL INFORMATION</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <FormLine label="Name" />
                  <div className="flex"><FormLine label="ID/Passport No." className="w-1/2" /><FormLine label="PIN" className="w-1/2 ml-2" /></div>
                  <FormLine label="Date of Birth" />
                  <div className="mt-4 text-sm"><span className="font-medium">Marital Status:</span> <Checkbox label="Single" /> <Checkbox label="Married" /> <Checkbox label="Widowed" /> <Checkbox label="Divorced" /> <Checkbox label="Other" /></div>
                  <FormLine label="Mobile" />
                  <FormLine label="Estate" />
                  <FormLine label="Telephone (landline)" />
                  <FormLine label="Telephone (mobile)" />
                  <div className="mt-4 text-sm"><span className="font-medium">Sex:</span> <Checkbox label="Male" /> <Checkbox label="Female" /></div>
                  <FormLine label="Children/Dependents" />
                  <div className="mt-4 text-sm"><span className="font-medium">House Status:</span> <Checkbox label="Rented" /> <Checkbox label="Owned" /></div>
                  <div className="col-span-2"><FormLine label="House Address (Attach sketch map)" /></div>
                  <div className="col-span-2"><FormLine label="Workplace" /></div>
              </div>
            </section>

            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">2. BUSINESS DETAILS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <FormLine label="Business Name" />
                  <FormLine label="Business Location" />
                  <FormLine label="Type of Business" />
                  <FormLine label="Business Permit/Receipts" />
                  <div className="col-span-2"><FormLine label="Physical Address" /></div>
                  <div className="mt-4 text-sm"><span className="font-medium">Terms:</span> <Checkbox label="Permanent Rented" /> <Checkbox label="Online" /></div>
                  <FormLine label="Length of Service" />
              </div>
            </section>
            
            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">3. LOAN PARTICULARS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <FormLine label="Amount Required (Ksh)" />
                  <FormLine label="Repayment period" />
                  <FormLine label="Purpose" />
                  <FormLine label="Monthly repayments" />
              </div>
            </section>
            
            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">4. ACCOUNT IN OTHER BANKS / FINANCIAL INSTITUTIONS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <FormLine label="Bank" /><FormLine label="Branch" />
                  <FormLine label="Own Contribution (Ksh)" /><FormLine label="Monthly Payments (Ksh)" />
                  <FormLine label="Status" /><FormLine label="Outstanding Amount" />
                  <FormLine label="Repayment Period" /><FormLine label="Date Disbursed" />
              </div>
            </section>

            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">5. SECURITY DETAILS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <FormLine label="Type" /><FormLine label="Details" />
                  <FormLine label="Estimated Value" />
              </div>
              <p className="text-sm mt-2">Attach business and household photos</p>
            </section>
            
            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">6. REFEREES</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  <div><p className="font-medium text-sm">1.</p><FormLine label="Name" /><FormLine label="Address" /><FormLine label="Telephone" /><FormLine label="Relationship" /></div>
                  <div><p className="font-medium text-sm">2.</p><FormLine label="Name" /><FormLine label="Address" /><FormLine label="Telephone" /><FormLine label="Relationship" /></div>
              </div>
            </section>
            
            <section>
              <h3 className="font-bold bg-gray-200 p-1 text-sm">7. DECLARATION</h3>
              <p className="text-sm my-2">I declare that the information given herein is true to the best of my knowledge and belief and I/we authorize Pezeka Limited to verify this information and to deduct it from my personal account when due.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 mt-4">
                  <FormLine label="Loan Officer Name" /><FormLine label="Signature" /><FormLine label="Date" />
              </div>
            </section>
          </div>
          
          {/* Page 2 */}
          <div className="page-break">
            <h2 className="text-lg font-bold text-center mb-2 mt-8 uppercase">Individual Loan Appraisal Form</h2>
            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">1. NEXT OF KIN DETAILS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <FormLine label="Name" /><FormLine label="Mobile No. 1" />
                  <FormLine label="Mobile No. 2" /><FormLine label="Relationship" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 mt-4">
                  <FormLine label="Signature" /><FormLine label="Date" />
              </div>
            </section>
            
            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">2. CREDIT HISTORY</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
                  <FormLine label="Amount Granted" /><FormLine label="Period" /><FormLine label="Status" />
              </div>
              <FormLine label="Customer Review" className="mt-2" />
            </section>
            
            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">3. OTHER ECONOMIC INFORMATION</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <div className="col-span-2"><FormLine label="Other Income Generating Activities"/></div>
                  <FormLine label="Amount (KShs)" /><FormLine label="Period" />
                  <div className="col-span-2"><FormLine label="Performance" /></div>
              </div>
            </section>

            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">4. EXPENSES (BUSINESS AND HOUSEHOLD)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <FormLine label="Rent" /><FormLine label="Transport" />
                  <FormLine label="Telephone, Electricity" /><FormLine label="Utilities" />
                  <FormLine label="Education, Medical" /><FormLine label="Other Entertainment" />
              </div>
              <FormLine label="Total Amount (KShs)" className="mt-2" />
            </section>

            <section>
              <h3 className="font-bold bg-gray-200 p-1 text-sm">5. APPROVAL ENDORSEMENT</h3>
              <p className="text-sm my-2">NB: Supply copy of residence or business where applicable.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <FormLine label="Net Surplus/Deficit (KShs)" /><FormLine label="Credit Officer" />
                  <FormLine label="Signature" /><FormLine label="Date" />
              </div>
              <div className="text-sm mt-4"><Checkbox label="Approved" /><Checkbox label="Rejected" /></div>
              <p className="font-medium mt-4 text-sm">Credit Committee:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 mt-2">
                  <FormLine label="Name" /><FormLine label="Signature" /><FormLine label="Date" />
              </div>
            </section>
          </div>
          
          {/* Page 3 */}
          <div className="page-break">
            <section className="my-8">
              <h2 className="text-lg font-bold text-center mb-4 uppercase">Pezeka Data Protection Clause</h2>
              <div className="text-xs space-y-2 border p-4">
                <p>Pezeka Limited is committed to ensuring that your personal data is protected from loss, misuse, unauthorized access, disclosure, alteration, or destruction in line with the provisions of the Data Protection Act, 2019 and its subsequent regulations.</p>
                <p>By signing this form, you acknowledge that you have read and understood the contents of this clause and that you give your consent to the collection, use, and disclosure of your personal data as described herein.</p>
                <p>Personal data collected includes but is not limited to your name, identification number, contact details, financial information, employment details, and any other information relevant to the loan application and management process.</p>
                <p>We collect your personal data to:</p>
                <ul className="list-disc list-inside pl-4"><li>Assess your creditworthiness and eligibility for a loan</li><li>Manage your loan account and provide customer support</li><li>Comply with legal and regulatory requirements</li><li>Conduct internal audits and quality checks</li><li>Improve our services and develop new products</li><li>Communicate with you about your loan and other products and services</li><li>Prevent fraud and other criminal activities</li><li>Share with third parties such as credit reference bureaus, regulatory authorities, and service providers within their legal mandates</li><li>Any other purpose necessary for the performance of our contract with you</li></ul>
                <p>We will retain your personal data for as long as necessary to fulfill the purposes for which it was collected or as required by law.</p>
                <p>You have the right to access, correct, or delete your personal data, object to or restrict its processing, and lodge a complaint with the Data Protection Commissioner.</p>
                <p>Pezeka Limited will ensure that appropriate technical and organizational measures are in place to protect your personal data.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 pt-4">
                    <FormLine label="Client Signature" /><FormLine label="Date" />
                </div>
              </div>
            </section>

            <hr className="border-t-2 border-black my-4" />

            <section>
              <h2 className="text-lg font-bold text-center mb-2 uppercase">Loan Agreement/Declarations and Undertakings</h2>
              <p className="text-sm my-2">This is a formal declaration between the borrower and Pezeka Limited, a duly registered company. Pezeka agrees to advance a loan to the borrower and the borrower agrees to the following terms and conditions:</p>
              <div className="text-sm space-y-1">
                  <FormLine label="Loan amount borrowed: Ksh" />
                  <div className="flex items-baseline"><span className="font-medium whitespace-nowrap text-sm">Interest rate:</span><span className="w-24 border-b border-black mx-2"></span><span className="font-medium whitespace-nowrap text-sm">% per month</span></div>
                  <FormLine label="Proposed total Amount Payable: Ksh" />
                  <FormLine label="Monthly Instalment Payable" />
                  <div className="mt-2"><span className="font-medium">Repayment plan:</span> <Checkbox label="Weekly" /> <Checkbox label="Monthly" /> <Checkbox label="Fortnightly" /></div>
                  <div className="mt-2"><span className="font-medium">Mode of repayment:</span> <Checkbox label="Mpesa" /> <Checkbox label="Cheque" /> <Checkbox label="RTGS" /></div>
              </div>
              <div className="text-sm my-4">
                  <p className="font-bold">Borrower’s Undertakings:</p>
                  <ol className="list-decimal list-inside space-y-1 pl-4"><li>I agree to repay the loan and any penalties by paying the outstanding balance plus any interest due.</li><li>I understand that penalties will be based on the outstanding balance.</li><li>I confirm that the loan is for the purposes indicated in the application.</li><li>I understand that Pezeka Limited may deduct applicable fees from the loan disbursement.</li><li>I authorize Pezeka Limited to recover the loan from my savings or collateral.</li><li>I understand that failure to repay may result in legal action or asset recovery.</li><li>I confirm that I have read and understood the terms and conditions of this agreement.</li></ol>
              </div>

              <div className="mt-8">
                  <h3 className="font-bold text-center uppercase">Signatures</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 mt-4">
                      <FormLine label="Applicant’s Name" /><FormLine label="Signature" /><FormLine label="Date" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 mt-4">
                      <FormLine label="Guarantor’s Name" /><FormLine label="Signature" /><FormLine label="Date" />
                  </div>
              </div>
            </section>
          </div>

          {/* Page 4 */}
          <div className="page-break">
            <section className="mt-8 text-center text-sm">
                <p>Payments by clients to Pezeka Limited should be made by Bank deposit:</p>
                <p className="font-bold mt-2">Kenya Commercial Bank Account: [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</p>
                <p className="font-bold mt-2">M-Pesa PayBill Number: ( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ) (Account no: Borrower ID)</p>
                <p className="font-bold text-red-600 mt-4">UNDER NO CIRCUMSTANCES SHOULD A CLIENT MAKE ANY PAYMENT DIRECTLY TO A LOAN OFFICER, AGENT OR ANY STAFF MEMBER.</p>
                <p className="font-bold mt-2">Call +254 757 664047 FOR ANY ENQUIRIES.</p>
            </section>

            <section className="mt-8 space-y-8">
                <div><h3 className="font-bold text-center mb-2 uppercase">Applicant’s Residence Map</h3><div className="h-64 border-2 border-dashed border-gray-400 rounded-md"></div></div>
                <div><h3 className="font-bold text-center mb-2 uppercase">Applicant’s Business Map</h3><div className="h-64 border-2 border-dashed border-gray-400 rounded-md"></div></div>
                <div><h3 className="font-bold text-center mb-2 uppercase">Guarantors’ Residence Map</h3><div className="h-64 border-2 border-dashed border-gray-400 rounded-md"></div></div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
