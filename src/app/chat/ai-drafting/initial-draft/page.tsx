"use client";

import * as Layouts from "@/refresh-components/layouts/layouts";
import StepsHITL from "../../components/StepsHITL";
import Button from "@/refresh-components/buttons/Button";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/redux/store";
import { runAIContractReview } from "@/redux/template";
import PageLoader from "../../components/loaders/PageLoader";

export default function InitialDraftPage({ settings, chatSession }: any) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const { usedTemplate, loading } = useSelector(
    (state: RootState) => state.template
  );

  const handleNavigation = async () => {
    if (!usedTemplate?.meta?.request_id) {
      alert("Request ID missing");
      return;
    }

    const resultAction = await dispatch(
      runAIContractReview({
        request_id: usedTemplate?.meta?.request_id,
      })
    );

    if (runAIContractReview.fulfilled.match(resultAction)) {
      router.push("/chat/ai-drafting/contract-review");
    }
  };

  return (
    <Layouts.AppPage settings={settings} chatSession={chatSession}>
      {loading && <PageLoader text="Running AI Review..." />}

      <div className="w-full min-h-screen px-10 py-8 overflow-y-auto bg-background text-text">

        {/* STEP HEADER */}
        <StepsHITL step={3} title="Initial Draft Generated" />

        {/* INFO BOX */}
        <div className="mt-6 mb-6 px-4 py-3 rounded-md bg-[#F0F0F1] dark:bg-background-neutral-02 text-[#6C6C6D] dark:text-text-03 text-[14px]">
          This is the raw draft. Proceed to the AI Reviewer to check for risks.
        </div>

        {/* TITLE */}
        <h2 className="text-[#6C6C6D] dark:text-text-03 text-[16px] mb-2">
          Current Draft
        </h2>

        {/* SCROLLABLE BOX */}
        <div className="h-[500px] overflow-y-auto rounded-md border border-gray-300 dark:border-border bg-white dark:bg-background-neutral-03 p-6 default-scrollbar">
          <div className="whitespace-pre-wrap font-sans text-[#6C6C6D] dark:text-text-02 text-[16px] leading-relaxed">
            {usedTemplate?.data || "No template data available"}
          </div>
        </div>

        {/* ACTION BUTTON */}
        <div className="flex justify-center mt-10 pb-10">
          <Button
            primary
            className="px-8 py-3 rounded-08 shadow-01 transition-all hover:scale-[1.02]"
            onClick={handleNavigation}
          >
            Run AI Contract Review
          </Button>
        </div>

      </div>
    </Layouts.AppPage>
  );
}