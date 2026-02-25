"use client";

import StepsHITL from "../../components/StepsHITL";
import Button from "@/refresh-components/buttons/Button";
import { useRouter } from "next/navigation";

export default function ContractReviewPage() {
     const router = useRouter();
    const handleNavigationChange = () => {
        router.push("/chat/ai-drafting/review-completed");
    }
    const handleNavigationEdit = () => {
        router.push("/chat/ai-drafting/review-completed");
    }
  return (
    <div className="w-full min-h-screen bg-[#f4f5f7] px-12 py-10 overflow-y-auto">

<StepsHITL step={4}/>
      <h1 className="text-2xl font-semibold text-gray-800 mb-8">
        Contract Review Stage
      </h1>


      <div className="grid grid-cols-2 gap-10">


        <div className="flex flex-col">

          <h2 className="text-sm font-medium text-gray-600 mb-3">
            Current Draft
          </h2>

          <div className="bg-white border border-[#e4e6eb] rounded-lg h-[580px] overflow-hidden">

            <div className="h-full overflow-y-auto px-8 py-7 text-[13px] leading-6 text-gray-700">

              <h3 className="text-gray-800 font-semibold mb-4 tracking-wide">
                1. PARTIES
              </h3>

              <div className="space-y-4">
                <p>
                  <span className="font-medium text-gray-800">
                    Mortgagor (Borrower)
                  </span><br />
                  Mr. Arjun Mehta<br />
                  S/o Rajesh Mehta<br />
                  Aged 38 years<br />
                  Residing at: Flat No. 1203, Sunshine Residency, Andheri East, Mumbai – 400069<br />
                  PAN: ABCPM1234K
                </p>

                <p>
                  <span className="font-medium text-gray-800">
                    Mortgagee (Lender)
                  </span><br />
                  ABC National Bank Ltd.<br />
                  Registered Office: 21 Finance Plaza, Bandra Kurla Complex, Mumbai – 400051<br />
                  Through its Authorized Signatory: Ms. Neha Kapoor
                </p>
              </div>

              <h3 className="text-gray-800 font-semibold mt-8 mb-4 tracking-wide">
                2. LOAN DETAILS
              </h3>

              <p className="space-y-1">
                Loan Amount: ₹75,00,000 (Rupees Seventy-Five Lakhs Only)<br />
                Loan Account Number: HL2026MUM45821<br />
                Interest Rate: 8.50% per annum (Floating)<br />
                Loan Tenure: 20 Years (240 Months)
              </p>

              <div className="h-20" />
            </div>
          </div>
        </div>


        <div className="flex flex-col">

          <h2 className="text-sm font-medium text-gray-600 mb-3">
            AI Findings & Suggestions
          </h2>

          <div className="bg-[#eef1f4] border border-[#e4e6eb] rounded-md px-5 py-3 mb-5 text-[13px] text-gray-700">
            The AI identified the following issues:
          </div>

          <div className="bg-[#f0f0f1] border border-[#e4e6eb] rounded-lg h-[580px] overflow-hidden">

            <div className="h-full overflow-y-auto px-8 py-7 text-[13px] leading-6 text-gray-700 space-y-8">

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  Clause 1 – Definitions – "Loan"
                </h3>
                <p>
                  The definition of "Loan" includes all interest, costs, charges, 
                  and expenses accrued thereon. This is broad and could lead to 
                  disputes if the calculation of these additional amounts is not 
                  clearly defined elsewhere.
                </p>
                <p className="mt-2 text-gray-600">
                  <span className="font-medium">Suggestion:</span> Clarify that 
                  the principal amount together with all interest and charges 
                  shall be specifically itemized and agreed upon.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  Clause 1.2 – Definitions – "Security Interest"
                </h3>
                <p>
                  This clause defines "Security Interest" as the mortgage created 
                  over the Schedule Property. While technically correct, 
                  the drafting could be more precise.
                </p>
                <p className="mt-2 text-gray-600">
                  <span className="font-medium">Suggestion:</span> Align terminology 
                  consistently across the document.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  Clause 1.3 – Definitions – "Repayment Date"
                </h3>
                <p>
                  The draft references a Repayment Schedule but does not annex it. 
                  This is a material omission.
                </p>
                <p className="mt-2 text-gray-600">
                  <span className="font-medium">Suggestion:</span> Include a detailed 
                  repayment schedule as an annexure forming part of the deed.
                </p>
              </div>

              <div className="h-20" />
            </div>
          </div>
        </div>
      </div>


          <div className="flex justify-center gap-6 mt-8">
<Button className="px-8 py-3 bg-black text-white rounded-lg hover:opacity-90 transition" onClick={handleNavigationChange}> Accept all Change & Auto Fix </Button>
<Button className="px-8 py-3 border rounded-lg hover:bg-gray-100 transition" secondary onClick={handleNavigationEdit}> Reject Changes (Edit Manually Next) </Button>
            {/* <a
              href="/chat/ai-drafting/review-completed"
              className="px-8 py-3 bg-black text-white rounded-lg hover:opacity-90 transition"
            >
              Accept all Change & Auto Fix
            </a>

            <a
              href="/chat/ai-drafting/review-completed"
              className="px-8 py-3 border rounded-lg hover:bg-gray-100 transition"
            >
              Reject Changes (Edit Manually Next)
            </a> */}

          </div>
    </div>
  );
}
