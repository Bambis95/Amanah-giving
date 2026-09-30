import { Check, Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGS, useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** Français / English / Wolof; the choice is remembered on this device */
export default function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t.lang.label} : ${t.lang[lang]}`}
        title={t.lang.label}
        className={cn(
          "inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold uppercase text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        {lang}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t.lang.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGS.map((l) => (
          <DropdownMenuItem key={l} onClick={() => setLang(l)} className="cursor-pointer justify-between" lang={l}>
            {t.lang[l]}
            {l === lang && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
