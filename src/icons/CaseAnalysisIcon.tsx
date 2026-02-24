"use client";

import { Scale } from "lucide-react";
import { IconProps } from "@/icons";

export const CaseAnalysisIcon = ({
  size = 24,
  className = "",
  ...props
}: IconProps) => {
  return <Scale width={size} height={size} className={className} {...props} />;
};
