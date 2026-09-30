import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BellRing, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";
import { cn } from "@/lib/utils";
import { sourceLine, useVisitSource } from "@/hooks/use-visit-source";

// Stored as a contact message with this subject (admin: "Être tenu informé")
const NOTIFY_SUBJECT = "notify";

/**
 * "Keep me informed": name + phone (WhatsApp) at least, email optional.
 * Used on the home page, the stand and while donations are not open yet.
 */
export default function NotifyForm({ className, stacked = false }: { className?: string; stacked?: boolean }) {
  const source = useVisitSource();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Indiquez votre nom et votre téléphone");
      return;
    }
    setLoading(true);
    try {
      await api.sendContactMessage({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: NOTIFY_SUBJECT,
        message: [
          "Souhaite être tenu informé des nouvelles campagnes et de l'ouverture des dons.",
          sourceLine(source),
        ]
          .filter(Boolean)
          .join("\n"),
      });
      setDone(true);
    } catch {
      toast.error("L'envoi a échoué. Vérifiez votre email et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl bg-accent p-4 text-accent-foreground", className)} role="status">
        <CheckCircle className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm">Merci {name.trim()} ! Nous vous préviendrons des prochaines campagnes.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn("space-y-3", className)} noValidate>
      <div className={cn("grid gap-3", !stacked && "sm:grid-cols-3")}>
        <div>
          <Label htmlFor="notify-name" className="sr-only">Nom</Label>
          <Input id="notify-name" placeholder="Votre nom *" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div>
          <Label htmlFor="notify-phone" className="sr-only">Téléphone (WhatsApp)</Label>
          <Input id="notify-phone" type="tel" placeholder="Téléphone / WhatsApp *" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div>
          <Label htmlFor="notify-email" className="sr-only">Email (facultatif)</Label>
          <Input id="notify-email" type="email" placeholder="Email (facultatif)" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
        </div>
      </div>
      <Button type="submit" disabled={loading} className={cn("h-11 w-full rounded-xl font-semibold", !stacked && "sm:w-auto")}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
        Me tenir informé
      </Button>
      <p className="text-xs text-muted-foreground">
        Avec un email, vous recevrez aussi nos nouvelles par email ; chaque message permet de se désabonner en un clic.
      </p>
    </form>
  );
}
