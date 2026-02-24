import { useMemo } from "react";
import { useSettingsContext } from "@/components/settings/SettingsProvider";
import { NEXT_PUBLIC_DO_NOT_USE_TOGGLE_OFF_DANSWER_POWERED } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Text from "@/refresh-components/texts/Text";

export const FOLDED_SIZE = 24;

export interface LogoProps {
  folded?: boolean;
  className?: string;
}

export default function Logo({ folded, className }: LogoProps) {
  const settings = useSettingsContext();

  // If enterprise logo override is enabled, keep their logic (optional)
  const enterpriseLogo = useMemo(() => {
    if (settings.enterpriseSettings?.use_custom_logo) {
      return (
        <img
          src="/api/enterprise-settings/logo"
          alt="Logo"
          style={{
            objectFit: "contain",
            height: FOLDED_SIZE,
            width: FOLDED_SIZE,
          }}
          className={cn("flex-shrink-0", className)}
        />
      );
    }
    return null;
  }, [className, settings.enterpriseSettings?.use_custom_logo]);

  // **Your logo logic here**
  const logo = enterpriseLogo ?? (
    <img
      src="/logo_qilegal.png"
      alt="QiLegal Logo"
      width={FOLDED_SIZE}
      height={FOLDED_SIZE}
      className={cn("flex-shrink-0", className)}
      style={{ objectFit: "contain" }}
    />
  );

  // COLLAPSED SIDEBAR (folded = true)
  if (folded) {
    return logo;
  }

  // EXPANDED SIDEBAR (folded = false)
  return settings.enterpriseSettings?.application_name ? (
    <div className="flex flex-col">
      <div className="flex flex-row items-center gap-2">
        {logo}

        {/* Application name left untouched */}
        <Text headingH3 className="break-all line-clamp-2">
          {settings.enterpriseSettings?.application_name}
        </Text>
      </div>

      {!NEXT_PUBLIC_DO_NOT_USE_TOGGLE_OFF_DANSWER_POWERED && (
        <Text secondaryBody text03 className="ml-[33px]">
          Powered by QiLegal
        </Text>
      )}
    </div>
  ) : (
    // **QiLegal full logotype**
    <img
      src="/logotype_qilegal.png"
      alt="QiLegal Logotype"
      width={160}
      height={40}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
