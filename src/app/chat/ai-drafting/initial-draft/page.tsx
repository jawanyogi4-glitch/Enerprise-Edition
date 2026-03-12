"use client";

import Link from "next/link";
import StepsHITL from "../../components/StepsHITL";
import Button from "@/refresh-components/buttons/Button";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/redux/store";
import { runAIContractReview } from "@/redux/template";
import PageLoader from "../../components/loaders/PageLoader";

export default function InitialDraftPage() {
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
    }
    return (
        <div className="p-8 w-full min-h-screen overflow-y-auto bg-white">
            {loading && <PageLoader text="Running AI Review..." />}
            <StepsHITL step={3} />
            <h1 className="text-2xl font-bold mb-4">
                Initial Draft Generated
            </h1>

            <div className="bg-gray-100 p-4 rounded-lg mb-6 text-sm text-gray-700">
                This is the raw draft. Proceed to the AI Reviewer to check for risks.
            </div>

            <h2 className="text-lg font-semibold mb-4">
                Current Draft
            </h2>

            {/* SCROLLABLE DRAFT BOX */}
            <div className="border rounded-lg p-6 bg-white max-h-[600px] overflow-y-auto shadow-sm">
                <div className="text-sm leading-6 text-gray-800 whitespace-pre-wrap">
                    {usedTemplate?.data || "No template data available"}
                </div>
            </div>

            <div className="flex justify-center gap-6 mt-8">

                {/* <a
                    href="/chat/ai-drafting/contract-review"
                    className="px-8 py-3 bg-black text-white rounded-lg hover:opacity-90 transition"
                >
                    Run AI Contract Review
                </a> */}

                <Button className="px-8 py-3 bg-black text-white rounded-lg hover:opacity-90 transition" onClick={handleNavigation}> Run AI Contract Review </Button>

            </div>
        </div>
    );
}