import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Loader2, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { useSiteStatus } from "@/hooks/use-site-status";
import { MEMBERSHIP_CAUSE } from "@/lib/categories";
import { cn } from "@/lib/utils";

const METHODS = [
  { value: "wave", label: "Wave", icon: Smartphone },
  { value: "orange_money", label: "Orange Money", icon: Wallet },
  { value: "card", label: "Carte", icon: CreditCard },
] as const;

export interface MemberContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/** Pay the club membership fee online (amount set in Réglages du site); nothing when not offered */
export default function MembershipFeeCard({ prefill, className }: { prefill?: MemberContact; className?: string }) {
  const site = useSiteSettings();
  const { donationsEnabled } = useSiteStatus();
  const [contact, setContact] = useState<MemberContact>(prefill ?? { firstName: "", lastName: "", email: "", phone: "" });
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("wave");
  const [loading, setLoading] = useState(false);

  const fee = site.membership_fee;
  if (!fee || !donationsEnabled) return null;
  const amount = `${new Intl.NumberFormat("fr-FR").format(fee)} FCFA`;
  const set = (key: keyof MemberContact, value: string) => setContact((c) => ({ ...c, [key]: value }));

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.firstName.trim() || !contact.email.trim()) {
      toast.error("Indiquez au moins votre prénom et votre email");
      return;
    }
    setLoading(true);
    try {
      const response = await api.createDonationCheckout({
        amount: fee,
        cause: MEMBERSHIP_CAUSE,
        payment_method: method,
        donor_first_name: contact.firstName.trim(),
        donor_last_name: contact.lastName.trim() || undefined,
        donor_email: contact.email.trim(),
        donor_phone: contact.phone.trim() || undefined,
        message: site.membership_fee_label ?? "Cotisation",
      });
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
        return; // keep the spinner while the browser leaves
      }
      toast.error("Le paiement n'a pas pu démarrer. Réessayez.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Le paiement n'a pas pu démarrer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="p-5 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-highlight">{site.membership_fee_label ?? "Cotisation"}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{amount}</p>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Réglez votre cotisation en ligne : un reçu vous est envoyé par email.</p>
        <form onSubmit={pay} className="space-y-3">
          {!prefill && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fee-first">Prénom *</Label>
                  <Input id="fee-first" autoComplete="given-name" value={contact.firstName} onChange={(e) => set("firstName", e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fee-last">Nom</Label>
                  <Input id="fee-last" autoComplete="family-name" value={contact.lastName} onChange={(e) => set("lastName", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fee-email">Email *</Label>
                <Input id="fee-email" type="email" autoComplete="email" value={contact.email} onChange={(e) => set("email", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fee-phone">Téléphone</Label>
                <Input id="fee-phone" type="tel" autoComplete="tel" value={contact.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
            </>
          )}
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Moyen de paiement">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={method === m.value}
                onClick={() => setMethod(m.value)}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-semibold transition-colors",
                  method === m.value ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <m.icon className="h-4 w-4" aria-hidden="true" />
                {m.label}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={loading} className="h-11 w-full font-semibold">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Payer {amount}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
