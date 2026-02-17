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

const Checkbox = ({ label, className }: { label?: string; className?:string }) => (
  <span className={`mr-4 text-sm ${className}`}>
    <span className="inline-block w-4 h-4 border border-black mr-1 align-middle -mb-0.5"></span>
    {label && label}
  </span>
);

export default function SalaryLoanApplicationFormPage() {
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
                <Link href="/dashboard/application-forms">
                    <Home className="mr-2 h-4 w-4" />
                    Back to Forms
                </Link>
            </Button>
            <h1 className="text-xl font-bold text-gray-800">Salary Loan Application Form</h1>
            <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Save as PDF
            </Button>
        </header>

        <div id="printable-area" className="p-8 text-black text-xs">
          {/* Page 1 */}
          <div>
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold uppercase">PEZEKA LTD</h1>
              <p className="font-semibold">AFFORDABLE CREDIT, REAL OPPORTUNITIES</p>
              <p className="text-sm">Location: Juja, Kenya | Email: pezekalimited@gmail.com | Phone: 0757 664 047</p>
            </div>
            <hr className="border-t-2 border-black my-4" />

            <h2 className="text-md font-bold text-center mb-2 uppercase">Salary Loan Application Form</h2>
            <div className="flex justify-between text-sm mb-4">
              <FormLine label="Form No:" className="w-1/3"/>
              <FormLine label="Date:" className="w-1/3"/>
            </div>
            <div className="flex justify-center space-x-4 my-2">
                <Checkbox label="New Application" />
                <Checkbox label="Top-up" />
                <Checkbox label="Re-finance" />
                <Checkbox label="2nd/3rd/4th Loan" />
            </div>
            <p className="text-xs text-center font-medium">Note: The Borrower hereby undertakes not to append their signature until all fields are duly completed.</p>
            <hr className="border-t border-black my-2" />
            
            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">1. BORROWER’S PERSONAL DETAILS</h3>
              <div className="grid grid-cols-2 gap-x-4">
                  <FormLine label="Surname" />
                  <FormLine label="Other Names" />
                  <FormLine label="ID/Passport Number" />
                  <FormLine label="Age" />
                  <FormLine label="Residential Address" />
                  <FormLine label="House/L.R. No." />
                  <FormLine label="Estate" />
                  <FormLine label="Road/Street" />
                  <FormLine label="Town" />
                  <div className="flex"><FormLine label="P.O. Box" className="w-1/2" /><FormLine label="Code" className="w-1/4 ml-2" /><FormLine label="Town" className="w-1/4 ml-2" /></div>
                  <FormLine label="Employer" />
                  <FormLine label="Station" />
                  <FormLine label="County" />
                  <FormLine label="Date of Employment" />
                  <FormLine label="Employee No." />
                  <FormLine label="Employer/HR/Supervisor sign" />
                  <FormLine label="Employer Phone number" />
              </div>
               <div className="mt-4 text-sm"><span className="font-medium">Marital Status:</span> <Checkbox label="Single" /> <Checkbox label="Married" /> <Checkbox label="Divorced" /></div>
               <div className="mt-2">
                   <p className="font-medium text-sm">Spouse Details:</p>
                   <div className="grid grid-cols-3 gap-x-4">
                        <FormLine label="Name" />
                        <FormLine label="ID" />
                        <FormLine label="Telephone" />
                   </div>
               </div>
               <FormLine label="Client signature" className="mt-4"/>
            </section>

            <section className="mb-4">
              <h3 className="font-bold bg-gray-200 p-1 text-sm">2. NEXT OF KIN / ALTERNATIVE CONTACT DETAILS</h3>
              <div className="flex space-x-4 my-2"><Checkbox label="Next of Kin" /> <Checkbox label="Alternative Contact" /></div>
              <div className="grid grid-cols-2 gap-x-4">
                <FormLine label="Relationship" />
                <FormLine label="Full Name" />
                <FormLine label="ID Number" />
                <FormLine label="Residential Address" />
                <FormLine label="Estate" />
                <FormLine label="Road/Street" />
                <FormLine label="Town" />
                <div className="flex"><FormLine label="P.O. Box" className="w-1/2" /><FormLine label="Code" className="w-1/4 ml-2" /><FormLine label="Town" className="w-1/4 ml-2" /></div>
                <FormLine label="Telephone No." />
                <FormLine label="Personal Email" />
                <FormLine label="Office Email" />
              </div>
              <FormLine label="Next of kin signature" className="mt-4"/>
            </section>

            <section>
              <h3 className="font-bold bg-gray-200 p-1 text-sm">3. PREFERRED LOAN TERM</h3>
              <table className="w-full text-left border-collapse border border-black mt-2 text-xs">
                  <thead>
                      <tr className="bg-gray-100">
                          <th className="border border-black p-1">Loan Term (Months)</th>
                          <th className="border border-black p-1">Appraisal & Processing Fee</th>
                          <th className="border border-black p-1">Monthly Interest Rate</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr><td className="border border-black p-1">Not more than 12 months</td><td className="border border-black p-1">10%</td><td className="border border-black p-1">______________ (loans between 30k-60k)</td></tr>
                      <tr><td className="border border-black p-1">Secured Loans</td><td className="border border-black p-1">10%</td><td className="border border-black p-1">______________(loans between 60k-2M)</td></tr>
                      <tr><td className="border border-black p-1">Centre Loans</td><td className="border border-black p-1">10%</td><td className="border border-black p-1">___________(loans between 10k-30k)</td></tr>
                  </tbody>
              </table>
            </section>
          </div>
          
          {/* Page 2 */}
          <div className="page-break mt-8">
            <section className="mb-4">
                <h3 className="font-bold bg-gray-200 p-1 text-sm">4A. LOAN AMOUNT IN WORDS/FIGURES</h3>
                <FormLine label="Loan Amount in Words" />
                <FormLine label="Loan Amount in Figures" />
            </section>

            <section className="mb-4">
                <h3 className="font-bold bg-gray-200 p-1 text-sm">5A. APPLIED LOAN DETAILS</h3>
                <div className="grid grid-cols-2 gap-x-4">
                    <FormLine label="Loan amount: Kshs" />
                    <FormLine label="Loan tenor (months)" />
                    <FormLine label="Monthly interest rate" />
                    <FormLine label="Monthly installment amount: Kshs" />
                    <FormLine label="Monthly repayment date" />
                    <div className="flex items-center mt-4"><span className="font-medium text-sm">Mode of payment:</span><div className="ml-2 flex space-x-2"><Checkbox label="Check-off" /><Checkbox label="M-pesa" /><Checkbox label="Bank" /></div></div>
                    <FormLine label="Total expected repayment amount: Kshs" className="col-span-2"/>
                </div>
            </section>

            <section className="mb-4">
                <h3 className="font-bold bg-gray-200 p-1 text-sm">5B. LOAN ORIGINATION COSTS</h3>
                <div className="grid grid-cols-2 gap-x-4">
                    <FormLine label="Appraisal fee: Kshs" />
                    <FormLine label="Monthly collection fee: Kshs" />
                    <FormLine label="Processing fee: Kshs" />
                    <FormLine label="Legal/Registration fee: Kshs" />
                </div>
                 <p className="text-xs mt-2">Note: All fees shall be deducted upon disbursement apart from monthly collection fee.</p>
            </section>

             <section className="mb-4">
                <h3 className="font-bold bg-gray-200 p-1 text-sm">5C. PURPOSE OF THE LOAN</h3>
                <div className="flex flex-wrap mt-2">
                    <Checkbox label="Business"/>
                    <Checkbox label="Education"/>
                    <Checkbox label="Medical"/>
                    <Checkbox label="Asset Purchase"/>
                    <Checkbox label="Loan Refinancing"/>
                    <Checkbox label="Housing Development"/>
                    <Checkbox label="Agriculture"/>
                    <FormLine label="Other (Specify)" className="w-full mt-2"/>
                </div>
            </section>

            <section className="mb-4">
                <h3 className="font-bold bg-gray-200 p-1 text-sm">6. APPROVED LOAN DETAILS</h3>
                <div className="grid grid-cols-2 gap-x-4">
                    <FormLine label="Loan amount approved: Kshs" />
                    <FormLine label="Monthly installment amount: Kshs" />
                    <FormLine label="Number of installments" />
                    <div className="flex items-center mt-4"><span className="font-medium text-sm">Frequency of installments:</span><Checkbox label="Monthly" className="ml-2"/></div>
                    <div className="flex items-center mt-4"><span className="font-medium text-sm">Mode of repayment:</span><Checkbox label="Check-off" className="ml-2"/></div>
                    <FormLine label="Approved by" />
                    <FormLine label="Supervisor’s Name" />
                    <FormLine label="Supervisor’s Signature" />
                    <FormLine label="Date" />
                    <FormLine label="Sales Agent Name" />
                    <FormLine label="Sales Agent’s Signature" />
                    <FormLine label="Cellphone No." />
                    <FormLine label="Date" />
                </div>
                <div className="mt-4">
                    <p className="font-medium text-sm">Borrower’s Acknowledgment:</p>
                    <p className="text-xs my-1">I confirm that I have understood and agreed to the approved loan details indicated above.</p>
                    <div className="grid grid-cols-4 gap-x-2">
                        <FormLine label="Client Name"/>
                        <FormLine label="ID No"/>
                        <FormLine label="Signature"/>
                        <FormLine label="Date"/>
                    </div>
                </div>
            </section>

            <section className="mb-4">
                <h3 className="font-bold bg-gray-200 p-1 text-sm">7. EMPLOYER CONFIRMATION</h3>
                <p className="text-xs my-1">We confirm that the applicant is employed on permanent and pensionable terms or contract, has not applied for early retirement, is not due for retirement during the loan period, and has no pending disciplinary cases.</p>
                <div className="grid grid-cols-2 gap-x-4">
                    <FormLine label="Name of the institution" />
                    <FormLine label="Staff Rank" />
                    <FormLine label="Email Address" />
                    <FormLine label="Signature of the supervisor" />
                    <FormLine label="Department" />
                    <FormLine label="Supervisor’s Rank" />
                    <FormLine label="Date & Stamp" />
                </div>
            </section>
            
            <section>
                <h3 className="font-bold bg-gray-200 p-1 text-sm">AGENT DECLARATION</h3>
                <p className="text-xs my-1">I ____________________________, hereby confirm that____________________________ of ID No _________________________voluntarily executed the loan agreement and committed to timely loan repayment. I further confirm that I have verified that the passport affixed herein above is a true likeness of the borrower, the copy of National ID card/Passport is a true copy of the original, and that the employer confirmation was signed by a duly authorized officer. I accept responsibility for any anomalies arising out of negligence in respect to this application.</p>
                <div className="grid grid-cols-3 gap-x-4">
                    <FormLine label="Name" />
                    <FormLine label="Signature" />
                    <FormLine label="Date" />
                </div>
                <div className="flex items-center mt-2"><span className="font-medium text-sm">Customer Rating:</span><div className="ml-2 flex space-x-2"><Checkbox label="High Confidence" /><Checkbox label="Normal Confidence" /><Checkbox label="Low Confidence" /><Checkbox label="Fraud" /></div></div>
                <FormLine label="Required Attachments" className="mt-2" />
            </section>
          </div>

          {/* Page 3 */}
          <div className="page-break mt-8">
            <h2 className="text-md font-bold text-center mb-2 uppercase">Loan Agreement Terms and Conditions</h2>
            <p className="text-xs font-bold text-center">Note: No cash should be paid to any Pezeka agent or employee.</p>
            <div className="text-xs space-y-2 mt-2">
                <div><p className="font-bold">1. Loan Amount</p><p>1.1 The Borrower agrees that upon execution of this agreement, Pezeka shall make available the loan amount as shown in the Salary Based Loan Application Form.</p><p>1.2 The Borrower agrees that Pezeka Limited shall recover any unpaid portion of the loan plus accrued fees, interest, costs of recovery, and other charges from salary or other sources.</p></div>
                <div><p className="font-bold">2. Interest</p><p>2.1 Monthly interest payable is calculated at flat rate on the principal plus capitalized fees, subject to reducing balance up to 18%.</p><p>2.2 Repayments follow IFRS standards.</p><p>2.3 Accounts past loan term accrues full interest.</p><p>2.4 Prepayment incurs full processing fees.</p><p>2.5 Interest may be altered with one month’s notice.</p></div>
                <div><p className="font-bold">3. Repayment</p><p>3.1 Borrower must repay installments as per the application form.</p><p>3.2 Pezeka Limited may deduct installments directly from salary.</p><p>3.3 Borrower authorizes deductions from wages or benefits if employment ceases before full repayment.</p><p>3.4 Borrower liable for outstanding repayments in case of default.</p><p>3.5 All repayments must be made via official Pezeka Limited channels.</p><p>3.6 Electronic payments are deemed received when cleared.</p></div>
                <p><span className="font-bold">Costs and Charges:</span> Borrower bears legal fees if obligations are not met. Account closure incurs Ksh 300 fee. Penalties of Ksh 200 per month apply. Takeover charges of Ksh 10,000 apply for loans above Ksh 10,000.</p>
                <p><span className="font-bold">4. Taxes:</span> Borrower responsible for all applicable taxes.</p>
                <p><span className="font-bold">5. Insurance:</span> Credit Life Insurance mandatory. Covers permanent disability or death (excluding suicide). Proof required.</p>
                <p><span className="font-bold">6. Default and Recovery:</span> Failure to pay, breach, death, or insolvency may result in termination and full recovery. Payments applied first to legal costs, then interest, then principal. Third-party debt collectors may be appointed. Statements issued by Pezeka Limited are conclusive unless proven otherwise.</p>
                <p><span className="font-bold">7. General Provisions:</span> This agreement is the full agreement. Amendments must be in writing. Borrower enters voluntarily. Pezeka Limited may deduct from salary or other sources. Borrower authorizes access to credit information and reporting to CRBs.</p>
                <p><span className="font-bold">8. Data Protection Policy:</span> Borrower consents to data processing per the Data Protection Act, 2019. Data may be shared with CRBs, regulators, law enforcement, service providers, and other authorized parties. Data may be held for up to 7 years post-loan. Borrower may exercise rights to access, correct, object, or transfer data.</p>
                <p><span className="font-bold">9. Loan Cancellation:</span> Borrower may cancel before or after disbursement. If after disbursement, funds, disbursement fee included must be refunded within 72 hours with written notice and proof.</p>
                <p><span className="font-bold">10. Dispute Resolution:</span> Disputes may be raised via email or call center. If unresolved, arbitration applies. Arbitrator’s award is final and binding. Payments must continue during dispute resolution.</p>
                <p><span className="font-bold">11. Consolidation and Recovery:</span> Borrower authorizes Pezeka Limited to consolidate loans and recover through salary deductions, direct customer, employer and guarantors’ remittance. Attached loan securities and assets.</p>
                <p><span className="font-bold">Governing Law:</span> This agreement is governed by Kenyan law and subject to Kenyan courts.</p>
            </div>
          </div>

          {/* Page 4 */}
          <div className="page-break mt-8">
            <h3 className="font-bold text-center">STATUTORY DECLARATION</h3>
            <p className="text-xs text-center">Republic of Kenya</p>
            <p className="text-xs text-center">In the Matter of Oaths and Statutory Declaration Act (Cap 15 of the Laws of Kenya)</p>
            <p className="mt-4">I, ____________________________________________ of P.O. Box ____________________________ in the Republic of Kenya, do solemnly declare as follows:</p>
            <ol className="list-decimal list-inside space-y-1 mt-2 text-xs">
                <li>THAT I am a Kenyan adult of sound mind and holder of National ID No. ______________________.</li>
                <li>THAT the personal details and evidence provided in the loan application form are true.</li>
                <li>THAT I have read and understood the terms and conditions of the loan facility.</li>
                <li>THAT I authorize Pezeka Limited to contact my employer, next of kin, or alternative contact in case of default.</li>
                <li>THAT I acknowledge liability for any outstanding loan balance.</li>
                <li>THAT I have provided all necessary documentation including ID, pay slips, bank/M-Pesa statements, and logbook (where applicable).</li>
                <li>THAT I voluntarily sign this declaration in full knowledge of its legal implications.</li>
            </ol>
            <p className="mt-4">Declared at ____________________________ this _______ day of ___________ 20____.</p>
            <div className="grid grid-cols-2 gap-x-8 mt-4">
                <div>
                    <FormLine label="Borrower Name"/>
                    <FormLine label="Signature"/>
                    <FormLine label="Date"/>
                </div>
                <div>
                    <p className="font-medium">Witness (Pezeka Limited Representative):</p>
                    <FormLine label="Name"/>
                    <FormLine label="Signature"/>
                    <FormLine label="Date"/>
                </div>
            </div>
            
            <hr className="border-t-2 border-black my-4" />

            <h3 className="font-bold text-center uppercase">Republic of Kenya: Applicants(A) & Guarantors(B) Schedule of Properties</h3>
            <div className="mt-2">
                <p className="font-bold">A. APPLICANT'S PROPERTIES</p>
                <table className="w-full text-left border-collapse border border-black mt-1 text-xs">
                     <thead><tr className="bg-gray-100">
                        <th className="border border-black p-1">DESCRIPTION</th><th className="border border-black p-1">ITEMS NO.</th><th className="border border-black p-1">SERIAL NO</th><th className="border border-black p-1">COLOUR</th><th className="border border-black p-1">YEAR VALUE ESTIMATE</th>
                    </tr></thead>
                    <tbody>
                        <tr><td className="border border-black p-1 h-6">1.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                        <tr><td className="border border-black p-1 h-6">2.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                        <tr><td className="border border-black p-1 h-6">3.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                        <tr><td className="border border-black p-1 h-6">4.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                    </tbody>
                </table>
            </div>
            <div className="mt-4">
                <p className="font-bold">GUARANTORS PART.</p>
                <p className="text-xs mt-1">I …………………………………………………………………………………………………………………………………………………………………., being the guarantor, hereby understands:</p>
                <ol className="list-decimal list-inside space-y-1 mt-1 text-xs">
                    <li>I hereby assign and transferal my rights, title, salaries, estate and interest in and to the chattels to the guarantee by the way of mortgage as continuing securing for the payment and satisfaction in full in full of the secured obligation, for maximum principle amount of Kenya shillings (word……………………………………………………………………………………………………………………………………………………………………………………………only(Ksh………………………………………………………………)(this sum hereinafter to as the ‘’maximum principle amount” ‘plus interest costs charges and expenses.</li>
                    <li>The rights and remedies vested on the grantee by this instrument and by the movable Property Security Rights Act No. 13 of 2017 (the ‘’Act”’ including without limiting the following rights of the grantee as set out in Section 67(3) of the Act, that grantee may after serving the required notices;
                        <ol className="list-[lower-roman] list-inside ml-4">
                            <li>the grantor for any money due and owing under the instrument;</li>
                            <li>appoint a receiver of the income of the income of the movable asset or assets;</li>
                            <li>lease or sublease the movable asset and assets;</li>
                            <li>take possession of the movable asset or assets; or</li>
                            <li>sell the movable asset or assets.</li>
                        </ol>
                    </li>
                </ol>
            </div>
          </div>
          
           {/* Page 5 */}
          <div className="page-break mt-8">
            <div className="mt-2">
                <p className="font-bold">B. GUARANTOR 1 PART.</p>
                <table className="w-full text-left border-collapse border border-black mt-1 text-xs">
                     <thead><tr className="bg-gray-100">
                        <th className="border border-black p-1">DESPRIPUTION</th><th className="border border-black p-1">ITEMS NO</th><th className="border border-black p-1">SERIAL NO</th><th className="border border-black p-1">COLOUR</th><th className="border border-black p-1">YEAR VALUE OF ESTIMATE</th>
                    </tr></thead>
                    <tbody>
                        <tr><td className="border border-black p-1 h-6">1.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                        <tr><td className="border border-black p-1 h-6">2.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                        <tr><td className="border border-black p-1 h-6">3.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                        <tr><td className="border border-black p-1 h-6">4.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-4">
                <p className="font-bold">GUARANTOR 2 PART.</p>
                <table className="w-full text-left border-collapse border border-black mt-1 text-xs">
                     <thead><tr className="bg-gray-100">
                        <th className="border border-black p-1">DESPRIPUTION</th><th className="border border-black p-1">ITEMS NO</th><th className="border border-black p-1">SERIAL NO</th><th className="border border-black p-1">COLOUR</th><th className="border border-black p-1">YEAR VALUE OF ESTIMATE</th>
                    </tr></thead>
                    <tbody>
                        <tr><td className="border border-black p-1 h-6">1.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                        <tr><td className="border border-black p-1 h-6">2.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                        <tr><td className="border border-black p-1 h-6">3.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                        <tr><td className="border border-black p-1 h-6">4.</td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                    </tbody>
                </table>
            </div>
            
            <div className="text-xs mt-4">
                <p>I……………………………………………………………………………………………………………………………………..of post office Box…………………………………………………in the Republic of Kenya make oath and say as follows;</p>
                 <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li>I am the holder of national identity card number………………………………………………….and I am the deponent herein.</li>
                    <li>Pezeka Kenya limited has agreed to lend the money in accordance with the terms of the loan Agreement and assets schedule all signed by me. I undertake to repay the entire amount of the money lent to me at any time in the future together with all applicable fees, service charges, penalties and cost of recovery.</li>
                    <li>In an event of default as that term is defined in the loan agreement, I forego and surrender sale by the way of private sale or public auction all my properties, whether business or personal, listed in asset schedule contain my full name, my signature, my national identity card number and the amount of loan advanced to me. The assets scheduled shall be in the custody of Pezeka Kenya limited.</li>
                    <li>I acknowledge that, if I miss any payment due under the loan agreement with Pezeka Kenya Limited or it’s agents, they may without further consent or notice to me immediately enter upon the land or premises where my properties are located and take possession and sell all of my properties by private sale or public auction.</li>
                    <li>In case of default as defined in the loan agreement, I consent the lender to share my contact with Credit Reference Bureau (CRB)</li>
                    <li><p className="font-bold">A) Customer declaration:</p>1) In connection with the application and/or maintaining a credit facility with the Pezeka Kenya limited, I authorize the Pezeka Kenya Limited to carry out credit checks with or obtain information from, a credit reference bureau. In an event of accounting going into default, I consent to my name transaction and default details being forwarded to a credit reference bureau for listing. I acknowledge that banking institutions and other credit grantors in assessing applications may use this information for credit by associated companies, supplementary accounts holders, and me and for occasional debts tracing and fraud prevention purposes.</li>
                    <li><p className="font-bold">B) Disclosure of information:</p>You agree that Pezeka Kenya Limited may disclose details relating to your &lt;credit facility&gt; account to any third-party including credit reference bureau, if the Lender’s opinion such as disclosure is necessary for the purpose of evaluating your credit worthiness or any transaction with or credit application made to the lender or any other lawful purpose.<br/>2) You agree with the Lender may disclose details relating to your &lt;credit facility&gt; account including details of your default in servicing financial obligations on your &lt;credit facility&gt; account to any third-party including credit reference bureau for the purpose of evaluating your credit worthiness or for any other lawful purpose.</li>
                    <li>I have consented to the actions described in paragraph 3,4 and 5 of this affidavit and hereby signify the said by signing here below.</li>
                    <li>My spouse/guardian or live in companion, if any such spouse or live in companion exists, has consented to the actions described in paragraph 3,4 and 5 of this affidavit.</li>
                </ol>
            </div>
            
            <div className="text-xs mt-4 space-y-4">
                <FormLine label="DEPONENT HEREIN"/>
                <FormLine label="SWORN BY THE NAME AT"/>
                <FormLine label="THIS DATE                                            OF 20"/>
                <FormLine label="GUARANTOR NAME"/>
                <FormLine label="BEFORE ME (NEXT OF KIN)"/>
                <FormLine label="COMMISSIONER FOR OATTH"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
