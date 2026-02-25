"use client";

import Step from "@mui/material/Step";
import StepsHITL from "../../components/StepsHITL";
import Button from "@/refresh-components/buttons/Button";
import { useRouter } from "next/navigation";

export default function ReviewCompletedPage() {
    const router = useRouter();
   const handleNavigationDownloadPDF = () => {
    router.push("/chat/");
  };
  const handleNavigationRestartApplication = () => {
    router.push("/chat/");
  };
  return (
    <>
      {/* ===== Scrollbar Styling ===== */}
      <style jsx global>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
      `}</style>

      <div className="w-full min-h-screen bg-[#f4f5f7] px-12 py-10 overflow-y-auto">

        {/* PAGE TITLE */}
        <StepsHITL step={5}/>
        <h1 className="text-2xl font-semibold text-gray-800 mb-6">
          Review Process Completed
        </h1>

        {/* INFO BOX */}
        <div className="bg-[#eef1f4] border border-[#e4e6eb] rounded-md px-5 py-3 mb-8 text-[13px] text-gray-700">
          You may make final edits below.
        </div>

        {/* EDITOR TITLE */}
        <h2 className="text-sm font-medium text-gray-600 mb-3">
          Final Document Editor
        </h2>

        {/* EDITOR BOX */}
        <div className="bg-white border border-[#e4e6eb] rounded-lg h-[600px] overflow-hidden">

          <div className="h-full overflow-y-auto custom-scrollbar px-8 py-7 text-[13px] leading-6 text-gray-700 space-y-6">

            <p>
              Clause 1. Definitions – "Loan": The definition of "Loan" includes
              all interest, costs, charges, and expenses accrued thereon. This is broad
              and could lead to disputes if the calculation of these additional
              amounts is not clearly defined elsewhere. Furthermore, it doesn't specify
              the source or authority for these costs and expenses.
              <br /><br />
              <strong>Amend to:</strong> "1.1 'Loan' shall mean the principal amount
              of Rs. 2,50,00,000 (Rupees Two Crores Fifty Lakhs Only) together with
              all interest, costs, charges, and expenses as specifically itemized
              and agreed upon in the accompanying Loan Agreement or as permitted by law."
            </p>

            <p>
              Clause 1.2 – Definitions – "Security Interest": This clause defines
              "Security Interest" as "the mortgage created over the Schedule Property
              in favor of the Mortgagee." While technically correct in its immediate
              context, it is somewhat redundant as the entire document is about creating
              a mortgage.
              <br /><br />
              <strong>Suggestion:</strong> Consider removing this definition if it
              doesn't serve a distinct purpose beyond the document's core function.
              If retained, amend to: "1.2 'Security Interest' shall mean the mortgage
              and charge created by this Mortgage Deed over the Schedule Property
              in favor of the Mortgagee."
            </p>

            <p>
              Clause 1.3 – Definitions – "Repayment Date": This clause states
              "shall mean the dates specified in the Repayment Schedule annexed hereto."
              However, there is no Repayment Schedule annexed to the provided draft.
              This is a critical omission.
              <br /><br />
              <strong>Suggestion:</strong> Add a clause stating:
              "The parties agree that a detailed Repayment Schedule, outlining the
              installment amounts, due dates, and any associated fees, shall be
              annexed to this Mortgage Deed as Exhibit A and shall form an integral
              part of this Deed." Also, ensure Exhibit A is actually attached.
            </p>

            <div className="h-16" />
          </div>
        </div>

        {/* ACTION BUTTONS */}
          {/* <div className="flex justify-center gap-6 mt-8">

            <a
              href="/chat/"
              className="px-8 py-3 bg-black text-white rounded-lg hover:opacity-90 transition"
            >
              Download PDF
            </a>

            <a
              href="/chat/"
              className="px-8 py-3 border rounded-lg hover:bg-gray-100 transition"
            >
              Restart Application
            </a>

          </div> */}
          <div className="flex justify-center gap-6 mt-8">
                <div className="mt-8">
          
                  <Button className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:opacity-90" onClick={handleNavigationDownloadPDF}> Download PDF </Button>
          
                </div>
                      <div className="mt-8">
                
                        <Button className=" py-3 border rounded-lg hover:bg-gray-100 transition" secondary onClick={handleNavigationRestartApplication}> Restart Application </Button>
                
                      </div>
                      </div>

      </div>
    </>
  );
}