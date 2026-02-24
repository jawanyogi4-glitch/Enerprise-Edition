"use client";

import { useContext } from "react";
import { SettingsContext } from "../settings/SettingsProvider";
import { cn } from "@/lib/utils";

export function Logo({
  height,
  width,
  className,
  size = "default",
}: {
  height?: number;
  width?: number;
  className?: string;
  size?: "small" | "default" | "large";
}) {
  const settings = useContext(SettingsContext);

  const sizeMap = {
    small: { height: 24, width: 22 },
    default: { height: 32, width: 30 },
    large: { height: 48, width: 45 },
  };

  const { height: defaultHeight, width: defaultWidth } = sizeMap[size];
  height = height || defaultHeight;
  width = width || defaultWidth;

  // If enterprise custom logo is enabled → keep that behavior
  if (settings?.enterpriseSettings?.use_custom_logo) {
    return (
      <div
        style={{ height, width }}
        className={cn("flex-none relative", className)}
      >
        <img
          src="/api/enterprise-settings/logo"
          alt="Logo"
          style={{ objectFit: "contain", height, width }}
        />
      </div>
    );
  }

  // Otherwise always use QiLegal logo (no color modifications)
  return (
    <div style={{ height, width }} className={cn("flex-none", className)}>
      <img
        src="/logo_qilegal.png"
        alt="QiLegal Logo"
        className="object-contain w-full h-full"
        style={{ height, width }}
      />
    </div>
  );
}
