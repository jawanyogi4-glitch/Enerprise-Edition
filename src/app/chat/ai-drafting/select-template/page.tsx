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
  const [requestId, setRequestId] = useState<string>("");

  useEffect(() => {
    const { contract_text, contract_title } = templates?.data?.[0] || {};
    const { request_id } = templates?.meta || {};
    setContractText(contract_text || "");
    setContractTitle(contract_title || "");
    setRequestId(request_id || "");
  }, []);

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
    router.push("/chat/ai-drafting/generate-from-scratch");
  };

  return (
    <Layouts.AppPage settings={settings} chatSession={chatSession}>
      {loading && <PageLoader text="Select Template..." />}
      <div className="w-full min-h-screen bg-gray-50 px-10 py-8 overflow-y-auto">

        <StepsHITL step={2} />

        <h1 className="text-3xl font-bold mb-6 mt-4">
          Select Template
        </h1>

        <div className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg mb-6">
          Match Found :{" "}
          <span className="font-semibold">
            {contractTitle || "N/A"}
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">

          <h2 className="text-lg font-semibold mb-4">Preview</h2>

          <div className="h-[500px] overflow-y-auto border rounded-lg p-6 bg-gray-100 text-sm leading-relaxed">

            {contractText ? (
              <pre className="whitespace-pre-wrap">
                {contractText}
              </pre>
            ) : (
              <p className="text-gray-500">No preview available.</p>
            )}
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