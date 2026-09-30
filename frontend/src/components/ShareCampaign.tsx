import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Link2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Project } from "@/api";
import { campaignShareUrl, nativeShare, whatsappLink } from "@/lib/share";
import { cn } from "@/lib/utils";

/** Share a campaign: WhatsApp first (how most donations spread), copy the link, or the phone's share sheet */
export default function ShareCampaign({ project, className }: { project: Project; className?: string }) {
  const [copied, setCopied] = useState(false);
  const canShareNatively = typeof navigator !== "undefined" && !!navigator.share;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(campaignShareUrl(project.id));
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button asChild variant="outline" className="flex-1 border-[#25D366]/50 text-foreground hover:bg-[#25D366]/10">
        <a href={whatsappLink(project)} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="mr-2 h-4 w-4 text-[#1DA851]" aria-hidden="true" />
          Partager sur WhatsApp
        </a>
      </Button>
      <Button type="button" variant="outline" onClick={copy} aria-label="Copier le lien de la campagne">
        {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
        <span className="ml-2 hidden sm:inline">Copier le lien</span>
      </Button>
      {canShareNatively && (
        <Button type="button" variant="outline" onClick={() => nativeShare(project)} aria-label="Autres applications">
          <Share2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
