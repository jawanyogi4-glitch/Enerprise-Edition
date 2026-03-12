"use client";

import StepsHITL from "../../components/StepsHITL";
import Button from "@/refresh-components/buttons/Button";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/redux/store";
import { acceptAutoFixThunk } from "@/redux/template";
import PageLoader from "../../components/loaders/PageLoader";

export default function ContractReviewPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const { usedTemplate, reviewResult, loading } = useSelector(
    (state: RootState) => state.template
  );

  const handleNavigationChange = async () => {
    const requestId = reviewResult?.meta?.request_id;

    if (!requestId) {
      alert("Request ID missing");
      return;
    }

    const resultAction = await dispatch(
      acceptAutoFixThunk({
        request_id: requestId,
      })
    );

    if (acceptAutoFixThunk.fulfilled.match(resultAction)) {
      router.push("/chat/ai-drafting/review-completed");
    }
  }
  const handleNavigationEdit = () => {
    router.push("/chat/ai-drafting/review-completed");
  }
  return (
    <div className="w-full min-h-screen bg-[#f4f5f7] px-12 py-10 overflow-y-auto">

      <StepsHITL step={4} />
      {loading && <PageLoader text="Accepting Auto Fixes..." />}
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
              {usedTemplate?.data || "No template data available"}
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
              {reviewResult?.data || "No review results available."}
              <div className="h-20" />
            </div>
          </div>
        </div>
      </div>


      <div className="flex justify-center gap-6 mt-8">
        <Button className="px-8 py-3 bg-black text-white rounded-lg hover:opacity-90 transition" onClick={handleNavigationChange}> Accept all Change & Auto Fix </Button>
        <Button className="px-8 py-3 border rounded-lg hover:bg-gray-100 transition" secondary onClick={handleNavigationEdit}> Reject Changes (Edit Manually Next) </Button>
      </div>
    </div>
  );
}
