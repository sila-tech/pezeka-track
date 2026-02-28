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

export default function LogbookLoanFormPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-gray-100 min-h-screen">
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
                <Link href="/admin/application-forms">
                    <Home className="mr-2 h-4 w-4" />
                    Back to Forms
                </Link>
            </Button>
            <h1 className="text-xl font-bold text-gray-800">Logbook Loan Application</h1>
            <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Save as PDF
            </Button>
        </header>

        <div id="printable-area" className="p-8 text-black text-xs">
          {/* Page 1 */}
          <div>
            <div className="text-center mb-4">
              <h1 className="text-xl font-bold uppercase">Pezeka Limited</h1>
              <p className="font-semibold">Affordable Credit, Real Opportunities</p>
              <p className="text-sm">Logbook Loan Application Form</p>
            </div>
            <hr className="border-t-2 border-black my-4" />

            <section className="mb-6">
              <h3 className="font-bold bg-gray-200 p-1 text-sm uppercase">1. Applicant Personal Information</h3>
              <div className="grid grid-cols-2 gap-x-4">
                  <FormLine label="Full Name" />
                  <FormLine label="ID/Passport No." />
                  <FormLine label="PIN No." />
                  <FormLine label="Mobile No." />
                  <FormLine label="Postal Address" />
                  <FormLine label="Residential Estate" />
                  <FormLine label="House No." />
                  <FormLine label="Town/City" />
                  <div className="mt-4 col-span-2">
                    <span className="font-medium mr-4">Employment Status:</span>
                    <Checkbox label="Employed" /> <Checkbox label="Self-Employed" /> <Checkbox label="Other" />
                  </div>
                  <FormLine label="Employer/Business Name" className="col-span-2" />
              </div>
            </section>

            <section className="mb-6">
              <h3 className="font-bold bg-gray-200 p-1 text-sm uppercase">2. Vehicle Details (Security)</h3>
              <div className="grid grid-cols-2 gap-x-4">
                  <FormLine label="Registration No." />
                  <FormLine label="Make & Model" />
                  <FormLine label="Year of Manufacture" />
                  <FormLine label="Chassis No." />
                  <FormLine label="Engine No." />
                  <FormLine label="Color" />
                  <FormLine label="Current Estimated Value" />
                  <FormLine label="Insurance Company" />
              </div>
            </section>

            <section className="mb-6">
              <h3 className="font-bold bg-gray-200 p-1 text-sm uppercase">3. Loan Request</h3>
              <div className="grid grid-cols-2 gap-x-4">
                  <FormLine label="Amount Required (Ksh)" />
                  <FormLine label="Repayment Period (Months)" />
                  <FormLine label="Purpose of Loan" className="col-span-2" />
              </div>
            </section>

            <section className="mb-6">
              <h3 className="font-bold bg-gray-200 p-1 text-sm uppercase">4. References</h3>
              <p className="font-medium mt-2">Reference 1:</p>
              <div className="grid grid-cols-2 gap-x-4">
                  <FormLine label="Name" />
                  <FormLine label="Relationship" />
                  <FormLine label="Telephone" className="col-span-2" />
              </div>
              <p className="font-medium mt-4">Reference 2:</p>
              <div className="grid grid-cols-2 gap-x-4">
                  <FormLine label="Name" />
                  <FormLine label="Relationship" />
                  <FormLine label="Telephone" className="col-span-2" />
              </div>
            </section>
          </div>

          <div className="page-break pt-8">
            <section className="mb-6">
              <h3 className="font-bold bg-gray-200 p-1 text-sm uppercase">5. Applicant's Declaration</h3>
              <p className="mt-2 text-justify leading-relaxed">
                I, the undersigned, declare that the information provided herein is true and correct to the best of my knowledge. 
                I authorize Pezeka Limited to carry out credit checks and verify any information provided. I understand that the logbook 
                of the vehicle described above will be held as security until the loan is fully repaid. I agree to comply with all terms 
                and conditions of the loan agreement.
              </p>
              <div className="grid grid-cols-2 gap-x-8 mt-8">
                  <FormLine label="Applicant's Signature" />
                  <FormLine label="Date" />
              </div>
            </section>

            <section className="mb-6">
              <h3 className="font-bold bg-gray-200 p-1 text-sm uppercase">6. For Official Use Only</h3>
              <div className="border p-4 mt-2 space-y-4">
                  <div className="grid grid-cols-2 gap-x-4">
                      <FormLine label="Credit Officer Name" />
                      <FormLine label="Date" />
                      <div className="mt-4"><Checkbox label="Approved" /> <Checkbox label="Rejected" /></div>
                      <FormLine label="Approved Amount" />
                  </div>
                  <FormLine label="Officer Comments" className="col-span-2" />
                  <div className="grid grid-cols-2 gap-x-4 pt-4">
                      <FormLine label="Management Signature" />
                      <FormLine label="Date & Stamp" />
                  </div>
              </div>
            </section>

            <section className="mt-12 text-center text-[10px] text-gray-500">
                <p>Pezeka Limited | Affordable Credit, Real Opportunities</p>
                <p>Location: Nairobi, Kenya | Phone: +254 757 664047</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
