import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BadgeCheck, Crown, Flag, Loader2, MessageCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { tontineApi, TontineGroup } from "@/api";
import { formatCFA } from "@/components/admin/format";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { useTontineText } from "@/i18n/tontine";
import { whatsappLink } from "./labels";

/** "Premium until …" / "Free" and "Verified" / "Not verified" */
export function GroupBadges({ group }: { group: TontineGroup }) {
  const { tt, dayName } = useTontineText();
  return (
    <>
      {group.premium ? (
        <Badge className="gap-1 bg-highlight text-highlight-foreground">
          <Crown className="h-3 w-3" aria-hidden="true" />
          {group.premium_until ? tt.premiumUntil(dayName(group.premium_until)) : tt.premium}
        </Badge>
      ) : (
        <Badge variant="outline">{tt.free}</Badge>
      )}
      {group.verified ? (
        <Badge variant="outline" className="gap-1 border-success/50 text-success">
          <BadgeCheck className="h-3 w-3" aria-hidden="true" />{tt.verified}
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 text-muted-foreground" title={tt.notVerifiedHelp}>
          <ShieldAlert className="h-3 w-3" aria-hidden="true" />{tt.notVerified}
        </Badge>
      )}
    </>
  );
}

/** How to go Premium: a WhatsApp message to the club, which activates it after the payment */
export function PremiumDialog({ group, open, onOpenChange }: { group: TontineGroup; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { tt } = useTontineText();
  const site = useSiteSettings();
  const link = site.whatsapp_number ? whatsappLink(site.whatsapp_number, tt.premiumMessage(group.name, group.id)) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-highlight" aria-hidden="true" />{tt.premiumTitle}</DialogTitle>
          <DialogDescription>{tt.premiumHelp(formatCFA(group.premium_price))}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{tt.planPremium(formatCFA(group.premium_price))}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tt.backBtn}</Button>
          {link && (
            <Button asChild>
              <a href={link} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />{tt.premiumWhatsApp}</a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Any member warns SENJAPO about their association */
export function ReportButton({ group }: { group: TontineGroup }) {
  const { tt } = useTontineText();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await tontineApi.report(group.id, reason.trim());
      toast.success(tt.reportSent);
      setOpen(false);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tt.actionError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <Flag className="mr-1.5 h-4 w-4" />{tt.report}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tt.reportTitle}</DialogTitle>
            <DialogDescription>{tt.reportHelp}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder={tt.reportPlaceholder} aria-label={tt.reportPlaceholder} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tt.backBtn}</Button>
            <Button variant="destructive" disabled={busy || reason.trim().length < 5} onClick={send}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tt.reportSend}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
