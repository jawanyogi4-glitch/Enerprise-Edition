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
    <div className="w-full min-h-screen bg-[#fafafa] dark:bg-background text-text px-10 py-8 overflow-y-auto">

      <StepsHITL step={4} title="Contract Review Stage" />
      {loading && <PageLoader text="Accepting Auto Fixes..." />}


      <div className="grid grid-cols-2 gap-10">


        <div className="flex flex-col">

          <h2 className="text-[#6C6C6D] dark:text-text-03 text-[16px] mb-2">
            Current Draft
          </h2>

          <div className="bg-white dark:bg-background-neutral-03 border border-gray-300 dark:border-border rounded-md h-[580px] overflow-hidden">

            <div className="h-full overflow-y-auto default-scrollbar p-6 whitespace-pre-wrap font-sans text-[#6C6C6D] dark:text-text-02 text-[16px] leading-relaxed space-y-6">
              {usedTemplate?.data || "No template data available"}
              <div className="h-20" />
            </div>
          </div>
        </div>


        <div className="flex flex-col">

          <h2 className="text-[#6C6C6D] dark:text-text-03 text-[16px] mb-2">
            AI Findings & Suggestions
          </h2>

          <div className="bg-[#F0F0F1] dark:bg-background-neutral-02 rounded-md px-4 py-3 mb-5 text-[#6C6C6D] dark:text-text-03 text-[16px]">
            The AI identified the following issues:
          </div>

          <div className="bg-[#F0F0F1] dark:bg-background-neutral-03 border border-gray-300 dark:border-border rounded-md h-[580px] overflow-hidden">
            <div className="h-full overflow-y-auto default-scrollbar p-6 whitespace-pre-wrap font-sans text-[#6C6C6D] dark:text-text-02 text-[16px] leading-relaxed space-y-8">
              {reviewResult?.data || "No review results available."}
              <div className="h-20" />
            </div>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 gap-10 mt-8">
        <div></div> {/* Empty space to push buttons to the right column */}
        <div className="flex gap-4 w-full">
          <Button primary className="flex-1 w-full flex items-center justify-center px-4 py-3 text-sm whitespace-nowrap rounded-08 shadow-01 transition-all hover:scale-[1.02]" onClick={handleNavigationChange}> Accept all Change & Auto Fix </Button>
          <Button secondary className="flex-1 w-full flex items-center justify-center px-4 py-3 text-sm whitespace-nowrap rounded-08 border border-border hover:bg-background-neutral-02 transition-all" onClick={handleNavigationEdit}> Reject Changes (Edit Manually Next) </Button>
        </div>
      </div>
    </div>
  );
}
