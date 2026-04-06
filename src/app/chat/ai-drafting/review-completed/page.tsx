"use client";

import Step from "@mui/material/Step";
import StepsHITL from "../../components/StepsHITL";
import Button from "@/refresh-components/buttons/Button";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/redux/store";
import { downloadPDFThunk } from "@/redux/template";
import PageLoader from "../../components/loaders/PageLoader";

export default function ReviewCompletedPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const { acceptAutoFix, loading } = useSelector(
    (state: RootState) => state.template
  );
  const handleNavigationDownloadPDF = async () => {
    const requestId = acceptAutoFix?.meta?.request_id;

    if (!requestId) {
      alert("Request ID missing");
      return;
    }

    const resultAction = await dispatch(
      downloadPDFThunk({ request_id: requestId })
    );

    if (downloadPDFThunk.fulfilled.match(resultAction)) {
      const response = resultAction.payload;
      const pdfUrl =
        response?.pdf_url ||
        response?.data;
      if (pdfUrl) {
        window.open(pdfUrl, "_blank");
      } else {
        console.error("PDF URL not found in response:", response);
      }
    }
  };

  const handleNavigationRestartApplication = () => {
    router.push("/chat/ai-drafting");
  };

  return (

    <div className="w-full min-h-screen bg-background text-text px-10 py-8 overflow-y-auto">
      {loading && <PageLoader text="Downloading PDF..." />}
      {/* PAGE TITLE */}
      <StepsHITL step={5} title="Review Process Completed" />

      {/* INFO BOX */}
      <div className="mt-6 mb-6 px-4 py-3 rounded-08 bg-background-neutral-03 text-text-03 text-[14px]">
        You may make final edits below.
      </div>

      {/* EDITOR TITLE */}
      <h2 className="font-main-ui-muted text-text-03 mb-4">
        Final Document Editor
      </h2>

      {/* EDITOR BOX */}
      <div className="bg-background-neutral-03 border border-border rounded-08 h-[600px] overflow-hidden shadow-00">
        <div className="h-full overflow-y-auto default-scrollbar p-6 font-main-content-body text-text-02 leading-7 space-y-6">
          {acceptAutoFix?.data || "No Final Document Editor available."}

          <div className="h-16" />
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex justify-center gap-6 mt-10 pb-10">
        <Button
          primary
          className="px-8 py-3 rounded-08 shadow-01 transition-all hover:scale-[1.02]"
          onClick={handleNavigationDownloadPDF}
          disabled={loading}
        >
          {loading ? "Downloading..." : "Download PDF"}
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