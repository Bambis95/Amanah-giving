import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Loader2, QrCode, Send } from "lucide-react";
import { toast } from "sonner";
import { api, Project } from "@/api";
import { BRAND_NAME } from "@/lib/brand";
import { PAYMENT_QR } from "@/lib/payment-qr";
import { sourceLine, useVisitSource } from "@/hooks/use-visit-source";
import { cn } from "@/lib/utils";

const GENERAL = "general";

function formatCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount);
}

/**
 * Pay by scanning the official Wave / Orange Money QR code, then declare the deposit so it can be
 * checked by the team and counted (the operator does not notify the platform of these payments).
 */
export default function MobileMoneyQR({ projects = [], className }: { projects?: Project[]; className?: string }) {
  const source = useVisitSource();
  const [operator, setOperator] = useState<"wave" | "orange_money">("wave");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [campaign, setCampaign] = useState(GENERAL);
  const [loading, setLoading] = useState(false);
  const [declared, setDeclared] = useState<number | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseInt(amount.replace(/\D/g, ""), 10);
    if (!value || value < 100) return toast.error("Indiquez le montant envoyé (100 FCFA minimum)");
    if (reference.trim().length < 4) return toast.error("Indiquez la référence de la transaction (reçue par SMS)");
    if (phone.trim().length < 6) return toast.error("Indiquez le numéro utilisé pour le paiement");
    setLoading(true);
    try {
      await api.declareMobileDeposit({
        amount: value,
        payment_method: operator,
        transaction_ref: reference.trim(),
        donor_phone: phone.trim(),
        donor_first_name: firstName.trim() || undefined,
        donor_last_name: lastName.trim() || undefined,
        donor_email: email.trim() || undefined,
        project_id: campaign === GENERAL ? undefined : Number(campaign),
        cause: GENERAL,
        message: sourceLine(source) ?? undefined,
      });
      setDeclared(value);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "La déclaration n'a pas pu être envoyée.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={cn("space-y-6", className)} aria-labelledby="qr-title">
      <div className="text-center">
        <h2 id="qr-title" className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
          <QrCode className="h-6 w-6 text-primary" aria-hidden="true" />
          Payer en scannant le QR code
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Scannez le QR code officiel {BRAND_NAME} avec votre application Wave ou Orange Money, puis déclarez votre
          dépôt ci-dessous pour qu'il soit affecté à la campagne choisie.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PAYMENT_QR.map((qr) => (
          <Card key={qr.id} className="overflow-hidden shadow-sm">
            <div className="h-2" style={{ backgroundColor: qr.color }} aria-hidden="true" />
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-lg font-bold text-foreground">{qr.name}</p>
              {qr.image ? (
                <img
                  src={qr.image}
                  alt={`QR code ${qr.name} ${BRAND_NAME}`}
                  className="h-52 w-52 rounded-xl bg-white object-contain p-2 ring-1 ring-black/5"
                />
              ) : (
                <div className="flex h-52 w-52 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground">
                  <QrCode className="h-12 w-12" aria-hidden="true" />
                  <span className="text-sm">QR code bientôt disponible</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Ouvrez {qr.name}, touchez « Scanner », puis saisissez le montant de votre don.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-6 sm:p-8">
          {declared !== null ? (
            <div className="py-6 text-center" role="status">
              <CheckCircle className="mx-auto mb-3 h-12 w-12 text-primary" aria-hidden="true" />
              <h3 className="mb-2 text-xl font-bold text-foreground">Merci pour votre don !</h3>
              <p className="text-muted-foreground">
                Votre dépôt de {formatCFA(declared)} FCFA est enregistré. Il sera confirmé après vérification par
                l'équipe {BRAND_NAME}
                {email.trim() ? ", et vous recevrez un email de confirmation." : "."}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate aria-label="Déclarer mon dépôt">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Opérateur utilisé">
                {PAYMENT_QR.map((qr) => (
                  <button
                    key={qr.id}
                    type="button"
                    role="radio"
                    aria-checked={operator === qr.id}
                    onClick={() => setOperator(qr.id)}
                    className={cn(
                      "rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                      operator === qr.id ? "border-primary bg-accent text-accent-foreground" : "border-border text-foreground/80 hover:border-primary/40"
                    )}
                  >
                    {qr.name}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="dep-amount">Montant envoyé (FCFA) *</Label>
                  <Input id="dep-amount" inputMode="numeric" placeholder="Ex. : 5 000" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-11 rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="dep-ref">Référence de la transaction *</Label>
                  <Input id="dep-ref" placeholder="Ex. : T123ABC456" value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 h-11 rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="dep-phone">Numéro utilisé pour payer *</Label>
                  <Input id="dep-phone" type="tel" autoComplete="tel" placeholder="+221 7X XXX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-11 rounded-xl" />
                </div>
                <div>
                  <Label>Campagne soutenue</Label>
                  <Select value={campaign} onValueChange={setCampaign}>
                    <SelectTrigger className="mt-1 h-11 rounded-xl" aria-label="Campagne soutenue">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GENERAL}>Don général</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dep-first">Prénom</Label>
                  <Input id="dep-first" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 h-11 rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="dep-last">Nom</Label>
                  <Input id="dep-last" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 h-11 rounded-xl" />
                </div>
              </div>
              <div>
                <Label htmlFor="dep-email">Email (pour recevoir la confirmation)</Label>
                <Input id="dep-email" type="email" autoComplete="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11 rounded-xl" />
              </div>

              <Button type="submit" size="lg" disabled={loading} className="w-full rounded-xl font-semibold">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Déclarer mon dépôt
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Votre don est compté dans la campagne une fois le dépôt vérifié par l'équipe {BRAND_NAME}.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
