"use client";

import * as Layouts from "@/refresh-components/layouts/layouts";
import StepsHITL from "../../components/StepsHITL";
import Button from "@/refresh-components/buttons/Button";
import { useRouter } from "next/navigation";

export default function Page({ settings, chatSession }: any) {
  const router = useRouter();

  const handleNavigationUseTemplate = () => {
    router.push("/chat/ai-drafting/initial-draft");
  };

  const handleNavigationGenerateFromScratch = () => {
    router.push("/chat/ai-drafting/generate-from-scratch");
  };

  return (
    <Layouts.AppPage settings={settings} chatSession={chatSession}>
      <div className="w-full min-h-screen bg-gray-50 px-10 py-8 overflow-y-auto">

        <StepsHITL step={2} />

        <h1 className="text-3xl font-bold mb-6 mt-4">
          Select Template
        </h1>

        <div className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg mb-6">
          Match Found :{" "}
          <span className="font-semibold">
            Comprehensive Mortgage Deed
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">

          <h2 className="text-lg font-semibold mb-4">Preview</h2>

          <div className="h-[500px] overflow-y-auto border rounded-lg p-6 bg-gray-100 text-sm leading-relaxed">

            <h3 className="font-semibold mb-4">1. PARTIES</h3>

            <p className="mb-4">
              <strong>Mortgagor (Borrower):</strong><br />
              Mr. Arjun Mehta<br />
              S/o Rajesh Mehta<br />
              Aged 38 years<br />
              Residing at: Flat No. 1203, Sunshine Residency, Andheri East, Mumbai – 400069<br />
              PAN: ABCPM1234K
            </p>

            <p className="mb-4">
              <strong>Mortgagee (Lender):</strong><br />
              ABC National Bank Ltd.<br />
              Registered Office: 21 Finance Plaza, Bandra Kurla Complex, Mumbai – 400051<br />
              Through its Authorized Signatory: Ms. Neha Kapoor
            </p>

            <h3 className="font-semibold mt-6 mb-4">2. LOAN DETAILS</h3>

            <p className="mb-2">Loan Amount: ₹75,00,000</p>
            <p className="mb-2">Interest Rate: 8.50% (Floating)</p>
            <p className="mb-2">Loan Tenure: 20 Years</p>
            <p className="mb-2">EMI Amount: ₹65,124</p>

            <h3 className="font-semibold mt-6 mb-4">6. SIGNATURES</h3>

            <p>Mortgagor Signature: _______________________</p>
            <p>Mortgagee Signature: _______________________</p>

          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-6 mt-8">

            <Button
              className="px-6 py-3 bg-black text-white rounded-lg hover:opacity-90"
              onClick={handleNavigationUseTemplate}
            >
              Use This Template
            </Button>

            <Button
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100"
              onClick={handleNavigationGenerateFromScratch}
            >
              Generate From Scratch
            </Button>

          </div>

        </div>
      </div>
    </Layouts.AppPage>
  );
}