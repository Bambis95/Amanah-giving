import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import { ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Veuillez saisir votre email");
      return;
    }
    setLoading(true);
    try {
      setSentMessage(await api.forgotPassword(email.trim()));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "La demande a échoué");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={sentMessage ? "Vérifiez votre boîte mail" : "Mot de passe oublié"}
      subtitle={
        sentMessage ??
        "Saisissez l'email de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe."
      }
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à la connexion
        </Link>
      }
    >
      {sentMessage ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 text-sm">
          <MailCheck className="h-8 w-8 text-success" aria-hidden="true" />
          <p className="text-foreground/80">Le lien est valable 1 heure et ne peut servir qu'une fois.</p>
          <p className="text-muted-foreground">
            Rien reçu après quelques minutes ? Vérifiez vos courriers indésirables, ou refaites une demande.
          </p>
          <Button variant="outline" className="h-11 w-full" onClick={() => setSentMessage(null)}>
            Refaire une demande
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="h-12 w-full text-base font-semibold">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
