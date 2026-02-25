"use client";

import Link from "next/link";
import StepsHITL from "../../components/StepsHITL";
import Button from "@/refresh-components/buttons/Button";
import { useRouter } from "next/navigation";

export default function InitialDraftPage() {
    const router = useRouter();
    const handleNavigation = () => {
        router.push("/chat/ai-drafting/contract-review");
    }
    return (
        <div className="p-8 w-full min-h-screen overflow-y-auto bg-white">
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

                <div className="space-y-6 text-sm leading-6 text-gray-800">

                    <div>
                        <h3 className="font-semibold mb-2">1. PARTIES</h3>

                        <p className="mb-2">
                            <strong>Mortgagor (Borrower):</strong><br />
                            Mr. Arjun Mehta<br />
                            S/o Rajesh Mehta<br />
                            Aged 38 years<br />
                            Residing at: Flat No. 1203, Sunshine Residency, Andheri East, Mumbai – 400069<br />
                            PAN: ABCPM1234K
                        </p>

                        <p>
                            <strong>Mortgagee (Lender):</strong><br />
                            ABC National Bank Ltd.<br />
                            Registered Office: 21 Finance Plaza, Bandra Kurla Complex, Mumbai – 400051<br />
                            Through its Authorized Signatory: Ms. Neha Kapoor
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-2">2. LOAN DETAILS</h3>

                        <p>
                            Loan Amount: ₹75,00,000 (Rupees Seventy-Five Lakhs Only)<br />
                            Loan Account Number: HL2026MUM45821<br />
                            Interest Rate: 8.50% per annum (Floating)<br />
                            Loan Tenure: 20 Years (240 Months)<br />
                            EMI Amount: ₹65,124<br />
                            EMI Start Date: 05 February 2026
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-2">5. DECLARATION</h3>

                        <p>
                            The Mortgagor declares that the property is free from all encumbrances and legal disputes and that he/she has full right and authority to mortgage the said property.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-2">6. SIGNATURES</h3>

                        <p className="mb-4">
                            Signed and delivered by:
                        </p>

                        <p>
                            Mortgagor<br />
                            Signature: ______________________<br />
                            Name: Arjun Mehta
                        </p>

                        <p className="mt-4">
                            Mortgagee (For ABC National Bank Ltd.)<br />
                            Signature: ______________________<br />
                            Name: Neha Kapoor<br />
                            Designation: Authorized Signatory
                        </p>

                        <p className="mt-4">
                            Witnesses<br />
                            Name: ______________________<br />
                            Signature: ______________________<br /><br />
                            Name: ______________________<br />
                            Signature: ______________________
                        </p>
                    </div>

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