import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md";
  /** "onDark" for dark brand surfaces (footer): text stays light whatever the theme */
  variant?: "default" | "onDark";
  showText?: boolean;
  className?: string;
}

/**
 * SENJAPO mark, shared by the header, the mobile menu and the footer: the official emblem
 * (public/logo-mark-192.png, cut from the logo) on a white tile, so it reads on any background,
 * and the name coloured as in the logo ("SEN" blue, "JAPO" orange).
 */
export default function Logo({ size = "md", variant = "default", showText = true, className }: LogoProps) {
  const tile = size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <img
        src="/logo-mark-192.png"
        alt=""
        width={40}
        height={40}
        className={cn("shrink-0 bg-white object-contain p-0.5 shadow-sm ring-1 ring-black/5", tile)}
      />
      {showText && (
        <span className="flex flex-col leading-tight">
          <span className="text-lg font-extrabold tracking-wide">
            <span className={variant === "onDark" ? "text-white" : "text-primary"}>SEN</span>
            <span className="text-highlight">JAPO</span>
          </span>
          <span className={cn("-mt-0.5 text-[10px] font-semibold uppercase tracking-wider", variant === "onDark" ? "text-white/70" : "text-muted-foreground")}>
            Solidarité nationale
          </span>
        </span>
      )}
    </span>
  );
}
