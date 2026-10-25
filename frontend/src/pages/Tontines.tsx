import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Loader2, Plus, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { tontineApi, TontineGroup } from "@/api";
import { formatCFA } from "@/components/admin/format";
import { ROLE_LABELS } from "@/components/tontine/labels";

const EMPTY = {
  name: "", kind: "savings" as const, amount: "500", frequency: "daily" as const, bank_name: "", bank_account: "",
  cash_alert_amount: "50000", cash_alert_days: "7", president_name: "", president_email: "", president_phone: "",
};

function CreateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (g: TontineGroup) => void }) {
  const [form, setForm] = useState<{ [K in keyof typeof EMPTY]: string }>(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const group = await tontineApi.create({
        name: form.name, kind: form.kind as "savings" | "rotating", amount: Number(form.amount),
        frequency: form.frequency as "daily" | "weekly" | "monthly", bank_name: form.bank_name || undefined,
        bank_account: form.bank_account || undefined, cash_alert_amount: Number(form.cash_alert_amount),
        cash_alert_days: Number(form.cash_alert_days), president_name: form.president_name,
        president_email: form.president_email || null, president_phone: form.president_phone || null,
      });
      toast.success(`Association créée : ${group.name}`);
      setForm(EMPTY);
      onCreated(group);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle association</DialogTitle>
          <DialogDescription>
            SENJAPO tient le cahier de l'association. L'argent reste chez le trésorier, puis sur le compte bancaire de l'association.
          </DialogDescription>
        </DialogHeader>
        <form id="create-tontine" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="t-name">Nom de l'association</Label>
            <Input id="t-name" required minLength={2} value={form.name} onChange={set("name")} placeholder="Natt des femmes de Fahu" />
          </div>
          <div className="space-y-1.5">
            <Label>Formule</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as never })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="savings">Épargne (chacun récupère sa mise)</SelectItem>
                <SelectItem value="rotating">Natt tournante (cagnotte à tour de rôle)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Rythme</Label>
            <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as never })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Chaque jour</SelectItem>
                <SelectItem value="weekly">Chaque semaine</SelectItem>
                <SelectItem value="monthly">Chaque mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-amount">Cotisation par membre (FCFA)</Label>
            <Input id="t-amount" type="number" inputMode="numeric" min={25} required value={form.amount} onChange={set("amount")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-bank">Banque de l'association</Label>
            <Input id="t-bank" value={form.bank_name} onChange={set("bank_name")} placeholder="Nom de la banque" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="t-account">Numéro de compte (affiché masqué)</Label>
            <Input id="t-account" value={form.bank_account} onChange={set("bank_account")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-alert-amount">Alerte si le trésorier garde plus de (FCFA)</Label>
            <Input id="t-alert-amount" type="number" inputMode="numeric" min={0} value={form.cash_alert_amount} onChange={set("cash_alert_amount")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-alert-days">… pendant plus de (jours)</Label>
            <Input id="t-alert-days" type="number" inputMode="numeric" min={1} max={90} value={form.cash_alert_days} onChange={set("cash_alert_days")} />
          </div>
          <p className="text-sm font-medium text-foreground sm:col-span-2">Présidente ou président de l'association</p>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="t-pres">Nom</Label>
            <Input id="t-pres" required minLength={2} value={form.president_name} onChange={set("president_name")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-pres-email">Email (pour son accès)</Label>
            <Input id="t-pres-email" type="email" value={form.president_email} onChange={set("president_email")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-pres-phone">Téléphone</Label>
            <Input id="t-pres-phone" type="tel" value={form.president_phone} onChange={set("president_phone")} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" form="create-tontine" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer l'association
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Mes tontines": the associations this person belongs to (all of them for the club's president and admins) */
export default function TontinesPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<{ can_create: boolean; groups: TontineGroup[] } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    tontineApi.list().then(setData).catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: "/tontines" }} />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-6 lg:pt-28">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Mes tontines</h1>
            <p className="mt-1 text-muted-foreground">Le cahier numérique de vos natt et associations d'épargne.</p>
          </div>
          {data?.can_create && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle association
            </Button>
          )}
        </div>

        <Card className="mb-6 border-l-4 border-l-primary shadow-sm">
          <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p>
              SENJAPO ne touche jamais l'argent des tontines : vous payez votre trésorier, qui dépose l'argent sur le compte bancaire de
              l'association. Chaque cotisation est enregistrée ici, et chaque dépôt est vérifié par une deuxième personne.
            </p>
          </CardContent>
        </Card>

        {!data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data.groups.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-3 h-8 w-8 text-primary" aria-hidden="true" />
              Vous ne faites encore partie d'aucune association. Demandez au trésorier ou au président de votre tontine de vous ajouter
              avec l'adresse email de ce compte ({user.email}).
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {data.groups.map((g) => (
              <li key={g.id}>
                <Link to={`/tontines/${g.id}`} className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{g.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {g.kind_label} · {formatCFA(g.amount)} {g.frequency_label} · {g.members ?? 0} membre(s)
                      </p>
                    </div>
                    {g.my_role && <Badge variant="outline">{ROLE_LABELS[g.my_role]}</Badge>}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <CreateDialog open={creating} onOpenChange={setCreating} onCreated={() => { setCreating(false); load(); }} />
    </div>
  );
}
