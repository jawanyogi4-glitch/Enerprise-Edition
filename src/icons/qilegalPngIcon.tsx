import React from "react";
import { SvgProps } from "@/icons";

const QiLegalPngIcon: React.FC<SvgProps> = ({ className }) => {
  return (
    <img
      src="/logo_qilegal.png"
      alt="QiLegal Icon"
      className={`object-contain ${className || ""}`}
      width={16}
      height={16}
    />
  );
};

export default QiLegalPngIcon;
