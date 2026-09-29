import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AuthLayout from "@/components/AuthLayout";
import PasswordField from "@/components/PasswordField";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { ArrowRight, Heart, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND_NAME } from "@/lib/brand";
import { isStaff } from "@/lib/roles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Club staff (members, president, admins) land on the dashboard; other users go back where they came from
  const from = (location.state as { from?: string } | null)?.from || "/";
  const redirectTo = isStaff(user?.role) ? "/admin" : from;

  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  // Already signed in: nothing to do here
  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  const emailError = emailTouched && email && !EMAIL_PATTERN.test(email.trim()) ? "Adresse email invalide" : null;
  const confirmError =
    confirmPassword && password !== confirmPassword ? "Les mots de passe ne correspondent pas" : null;

  const switchTab = (value: string) => {
    setTab(value);
    setPassword("");
    setConfirmPassword("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Veuillez saisir votre email et votre mot de passe");
      return;
    }
    setLoading(true);
    try {
      const me = await login(email.trim(), password);
      toast.success(`Bienvenue${me.name ? `, ${me.name}` : ""} !`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de la connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (!email || !password || !EMAIL_PATTERN.test(email.trim())) {
      toast.error("Veuillez remplir correctement les champs obligatoires");
      return;
    }
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
      await register(email.trim(), password, name.trim() || undefined);
      toast.success("Compte créé avec succès !");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de la création du compte");
    } finally {
      setLoading(false);
    }
  };

  const emailField = (id: string) => (
    <div className="space-y-2">
      <Label htmlFor={id}>Email</Label>
      <Input
        id={id}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="vous@exemple.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setEmailTouched(true)}
        className="h-11"
        aria-invalid={emailError ? true : undefined}
        aria-describedby={emailError ? `${id}-error` : undefined}
        required
      />
      {emailError && <p id={`${id}-error`} className="text-xs text-destructive">{emailError}</p>}
    </div>
  );

  const submit = (label: string, Icon: typeof LogIn) => (
    <Button type="submit" disabled={loading} className="h-12 w-full text-base font-semibold">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );

  return (
    <AuthLayout
      title={tab === "login" ? "Bon retour parmi nous" : `Rejoignez ${BRAND_NAME}`}
      subtitle={
        tab === "login"
          ? "Connectez-vous pour suivre vos dons, ou accéder au tableau de bord si vous êtes membre de l'équipe."
          : "Créez votre compte en quelques secondes pour retrouver l'historique de vos dons."
      }
      footer={
        <Link
          to="/donate"
          className="group inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-medium text-accent-foreground transition-colors hover:bg-accent/70"
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
          Pas besoin de compte pour faire un don
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      }
    >
      <Tabs value={tab} onValueChange={switchTab}>
        <TabsList className="mb-8 grid h-12 w-full grid-cols-2 rounded-xl p-1">
          <TabsTrigger value="login" className="h-10 rounded-lg text-sm font-semibold">
            Connexion
          </TabsTrigger>
          <TabsTrigger value="register" className="h-10 rounded-lg text-sm font-semibold">
            Créer un compte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-0 animate-in fade-in-0 duration-300">
          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            {emailField("login-email")}
            <PasswordField
              id="login-password"
              label="Mot de passe"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              labelAside={
                <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                  Mot de passe oublié ?
                </Link>
              }
            />
            {submit("Se connecter", LogIn)}
          </form>
        </TabsContent>

        <TabsContent value="register" className="mt-0 animate-in fade-in-0 duration-300">
          <form onSubmit={handleRegister} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="register-name">
                Nom complet <span className="font-normal text-muted-foreground">(facultatif)</span>
              </Label>
              <Input
                id="register-name"
                autoComplete="name"
                placeholder="Prénom Nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
              />
            </div>
            {emailField("register-email")}
            <PasswordField
              id="register-password"
              label="Mot de passe"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              showStrength
            />
            <PasswordField
              id="register-confirm"
              label="Confirmer le mot de passe"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              error={confirmError}
            />
            {submit("Créer mon compte", UserPlus)}
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              En créant un compte, vous acceptez nos{" "}
              <Link to="/conditions" className="text-primary hover:underline">conditions d'utilisation</Link> et notre{" "}
              <Link to="/confidentialite" className="text-primary hover:underline">politique de confidentialité</Link>.
            </p>
          </form>
        </TabsContent>
      </Tabs>
    </AuthLayout>
  );
}
