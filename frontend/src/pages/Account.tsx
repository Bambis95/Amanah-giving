import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PasswordField from "@/components/PasswordField";
import PaymentStatusBadge from "@/components/admin/PaymentStatusBadge";
import { FileText, FolderOpen, Heart, KeyRound, Loader2, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { adminApi, api, Donation, Project } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { categoryLabel } from "@/lib/categories";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;
const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(iso)) : "—");
const METHODS: Record<string, string> = { wave: "Wave", orange_money: "Orange Money", card: "Carte bancaire", stripe: "Carte bancaire" };

/** A signed-in donor's own page: donations with their receipts, name, password */
export default function AccountPage() {
  const { user, loading: authLoading, keepAlive } = useAuth();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    api.getMyDonations().then(setDonations).catch(() => setDonations([]));
    api.getProjects().then((r) => setProjects(r.items)).catch(() => setProjects([]));
  }, [user]);

  const paid = useMemo(() => (donations ?? []).filter((d) => d.payment_status === "paid"), [donations]);
  const total = paid.reduce((s, d) => s + d.amount, 0);
  const supported = new Set(paid.map((d) => d.project_id ?? `cause:${d.cause}`)).size;
  const destination = (d: Donation) => projects.find((p) => p.id === d.project_id)?.title ?? categoryLabel(d.cause);

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: "/mon-espace" }} />;

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      await api.updateProfileName(name.trim());
      await keepAlive(); // refreshes the name shown in the menu
      toast.success("Nom enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Modification impossible");
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`);
      return;
    }
    setSavingPassword(true);
    try {
      toast.success(await api.changePassword(currentPassword, newPassword));
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Modification impossible");
    } finally {
      setSavingPassword(false);
    }
  };

  const receipt = async (d: Donation) => {
    setDownloading(d.id);
    try {
      const blob = await adminApi.downloadReceipt(d.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recu-SENJAPO-${String(d.id).padStart(6, "0")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reçu indisponible");
    } finally {
      setDownloading(null);
    }
  };

  const figures = [
    { icon: Heart, label: "Total donné", value: fcfa(total) },
    { icon: FileText, label: "Dons confirmés", value: String(paid.length) },
    { icon: FolderOpen, label: "Causes soutenues", value: String(supported) },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="surface-brand px-4 pb-14 pt-24 sm:pt-28">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/80">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Mon espace
          </p>
          <h1 className="text-3xl font-bold md:text-4xl">Merci{user.name ? `, ${user.name}` : ""} !</h1>
          <p className="mt-2 text-white/80">Retrouvez vos dons, vos reçus et les réglages de votre compte.</p>
        </div>
      </section>

      <main className="mx-auto -mt-8 max-w-4xl space-y-6 px-4 pb-16">
        <div className="grid grid-cols-3 gap-3">
          {figures.map((f) => (
            <Card key={f.label} className="shadow-sm">
              <CardContent className="p-4 text-center sm:p-5">
                <f.icon className="mx-auto mb-2 h-5 w-5 text-primary" aria-hidden="true" />
                <p className="text-lg font-bold tabular-nums text-foreground sm:text-2xl">{donations ? f.value : "…"}</p>
                <p className="text-xs text-muted-foreground sm:text-sm">{f.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Mes dons</h2>
            {donations === null ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : donations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="mb-4 text-muted-foreground">Vous n'avez pas encore fait de don avec ce compte.</p>
                <Button asChild>
                  <Link to="/projects"><Heart className="mr-2 h-4 w-4" />Découvrir les campagnes</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {donations.map((d) => (
                  <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{destination(d)}</p>
                      <p className="text-xs text-muted-foreground">
                        {day(d.created_at)} · {METHODS[d.payment_method] ?? d.payment_method} · don n° {d.id}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="font-semibold tabular-nums text-foreground">{fcfa(d.amount)}</span>
                      <PaymentStatusBadge status={d.payment_status} />
                      {d.payment_status === "paid" && (
                        <Button variant="outline" size="sm" onClick={() => receipt(d)} disabled={downloading === d.id}>
                          {downloading === d.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
                          Reçu
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Seuls les dons faits en étant connecté à ce compte apparaissent ici. Un don fait sans compte reste confirmé par
              email, avec son reçu en pièce jointe.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Mon profil</h2>
              <form onSubmit={saveName} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="account-email">Email</Label>
                  <Input id="account-email" value={user.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-name">Nom complet</Label>
                  <Input id="account-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                </div>
                <Button type="submit" disabled={savingName || name.trim() === (user.name ?? "")}>
                  {savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Enregistrer
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Mot de passe</h2>
              <form onSubmit={changePassword} className="space-y-4">
                <PasswordField id="account-current" label="Mot de passe actuel" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
                <PasswordField id="account-new" label="Nouveau mot de passe" value={newPassword} onChange={setNewPassword} autoComplete="new-password" showStrength />
                <Button type="submit" disabled={savingPassword || !currentPassword || !newPassword}>
                  {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Changer le mot de passe
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
