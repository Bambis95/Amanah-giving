import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import PasswordField from "@/components/PasswordField";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(
    token ? null : "Ce lien est incomplet. Faites une nouvelle demande de réinitialisation."
  );

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
      toast.success(await api.resetPassword(token, password));
      navigate("/login", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "La réinitialisation a échoué";
      // An expired or used link cannot be fixed from this form
      if (message.includes("lien")) setLinkError(message);
      else toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Choisissez le nouveau mot de passe de votre compte."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à la connexion
        </Link>
      }
    >
      {linkError ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <p className="text-destructive">{linkError}</p>
          <Button asChild className="h-11 w-full">
            <Link to="/forgot-password">Faire une nouvelle demande</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <PasswordField
            id="new-password"
            label="Nouveau mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            showStrength
          />
          <PasswordField
            id="confirm-password"
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            error={confirmError}
          />
          <Button type="submit" disabled={loading} className="h-12 w-full text-base font-semibold">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Enregistrer le mot de passe
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
