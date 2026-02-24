"use client";

import { IconProps } from "@/icons";
import { Gavel } from "lucide-react";

export const LegacySearchIcon = ({
  size = 24,
  className = "",
  ...props
}: IconProps) => {
  return (
    <Gavel
      width={size}
      height={size}
      className={className}
      strokeWidth={1.8}
      {...props}
    />
  );
};
