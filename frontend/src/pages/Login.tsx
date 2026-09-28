import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Heart, Loader2, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND_NAME } from "@/lib/brand";
import { isStaff } from "@/lib/roles";

const MIN_PASSWORD_LENGTH = 8;

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Club staff (members, president, admins) land on the dashboard; other users go back where they came from
  const from = (location.state as { from?: string } | null)?.from || "/";
  const redirectTo = isStaff(user?.role) ? "/admin" : from;

  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Already signed in: nothing to do here
  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Veuillez saisir votre email et votre mot de passe");
      return;
    }
    setLoading(true);
    try {
      const me = await login(email, password);
      toast.success(`Bienvenue${me.name ? `, ${me.name}` : ""} !`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de la connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Veuillez remplir tous les champs obligatoires");
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
      await register(email, password, name || undefined);
      toast.success("Compte créé avec succès !");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de la création du compte");
    } finally {
      setLoading(false);
    }
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28 pb-16 px-4 flex items-start justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Heart className="w-7 h-7 text-primary-foreground fill-primary-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {tab === "login" ? "Bon retour parmi nous" : `Rejoignez ${BRAND_NAME}`}
            </h1>
            <p className="text-muted-foreground mt-2">
              {tab === "login"
                ? "Connectez-vous pour retrouver vos dons et suivre vos contributions."
                : "Créez votre compte en quelques secondes."}
            </p>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-6 md:p-8">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid grid-cols-2 w-full mb-6">
                  <TabsTrigger value="login">Connexion</TabsTrigger>
                  <TabsTrigger value="register">Créer un compte</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="vous@exemple.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Mot de passe</Label>
                        <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                          Mot de passe oublié ?
                        </Link>
                      </div>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pr-10"
                          required
                        />
                        {passwordToggle}
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <LogIn className="w-4 h-4 mr-2" />
                      )}
                      Se connecter
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Nom complet</Label>
                      <Input
                        id="register-name"
                        autoComplete="name"
                        placeholder="Prénom Nom"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email *</Label>
                      <Input
                        id="register-email"
                        type="email"
                        autoComplete="email"
                        placeholder="vous@exemple.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Mot de passe *</Label>
                      <div className="relative">
                        <Input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pr-10"
                          required
                        />
                        {passwordToggle}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Au moins {MIN_PASSWORD_LENGTH} caractères.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm">Confirmer le mot de passe *</Label>
                      <Input
                        id="register-confirm"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      Créer mon compte
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      En créant un compte, vous acceptez nos{" "}
                      <Link to="/conditions" className="text-primary hover:underline">conditions d'utilisation</Link> et notre{" "}
                      <Link to="/confidentialite" className="text-primary hover:underline">politique de confidentialité</Link>.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link to="/" className="text-primary font-medium hover:underline">
              Retour à l'accueil
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
