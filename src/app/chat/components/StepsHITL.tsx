"use client";

interface StepsHITLProps {
  step: number;
  total?: number;
}

export default function StepsHITL({ step, total = 5 }: StepsHITLProps) {
  return (
    <div className="text-sm text-gray-500 font-medium">
      Step {step}/{total}
    </div>
  );
}