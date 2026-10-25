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
import { tontineApi, TontineGroup, TontineKind } from "@/api";
import { formatCFA } from "@/components/admin/format";
import { useTontineText } from "@/i18n/tontine";

const EMPTY = {
  name: "", kind: "savings", amount: "500", frequency: "daily", bank_name: "", bank_account: "",
  cash_alert_amount: "50000", cash_alert_days: "7", president_name: "", president_email: "", president_phone: "",
};
type FormState = { [K in keyof typeof EMPTY]: string };

function CreateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (g: TontineGroup) => void }) {
  const { tt } = useTontineText();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const group = await tontineApi.create({
        name: form.name, kind: form.kind as TontineKind, amount: Number(form.amount),
        frequency: form.frequency as "daily" | "weekly" | "monthly", bank_name: form.bank_name || undefined,
        bank_account: form.bank_account || undefined, cash_alert_amount: Number(form.cash_alert_amount),
        cash_alert_days: Number(form.cash_alert_days), president_name: form.president_name,
        president_email: form.president_email || null, president_phone: form.president_phone || null,
      });
      toast.success(tt.created(group.name));
      setForm(EMPTY);
      onCreated(group);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt.actionError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tt.createTitle}</DialogTitle>
          <DialogDescription>{tt.createHelp}</DialogDescription>
        </DialogHeader>
        <form id="create-tontine" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="t-name">{tt.groupName}</Label>
            <Input id="t-name" required minLength={2} value={form.name} onChange={set("name")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{tt.formula}</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v, frequency: v === "mbootaay" ? "monthly" : form.frequency })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["savings", "rotating", "mbootaay"] as TontineKind[]).map((k) => <SelectItem key={k} value={k}>{tt.kindHelp[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{tt.rhythm}</Label>
            <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["daily", "weekly", "monthly"] as const).map((f) => <SelectItem key={f} value={f}>{tt.frequencyChoice[f]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-amount">{tt.perMember}</Label>
            <Input id="t-amount" type="number" inputMode="numeric" min={25} required value={form.amount} onChange={set("amount")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-bank">{tt.bankName}</Label>
            <Input id="t-bank" value={form.bank_name} onChange={set("bank_name")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-account">{tt.bankAccount}</Label>
            <Input id="t-account" value={form.bank_account} onChange={set("bank_account")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-alert-amount">{tt.alertAmount}</Label>
            <Input id="t-alert-amount" type="number" inputMode="numeric" min={0} value={form.cash_alert_amount} onChange={set("cash_alert_amount")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-alert-days">{tt.alertDays}</Label>
            <Input id="t-alert-days" type="number" inputMode="numeric" min={1} max={90} value={form.cash_alert_days} onChange={set("cash_alert_days")} />
          </div>
          <p className="text-sm font-medium text-foreground sm:col-span-2">{tt.presidentTitle}</p>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="t-pres">{tt.name}</Label>
            <Input id="t-pres" required minLength={2} value={form.president_name} onChange={set("president_name")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-pres-email">{tt.presidentEmail}</Label>
            <Input id="t-pres-email" type="email" value={form.president_email} onChange={set("president_email")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-pres-phone">{tt.phone}</Label>
            <Input id="t-pres-phone" type="tel" value={form.president_phone} onChange={set("president_phone")} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tt.cancel}</Button>
          <Button type="submit" form="create-tontine" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tt.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Mes tontines": the associations this person belongs to (all of them for the club's president and admins) */
export default function TontinesPage() {
  const { user, loading: authLoading } = useAuth();
  const { tt } = useTontineText();
  const [data, setData] = useState<{ can_create: boolean; groups: TontineGroup[] } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    tontineApi.list().then(setData).catch((e) => toast.error(e instanceof Error ? e.message : tt.loadError));
  }, [tt.loadError]);
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{tt.title}</h1>
            <p className="mt-1 text-muted-foreground">{tt.subtitle}</p>
          </div>
          {data?.can_create && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {tt.newGroup}
            </Button>
          )}
        </div>

        <Card className="mb-6 border-s-4 border-s-primary shadow-sm">
          <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p>{tt.safety}</p>
          </CardContent>
        </Card>

        {!data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data.groups.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-3 h-8 w-8 text-primary" aria-hidden="true" />
              {tt.noGroup(user.email)}
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
                        {tt.kinds[g.kind]} · {formatCFA(g.amount)} {tt.frequency[g.frequency]} · {tt.membersCount(g.members ?? 0)}
                      </p>
                    </div>
                    {g.my_role && <Badge variant="outline">{tt.roles[g.my_role]}</Badge>}
                    <ChevronRight className="h-5 w-5 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
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
