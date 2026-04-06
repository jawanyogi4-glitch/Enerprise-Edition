"use client";

import * as Layouts from "@/refresh-components/layouts/layouts";
import StepsHITL from "../../components/StepsHITL";
import Button from "@/refresh-components/buttons/Button";
import { useRouter } from "next/navigation";
import { RootState } from "@/redux/store";
import { useSelector, useDispatch } from "react-redux";
import { useTemplateThunk } from "@/redux/template";
import { useEffect, useState } from "react";
import PageLoader from "../../components/loaders/PageLoader";

export default function Page({ settings, chatSession }: any) {
  const router = useRouter();
  const dispatch = useDispatch();

  const { formData, templates, loading } = useSelector(
    (state: RootState) => state.template
  );

  const [contractText, setContractText] = useState<string>("");
  const [contractTitle, setContractTitle] = useState<string>("");

  useEffect(() => {
    const { contract_text, contract_title } = templates?.data?.[0] || {};
    setContractText(contract_text || "");
    setContractTitle(contract_title || "");
  }, [templates]);

  const handleNavigationUseTemplate = async () => {
    if (!templates?.data?.length) return;

    const resultAction = await dispatch(
      useTemplateThunk({
        document_title: formData?.title,
        effective_date: formData?.effectiveDate,
        country: formData?.country,
        state: formData?.state,
        description: formData?.description,
      }) as any
    );

    if (useTemplateThunk.fulfilled.match(resultAction)) {
      router.push("/chat/ai-drafting/initial-draft");
    }
  };

  const handleNavigationGenerateFromScratch = () => {
    router.push("/chat/docgen_hitl");
  };

  return (
    <Layouts.AppPage settings={settings} chatSession={chatSession}>
      {loading && <PageLoader text="Selecting Template..." />}

      <div className="w-full min-h-screen px-10 py-8 overflow-y-auto bg-background text-text">

        {/* STEP HEADER */}
        <StepsHITL step={2} title="Select Template" />

        {/* MATCH INFO */}
        <div className="mt-6 mb-6 px-4 py-3 rounded-md bg-[#F0F0F1] dark:bg-background-neutral-02 text-[#6C6C6D] dark:text-text-03 text-[14px]">
          Match Found : {contractTitle || "N/A"}
        </div>

        {/* PREVIEW TITLE */}
        <h2 className="text-[#6C6C6D] dark:text-text-03 text-[16px] mb-2">
          Preview
        </h2>

        {/* PREVIEW BOX */}
        <div className="h-[500px] overflow-y-auto rounded-md border border-gray-300 dark:border-border bg-white dark:bg-background-neutral-03 p-6 default-scrollbar">

          {contractText ? (
            <pre className="whitespace-pre-wrap font-sans text-[#6C6C6D] dark:text-text-02 text-[16px] leading-relaxed">
              {contractText}
            </pre>
          ) : (
            <p className="text-[#6C6C6D] dark:text-text-03 text-[16px]">No preview available.</p>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex justify-center gap-6 mt-10">

          <Button
            primary
            className="px-8 py-3 rounded-08 shadow-01 transition-all hover:scale-[1.02]"
            onClick={handleNavigationUseTemplate}
          >
            Use This Template
          </Button>

          <Button
            secondary
            className="px-8 py-3 rounded-08 border border-border hover:bg-background-neutral-02 transition-all"
            onClick={handleNavigationGenerateFromScratch}
          >
            Generate From Scratch
          </Button>

        </div>
      </div>
    </Layouts.AppPage>
  );
}