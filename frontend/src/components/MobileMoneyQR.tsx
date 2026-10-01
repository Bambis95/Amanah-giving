import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Loader2, QrCode, Send, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { api, Project } from "@/api";
import { BRAND_NAME } from "@/lib/brand";
import { PAYMENT_QR } from "@/lib/payment-qr";
import { sourceLine, useVisitSource } from "@/hooks/use-visit-source";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const GENERAL = "general";

function formatCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount);
}

/**
 * Pay by scanning the official Wave / Orange Money QR code, then declare the deposit so it can be
 * checked by the team and counted (the operator does not notify the platform of these payments).
 */
interface MobileMoneyQRProps {
  projects?: Project[];
  /** Amount already chosen on the page: fills the form */
  amount?: number | null;
  /** Campaign already chosen (?project=ID, e.g. from a poster): selected in the form */
  projectId?: string | null;
  className?: string;
}

export default function MobileMoneyQR({ projects = [], amount: chosenAmount, projectId, className }: MobileMoneyQRProps) {
  const source = useVisitSource();
  const { t: dict } = useI18n();
  const t = dict.qr;
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
  const [anonymous, setAnonymous] = useState(true);

  useEffect(() => {
    if (chosenAmount && chosenAmount > 0) setAmount(String(chosenAmount));
  }, [chosenAmount]);

  useEffect(() => {
    if (projectId && projects.some((p) => String(p.id) === projectId)) setCampaign(projectId);
  }, [projectId, projects]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseInt(amount.replace(/\D/g, ""), 10);
    if (!value || value < 100) return toast.error(t.errAmount);
    if (reference.trim().length < 4) return toast.error(t.errReference);
    if (phone.trim().length < 6) return toast.error(t.errPhone);
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
        anonymous,
      });
      setDeclared(value);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errSend);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="qr-paiement" className={cn("scroll-mt-20 space-y-6", className)} aria-labelledby="qr-title">
      <div className="text-center">
        <h2 id="qr-title" className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
          <QrCode className="h-6 w-6 text-primary" aria-hidden="true" />
          {t.title}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          {t.intro(BRAND_NAME)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PAYMENT_QR.map((qr) => (
          <Card key={qr.id} className="overflow-hidden shadow-sm">
            <div className="h-2" style={{ backgroundColor: qr.color }} aria-hidden="true" />
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-lg font-bold text-foreground">{qr.name}</p>
              {qr.url ? (
                // White background in both themes: scanners need dark modules on light
                <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
                  <QRCodeSVG value={qr.url} size={184} level="M" marginSize={0} title={`QR code ${qr.name} ${BRAND_NAME}`} />
                </div>
              ) : (
                <div className="flex h-52 w-52 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground">
                  <QrCode className="h-12 w-12" aria-hidden="true" />
                  <span className="text-sm">{t.soon}</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {t.howTo(qr.name)}
              </p>
              {/* On a phone the screen cannot scan itself: the same link opens the operator's app */}
              {qr.url && (
                <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-2 font-semibold" style={{ borderColor: qr.color }}>
                  <a href={qr.url} target="_blank" rel="noopener noreferrer">
                    <Smartphone className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t.openApp(qr.name)}
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-6 sm:p-8">
          {declared !== null ? (
            <div className="py-6 text-center" role="status">
              <CheckCircle className="mx-auto mb-3 h-12 w-12 text-primary" aria-hidden="true" />
              <h3 className="mb-2 text-xl font-bold text-foreground">{t.thanks}</h3>
              <p className="text-muted-foreground">
                {t.declared(formatCFA(declared), BRAND_NAME, !!email.trim())}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate aria-label={t.form}>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.operator}>
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
                  <Label htmlFor="dep-amount">{t.amount}</Label>
                  <Input id="dep-amount" inputMode="numeric" placeholder={t.amountPlaceholder} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-11 rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="dep-ref">{t.reference}</Label>
                  <Input id="dep-ref" placeholder={t.referencePlaceholder} value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 h-11 rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="dep-phone">{t.phone}</Label>
                  <Input id="dep-phone" type="tel" autoComplete="tel" placeholder="+221 7X XXX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-11 rounded-xl" />
                </div>
                <div>
                  <Label>{t.campaign}</Label>
                  <Select value={campaign} onValueChange={setCampaign}>
                    <SelectTrigger className="mt-1 h-11 rounded-xl" aria-label={t.campaign}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GENERAL}>{t.general}</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dep-first">{t.firstName}</Label>
                  <Input id="dep-first" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 h-11 rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="dep-last">{t.lastName}</Label>
                  <Input id="dep-last" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 h-11 rounded-xl" />
                </div>
              </div>
              <div>
                <Label htmlFor="dep-email">{t.email}</Label>
                <Input id="dep-email" type="email" autoComplete="email" placeholder={t.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11 rounded-xl" />
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground/80">
                <Checkbox checked={anonymous} onCheckedChange={(v) => setAnonymous(v === true)} className="mt-0.5" />
                <span>
                  {dict.anon.label}
                  <span className="block text-xs text-muted-foreground">{dict.anon.hint}</span>
                </span>
              </label>

              <Button type="submit" size="lg" disabled={loading} className="w-full rounded-xl font-semibold">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {t.submit}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t.note(BRAND_NAME)}
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
