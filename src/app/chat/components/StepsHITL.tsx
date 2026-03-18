"use client";

interface StepsHITLProps {
  step: number;
  total?: number;
  title: string;
}

export default function StepsHITL({ step, total = 5, title }: StepsHITLProps) {
  return (
    <>
    <div className="top-[55px] left-[270px] text-[16px] leading-[21px] text-[#707070] dark:text-gray-400">
      Step {step}/{total}
    </div>
    <div className="mb-10">
      <h1 className="text-4xl font-bold pt-1 pb-1 mb-2 text-[#1C1C1C] dark:text-white">
        {title}
      </h1>

      <div className="w-full border-b border-[#6C6C6D] dark:border-gray-700"></div>
    </div>
    </>
  );
}