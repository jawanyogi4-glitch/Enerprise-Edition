"use client";

import React from "react";
import { SvgProps } from "@/icons";
import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import {
  ART_ASSISTANT_ID,
  DEFAULT_ASSISTANT_ID,
  GENERAL_ASSISTANT_ID,
  IMAGE_ASSISTANT_ID,
} from "@/lib/constants";
import SvgLightbulbSimple from "@/icons/lightbulb-simple";
import { QiLegalIcon } from "@/components/icons/icons";
import SvgImage from "@/icons/image";
import { generateIdenticon } from "@/refresh-components/AgentIcon";
import { buildImgUrl } from "@/app/chat/components/files/images/utils";
import { cn } from "@/lib/utils";
import { CaseAnalysisIcon } from "@/icons/CaseAnalysisIcon";
import { LegacySearchIcon } from "@/icons/LegacySearchIcon";

export function getAgentIcon(
  agent: MinimalPersonaSnapshot
): React.FunctionComponent<SvgProps> {
  if (agent.id === DEFAULT_ASSISTANT_ID) return QiLegalIcon;
  if (agent.id === GENERAL_ASSISTANT_ID) return SvgLightbulbSimple;
  if (agent.id === IMAGE_ASSISTANT_ID || agent.id === ART_ASSISTANT_ID)
    return SvgImage;

  // Custom Case Analysis icon
  if (agent.icon_shape === 23014) {
    const CaseIcon: React.FunctionComponent<SvgProps> = ({ className }) => (
      <CaseAnalysisIcon size={16} className={className} />
    );
    CaseIcon.displayName = "SidebarCaseAnalysisIcon";
    return CaseIcon;
  }

  // Custom Legacy Search icon
  if (agent.icon_shape === 11555) {
    const LegacyIcon: React.FunctionComponent<SvgProps> = ({ className }) => (
      <LegacySearchIcon size={16} className={className} />
    );
    LegacyIcon.displayName = "SidebarLegacySearchIcon";
    return LegacyIcon;
  }

  const uploadedImageId = agent.uploaded_image_id;
  if (uploadedImageId) {
    const UploadedImageIcon: React.FunctionComponent<SvgProps> = ({
      className,
    }) => (
      <div className={cn("w-full h-full", className)}>
        <img
          alt={agent.name}
          src={buildImgUrl(uploadedImageId)}
          loading="lazy"
          className="w-full h-full rounded-full object-cover object-center"
        />
      </div>
    );
    UploadedImageIcon.displayName = "SidebarUploadedAgentIcon";
    return UploadedImageIcon;
  }
  const GeneratedIcon: React.FunctionComponent<SvgProps> = ({ className }) => (
    <div className={cn("w-full h-full", className)}>
      {generateIdenticon((agent.icon_shape || 0).toString(), 16)}
    </div>
  );
  GeneratedIcon.displayName = "SidebarGeneratedAgentIcon";
  return GeneratedIcon;
}
