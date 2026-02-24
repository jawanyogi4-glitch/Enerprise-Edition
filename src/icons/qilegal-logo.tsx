import * as React from "react";
import { cn } from "@/lib/utils";

const QiLegalLogo = ({
  className,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) => (
  <img
    src="/logo_qilegal.png"
    alt="QiLegal Logo"
    className={cn("object-contain", className)}
    {...props}
  />
);

export default QiLegalLogo;
