'use client';

import { Button } from '@/components/ui/button';
import { Printer, Home } from 'lucide-react';
import Link from 'next/link';

const FormLine = ({ label, className, lineClassName }: { label: string; className?: string, lineClassName?: string }) => (
  <div className={`flex items-end mt-4 ${className}`}>
    <span className="font-medium whitespace-nowrap text-sm">{label}</span>
    <span className={`w-full border-b border-black ml-2 ${lineClassName}`}></span>
  </div>
);


export default function LogbookLoanFormPage() {
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
            margin: 15mm;
          }
        }
        .page-break {
            page-break-before: always;
        }
      `}</style>
      <div className="max-w-4xl mx-auto bg-white shadow-lg">
        <header className="flex justify-between items-center p-4 border-b no-print">
            <Button variant="outline" asChild>
                <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>
            </Button>
            <h1 className="text-xl font-bold text-gray-800">Car Logbook Loan Forms</h1>
            <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Save as PDF
            </Button>
        </header>

        <div id="printable-area" className="p-8 text-black text-xs">
          {/* Page 1 */}
          <div>
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold uppercase">Pezeka Kenya Limited</h1>
            </div>
            <hr className="border-t-2 border-black my-4" />
            <h2 className="text-md font-bold text-center mb-4 uppercase">Memorandum of Deposit</h2>
            
            <p className="text-sm">
                THIS MEMORANDUM made this _______ day of _________ 20_
            </p>

            <p className="mt-4 uppercase font-semibold">Between</p>
            <p className="mt-2">.................................................................... of P.O. Box.................... hereinafter referred to as the "Borrower" which expression shall where the context so admits include his legal representatives, assigns and/or successors in title, of the first part; and Pezeka Kenya Limited, a company duly registered and carrying on business in Kenya of P.O. Box ____________ hereinafter referred to as the "Lender" of the second part.</p>
            
            <p className="mt-4 font-semibold">WITNESSETH AS FOLLOWS:</p>
            <p className="mt-2">WHEREAS at the request and for the benefit of the Borrower, the Lender has agreed to provide a Loan facility of Kshs........................... to be paid in ______equal monthly installments of Kshs.................................................. (Kenya Shillings ....................................................................**) only secured by the Property specifically described in the Schedule hereto. The Borrower and the Lender have to this end entered into a Loan Agreement dated the ............ day of ....................20...... and it is agreed that the said Loan Agreement be deemed integral and construed as one with this Memorandum.</p>

            <p className="mt-4 font-semibold">NOW THEREFORE IT IS HEREBY AGREED AS FOLLOWS:</p>
            <ol className="list-decimal list-inside space-y-2 mt-2">
                <li>The Borrower deposits with the Lender the original ____________________________ Property described in the Schedule as security.</li>
                <li>If the Borrower fails to comply with the Loan Agreement, the Lender may register a mortgage under the Registration of Titles Act and/or Chattels Transfer Act.</li>
                <li>Upon default, the full loan amount becomes payable immediately, with a penal interest of 5% per month.</li>
                <li>The Lender may dispose of the Security to recover the loan.</li>
            </ol>
            
            <p className="mt-6">IN WITNESS WHEREOF the parties have signed:</p>

            <div className="grid grid-cols-2 gap-8 mt-6">
                <div>
                    <p>SIGNED and delivered by ____________________________________</p>
                    <p className="mt-4">In the presence of _________________________________</p>
                    <FormLine label="" className="mt-8" lineClassName="w-32" />
                    <p className="font-semibold text-center">BORROWER</p>
                </div>
                 <div>
                    <p>SIGNED and delivered for and on behalf of Pezeka Kenya Limited by ____________________________________</p>
                    <div className="flex justify-between mt-8">
                        <p>WITNESS__________________</p>
                        <p>MANAGER__________________</p>
                    </div>
                </div>
            </div>
             <p className="text-center text-xs mt-6">This Document is confidential and shall not be reproduced in whole or in part by any other party. Version December 2025</p>

            <hr className="border-t-2 border-black my-4" />
            <h3 className="font-bold text-center mb-2 uppercase">Schedule of Property</h3>
            <p className="font-medium text-sm text-center mb-2">(Details of the Property – Land)</p>
            <table className="w-full text-left border-collapse border border-black text-xs">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-black p-1">PARTICULARS OF CERTIFICATE OF TITLE</th>
                        <th className="border border-black p-1">DESCRPTION OF PROPERTY AND AGREEMENT</th>
                        <th className="border border-black p-1">VALUE (KSH)</th>
                        <th className="border border-black p-1">REGISTERED OWNER</th>
                        <th className="border border-black p-1">PARTICULARS OF THIRD-PARTY RELATIONSHIP</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td className="border border-black p-1 h-12"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                </tbody>
            </table>

             <p className="font-medium text-sm text-center mb-2 mt-4">(Details of the Property – Vehicles)</p>
             <table className="w-full text-left border-collapse border border-black text-xs">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-black p-1">MAKE MODEL</th><th className="border border-black p-1">REG. NO</th><th className="border border-black p-1">CHASIS NO</th><th className="border border-black p-1">ENGINE NO</th><th className="border border-black p-1">REG OWNER</th>
                    </tr>
                </thead>
                 <tbody>
                    <tr><td className="border border-black p-1 h-12"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                </tbody>
            </table>

            <p className="font-medium text-sm text-center mb-2 mt-4">(Details of the Property – Other Equipment)</p>
             <table className="w-full text-left border-collapse border border-black text-xs">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-black p-1">MAKE MODEL</th><th className="border border-black p-1">SERIAL NUMBER</th>
                    </tr>
                </thead>
                 <tbody>
                    <tr><td className="border border-black p-1 h-12"></td><td className="border border-black p-1"></td></tr>
                    <tr><td className="border border-black p-1 h-12"></td><td className="border border-black p-1"></td></tr>
                    <tr><td className="border border-black p-1 h-12"></td><td className="border border-black p-1"></td></tr>
                </tbody>
            </table>
          </div>

          {/* Page 2 */}
          <div className="page-break">
            <h2 className="text-md font-bold text-center my-4 uppercase">Form C – Transfer of Ownership of Motor Vehicle or Trailer</h2>
            <div className="border border-black p-4">
                <h3 className="font-bold text-sm uppercase">PART I. STATEMENT BY THE SELLER</h3>
                <div className="mt-2">
                    <p className="font-semibold">(A) PARTICULARS OF VEHICLE</p>
                    <div className="grid grid-cols-2 gap-x-4">
                        <FormLine label="1. Registration mark and number"/>
                        <FormLine label="2. Make and body type"/>
                        <FormLine label="3. Chassis/frame number"/>
                        <FormLine label="4. Engine number"/>
                    </div>
                </div>
                 <div className="mt-4">
                    <p className="font-semibold">(B) OTHER PARTICULARS</p>
                     <FormLine label="• Date of transfer:" className="mt-1"/>
                     <FormLine label="• New owner: Name"/>
                     <FormLine label="Postal Address"/>
                     <p className="mt-2 text-sm">• Declaration: "I have also transferred the registration book to the new owner named above."</p>
                     <div className="grid grid-cols-2 gap-x-4 mt-4">
                        <FormLine label="Seller’s Name"/>
                        <FormLine label="Signature"/>
                        <FormLine label="ID/Certificate of Incorporation"/>
                        <FormLine label="Address"/>
                        <FormLine label="PIN"/>
                        <FormLine label="Date"/>
                     </div>
                </div>
            </div>

            <div className="border border-black p-4 mt-4">
                <h3 className="font-bold text-sm uppercase">PART II. STATEMENT BY THE OWNER</h3>
                <FormLine label="• Registration mark and number"/>
                <p className="mt-4 text-sm">• Vehicle type: ☐ Private ☐ Commercial goods ☐ Trailers ☐ Public service ☐ Tractors ☐ Motor cycles</p>
                <FormLine label="• Insurance company name"/>
                <p className="mt-4 text-sm font-semibold">• Location:</p>
                 <div className="grid grid-cols-2 gap-x-4">
                    <FormLine label="Road"/>
                    <FormLine label="Area/Estate"/>
                    <FormLine label="Town"/>
                    <FormLine label="District"/>
                </div>
                <div className="grid grid-cols-2 gap-x-4 mt-4">
                    <FormLine label="Buyer’s Signature"/>
                    <FormLine label="Name"/>
                    <FormLine label="Occupation"/>
                    <FormLine label="ID"/>
                    <FormLine label="PIN"/>
                    <FormLine label="Employer"/>
                    <FormLine label="Contact Info"/>
                </div>
                <p className="mt-4 text-sm">Submission: Send to Registrar of Motor Vehicles, P.O. Box 30440 Nairobi. Attach:</p>
                <ul className="list-disc list-inside text-sm pl-4">
                    <li>Fee payable</li><li>Registration book</li><li>Insurance certificate</li><li>Inspection report (if auctioned)</li><li>ID card</li>
                </ul>
                <div className="border border-black p-2 mt-4">
                    <p className="font-semibold">Official Use:</p>
                    <div className="grid grid-cols-2 gap-x-8">
                        <p>Date: ________________</p>
                        <div>
                            <p>Transfer Fee boxes:</p>
                            <div className="flex space-x-2 mt-1">
                                <span className="w-6 h-6 border border-black"></span><span className="w-6 h-6 border border-black"></span><span className="w-6 h-6 border border-black"></span><span className="w-6 h-6 border border-black"></span>
                            </div>
                        </div>
                    </div>
                     <div>
                        <p>Age brackets:</p>
                        <div className="flex space-x-2 mt-1">
                            <span className="w-6 h-6 border border-black"></span><span className="w-6 h-6 border border-black"></span><span className="w-6 h-6 border border-black"></span><span className="w-6 h-6 border border-black"></span><span className="w-6 h-6 border-black"></span>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* Page 3 */}
           <div className="page-break">
               <h2 className="text-md font-bold text-center my-4 uppercase">Transfer Requirements and Tax Table</h2>
               <p className="font-semibold text-center mb-2">SECOND-HAND MOTOR VEHICLE PURCHASE TAX AND TRANSFER FEES</p>
               <table className="w-full text-left border-collapse border border-black text-xs">
                  <thead><tr className="bg-gray-100"><th className="border border-black p-1">Rating Capacity</th><th className="border border-black p-1">Purchase Tax (KSH)</th><th className="border border-black p-1">Transfer Fee (KSH)</th><th className="border border-black p-1">Total (KSH)</th></tr></thead>
                  <tbody>
                      <tr><td className="border border-black p-1">Not Exceeding 1000cc</td><td className="border border-black p-1">1,035</td><td className="border border-black p-1">625</td><td className="border border-black p-1">1,660</td></tr>
                      <tr><td className="border border-black p-1">1001–1200cc</td><td className="border border-black p-1">1,265</td><td className="border border-black p-1">625</td><td className="border border-black p-1">1,890</td></tr>
                      <tr><td className="border border-black p-1">1201–1500cc</td><td className="border border-black p-1">1,470</td><td className="border border-black p-1">625</td><td className="border border-black p-1">2,095</td></tr>
                      <tr><td className="border border-black p-1">1501–1700cc</td><td className="border border-black p-1">1,785</td><td className="border border-black p-1">625</td><td className="border border-black p-1">2,410</td></tr>
                      <tr><td className="border border-black p-1">1701–2000cc</td><td className="border border-black p-1">1,875</td><td className="border border-black p-1">625</td><td className="border border-black p-1">2,495</td></tr>
                      <tr><td className="border border-black p-1">2001–2500cc</td><td className="border border-black p-1">2,320</td><td className="border border-black p-1">625</td><td className="border border-black p-1">2,945</td></tr>
                      <tr><td className="border border-black p-1">2501–3000cc</td><td className="border border-black p-1">2,430</td><td className="border border-black p-1">625</td><td className="border border-black p-1">3,055</td></tr>
                      <tr><td className="border border-black p-1">3001 and above</td><td className="border border-black p-1">2,495</td><td className="border border-black p-1">625</td><td className="border border-black p-1">3,120</td></tr>
                      <tr><td className="border border-black p-1">Trailer < 4 wheels</td><td className="border border-black p-1">405</td><td className="border border-black p-1">625</td><td className="border border-black p-1">1,030</td></tr>
                      <tr><td className="border border-black p-1">Trailer ≥ 4 wheels</td><td className="border border-black p-1">1,265</td><td className="border border-black p-1">625</td><td className="border border-black p-1">1,890</td></tr>
                      <tr><td className="border border-black p-1">Tractor</td><td className="border border-black p-1">405</td><td className="border border-black p-1">625</td><td className="border border-black p-1">1,030</td></tr>
                  </tbody>
              </table>

              <h3 className="font-bold mt-4">Transfer Requirements:</h3>
              <ol className="list-decimal list-inside text-sm space-y-1">
                  <li>Form “C” duly filled by both seller and buyer</li><li>ID and PIN for buyer and seller</li><li>Certificate of Incorporation or Business Registration (if applicable)</li><li>Valid insurance cover</li><li>Original logbook</li><li>Letters of administration (if owner is deceased)</li><li>Inspection report (if written off)</li><li>Letter from Permanent Secretary (for parastatals)</li><li>Sale agreement with full vehicle details</li><li>Notify registrar within 14 days if vehicle held for resale</li><li>For auction vehicles – refer to Form “A”</li>
              </ol>

               <hr className="border-t-2 border-black my-4" />
               <h2 className="text-md font-bold text-center mb-2 uppercase">Securities Register</h2>
               <div className="grid grid-cols-2 gap-x-4">
                  <FormLine label="DATE"/> <FormLine label="LOAN ID"/>
                  <FormLine label="NAME"/> <FormLine label="ID/PASSPORT NO"/>
                  <FormLine label="LOG NUMBER"/> <FormLine label="BRANCH"/>
                  <FormLine label="LOGGED BY"/>
               </div>
               <p className="mt-4 text-sm">“I hereby offer the following items listed and described below as security/collateral to Pezeka Kenya Limited for the loan amount of KSH.......................................given to me on………………….. I fully understand that these items will be sold should I fail to pay in full the money loaned to me by Pezeka Kenya Limited.”</p>
               <table className="w-full text-left border-collapse border border-black text-xs mt-2">
                  <thead><tr className="bg-gray-100"><th className="border border-black p-1">SECURITY DESCRIPTION</th><th className="border border-black p-1">SERIAL NUMBER</th><th className="border border-black p-1">SECURITY VALUE</th></tr></thead>
                  <tbody>
                      <tr><td className="border border-black p-1 h-8"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                      <tr><td className="border border-black p-1 h-8"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                      <tr><td className="border border-black p-1 h-8"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                      <tr><td className="border border-black p-1 h-8"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                      <tr><td className="border border-black p-1 h-8"></td><td className="border border-black p-1"></td><td className="border border-black p-1"></td></tr>
                  </tbody>
              </table>

               <div className="grid grid-cols-2 gap-x-8 mt-4">
                    <div>
                        <FormLine label="CUSTOMER SIGNATURE" />
                        <FormLine label="WITNESS NAME" />
                        <FormLine label="SIGNATURE" />
                        <FormLine label="DATE" />
                    </div>
                    <div>
                        <p className="font-semibold text-center">FOR OFFICIAL USE – RELEASE AUTHORIZATION</p>
                        <FormLine label="Name" />
                        <FormLine label="Date" />
                        <FormLine label="Signature" />
                        <FormLine label="Released To" />
                        <FormLine label="ID No" />
                        <FormLine label="Date" />
                        <FormLine label="Signature" />
                    </div>
               </div>
           </div>
        </div>
      </div>
    </div>
  );
}
