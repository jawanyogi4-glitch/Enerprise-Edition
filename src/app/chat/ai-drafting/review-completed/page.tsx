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
        {loading && <PageLoader text="Downloading PDF..." />}
        {/* PAGE TITLE */}
        <StepsHITL step={5} />
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
            {acceptAutoFix?.data || "No Final Document Editor available."}

            <div className="h-16" />
          </div>
        </div>

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