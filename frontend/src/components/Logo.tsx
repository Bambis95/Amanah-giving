import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_SHORT } from "@/lib/brand";

interface LogoProps {
  size?: "sm" | "md";
  /** "onDark" for dark brand surfaces (footer): text stays light whatever the theme */
  variant?: "default" | "onDark";
  showText?: boolean;
  className?: string;
}

/** Club mark (temporary until the club's logo is added), shared by the header, the mobile menu and the footer. */
export default function Logo({ size = "md", variant = "default", showText = true, className }: LogoProps) {
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className={cn("flex shrink-0 items-center justify-center bg-primary shadow-sm", box)}>
        <Sprout className={cn("text-primary-foreground", icon)} aria-hidden="true" />
      </span>
      {showText && (
        <span className="flex flex-col leading-tight">
          <span className={cn("text-lg font-bold tracking-wide", variant === "onDark" ? "text-white" : "text-foreground")}>
            {BRAND_SHORT}
          </span>
          <span className="-mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Collecte nationale
          </span>
        </span>
      )}
    </span>
  );
}
