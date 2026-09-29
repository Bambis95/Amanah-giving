import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import PasswordField from "@/components/PasswordField";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, InvitationPreview } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND_NAME } from "@/lib/brand";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const { acceptInvitation } = useAuth();

  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [linkError, setLinkError] = useState<string | null>(token ? null : "Ce lien d'invitation est incomplet.");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .getInvitation(token)
      .then((preview) => {
        setInvitation(preview);
        setName(preview.name ?? "");
      })
      .catch((error) => setLinkError(error instanceof Error ? error.message : "Invitation introuvable"));
  }, [token]);

  const confirmError =
    confirmPassword && password !== confirmPassword ? "Les mots de passe ne correspondent pas" : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    try {
      const me = await acceptInvitation(token, password, name.trim() || undefined);
      toast.success(`Bienvenue dans l'équipe${me.name ? `, ${me.name}` : ""} !`);
      navigate("/admin", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'activation a échoué");
    } finally {
      setLoading(false);
    }
  };

  const expires = invitation
    ? new Date(invitation.expires_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    : "";

  return (
    <AuthLayout
      title={linkError ? "Invitation indisponible" : `Rejoignez l'équipe ${BRAND_NAME}`}
      subtitle={linkError ? null : "Choisissez votre mot de passe pour activer votre accès au tableau de bord."}
    >
      {linkError ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <p className="text-destructive">{linkError}</p>
          <p className="text-sm text-muted-foreground">
            Demandez à la personne qui vous a invité(e) de vous envoyer une nouvelle invitation. Vous avez déjà un
            compte ?
          </p>
          <Button asChild variant="outline" className="h-11 w-full">
            <Link to="/login">Se connecter</Link>
          </Button>
        </div>
      ) : !invitation ? (
        <div className="flex justify-center py-12" role="status" aria-label="Chargement de l'invitation">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex gap-3 rounded-2xl bg-accent p-4 text-accent-foreground">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold">Votre rôle : {ROLE_LABELS[invitation.role]}</p>
              <p className="mt-1 opacity-90">{ROLE_DESCRIPTIONS[invitation.role]}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" value={invitation.email} readOnly disabled className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">Nom complet</Label>
            <Input
              id="invite-name"
              autoComplete="name"
              placeholder="Prénom Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>
          <PasswordField
            id="invite-password"
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            showStrength
          />
          <PasswordField
            id="invite-confirm"
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            error={confirmError}
          />
          <Button type="submit" disabled={loading} className="h-12 w-full text-base font-semibold">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Activer mon accès
          </Button>
          <p className="text-center text-xs text-muted-foreground">Ce lien est valable jusqu'au {expires}.</p>
        </form>
      )}
    </AuthLayout>
  );
}
