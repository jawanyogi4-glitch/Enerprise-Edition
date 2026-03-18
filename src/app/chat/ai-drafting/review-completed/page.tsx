"use client";

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
    <div className="w-full min-h-screen bg-background text-text px-10 py-8 overflow-y-auto">
      {/* PAGE TITLE */}
      <StepsHITL step={5} title="Review Process Completed" />

      {/* INFO BOX */}
      <div className="mt-6 mb-6 px-4 py-3 rounded-08 bg-background-neutral-03 text-text-03">
        You may make final edits below.
      </div>

      {/* EDITOR TITLE */}
      <h2 className="font-main-ui-muted text-text-03 mb-4">
        Final Document Editor
      </h2>

      {/* EDITOR BOX */}
      <div className="bg-background-neutral-03 border border-border rounded-08 h-[600px] overflow-hidden shadow-00">
        <div className="h-full overflow-y-auto default-scrollbar p-6 font-main-content-body text-text-02 leading-7 space-y-6">
          <p>
            Clause 1. Definitions – "Loan": The definition of "Loan" includes
            all interest, costs, charges, and expenses accrued thereon. This is broad
            and could lead to disputes if the calculation of these additional
            amounts is not clearly defined elsewhere. Furthermore, it doesn't specify
            the source or authority for these costs and expenses.
            <br /><br />
            <strong className="text-text font-semibold">Amend to:</strong> "1.1 'Loan' shall mean the principal amount
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
            <strong className="text-text font-semibold">Suggestion:</strong> Consider removing this definition if it
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
            <strong className="text-text font-semibold">Suggestion:</strong> Add a clause stating:
            "The parties agree that a detailed Repayment Schedule, outlining the
            installment amounts, due dates, and any associated fees, shall be
            annexed to this Mortgage Deed as Exhibit A and shall form an integral
            part of this Deed." Also, ensure Exhibit A is actually attached.
          </p>

          <div className="h-16" />
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex justify-center gap-6 mt-10 pb-10">
        <Button
          primary
          className="px-8 py-3 rounded-08 shadow-01 transition-all hover:scale-[1.02]"
          onClick={handleNavigationDownloadPDF}
        >
          Download PDF
        </Button>
        <Button
          secondary
          className="px-8 py-3 rounded-08 border border-border hover:bg-background-neutral-02 transition-all"
          onClick={handleNavigationRestartApplication}
        >
          Restart Application
        </Button>
      </div>
    </div>
  );
}