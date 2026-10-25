import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, Info, Landmark, Loader2, RotateCw, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { tontineApi, TontineRotation, TontineView } from "@/api";
import { formatCFA } from "@/components/admin/format";
import DaySheet from "@/components/tontine/DaySheet";
import MembersPanel from "@/components/tontine/MembersPanel";
import OperationsPanel from "@/components/tontine/OperationsPanel";
import { dayLabel, KIND_LABELS, monthLabel, ROLE_LABELS } from "@/components/tontine/labels";
import { cn } from "@/lib/utils";

function Tile({ icon: Icon, label, value, detail, tone = "text-primary" }: { icon: React.ElementType; label: string; value: string; detail?: string; tone?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Icon className={cn("h-4 w-4", tone)} aria-hidden="true" />{label}</p>
        <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function RotationCard({ rotation, highlight }: { rotation: TontineRotation; highlight?: number | null }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-3 p-4 md:p-6">
        <h2 className="flex items-center gap-2 font-semibold text-foreground"><RotateCw className="h-4 w-4 text-primary" aria-hidden="true" />Tour de la natt</h2>
        <p className="text-sm text-muted-foreground">
          Cagnotte par tour : <strong className="text-foreground">{formatCFA(rotation.pot)}</strong> · {rotation.rounds_done} tour(s) versé(s)
          {rotation.next ? <> · prochain : <strong className="text-foreground">{rotation.next.name}</strong></> : ""}
        </p>
        <ol className="flex flex-wrap gap-2">
          {rotation.order.map((m, i) => (
            <li key={m.id} className={cn("rounded-full border px-3 py-1 text-sm",
              m.served ? "border-success/40 text-success" : "border-border text-foreground",
              rotation.next?.id === m.id && "border-primary bg-accent font-semibold",
              highlight === m.id && "ring-2 ring-primary")}>
              {i + 1}. {m.name}{m.served ? " ✓" : ""}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

const ALERT_ICON = { critical: XCircle, warning: AlertTriangle, info: Info };
const ALERT_TONE = { critical: "border-destructive/40 bg-destructive/10", warning: "border-warning/40 bg-highlight/15", info: "border-border bg-muted/50" };

/** One association: the officers' ledger (day sheet, members, operations), or a member's own account */
export default function TontineGroupPage() {
  const { id } = useParams();
  const groupId = Number(id);
  const { user, loading: authLoading } = useAuth();
  const [month, setMonth] = useState<string | undefined>();
  const [view, setView] = useState<TontineView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    tontineApi.view(groupId, month).then((v) => { setView(v); setError(null); })
      .catch((e) => { setError(e instanceof Error ? e.message : "Chargement impossible"); toast.error(e instanceof Error ? e.message : "Chargement impossible"); });
  }, [groupId, month]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: `/tontines/${groupId}` }} />;

  const officer = view && view.role !== "member";
  const s = view?.summary;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6 lg:pt-28">
        <Link to="/tontines" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Mes tontines
        </Link>
        {error && !view ? (
          <Card className="shadow-sm"><CardContent className="py-12 text-center text-destructive">{error}</CardContent></Card>
        ) : !view ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{view.group.name}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                  {view.group.kind_label} · {formatCFA(view.group.amount)} {view.group.frequency_label}
                  <Badge variant="outline" className="border-primary/40 text-primary">{ROLE_LABELS[view.role]}</Badge>
                </p>
                {view.group.bank_name && <p className="mt-1 text-xs text-muted-foreground">Compte : {view.group.bank_name} {view.group.bank_account ?? ""}</p>}
              </div>
              <Select value={view.month} onValueChange={setMonth}>
                <SelectTrigger className="w-44" aria-label="Mois"><SelectValue /></SelectTrigger>
                <SelectContent>{view.months.map((m) => <SelectItem key={m} value={m} className="capitalize">{monthLabel(m)}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {officer && s ? (
              <>
                {s.alerts.map((a) => {
                  const Icon = ALERT_ICON[a.level];
                  return (
                    <div key={a.code} className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm text-foreground", ALERT_TONE[a.level])} role={a.level === "info" ? undefined : "alert"}>
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", a.level === "critical" ? "text-destructive" : a.level === "warning" ? "text-warning" : "text-info")} aria-hidden="true" />
                      {a.text}
                    </div>
                  );
                })}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Tile icon={Wallet} label="Caisse du trésorier" value={formatCFA(s.cash_in_hand)}
                    detail={s.days_since_deposit === null ? "Aucun mouvement" : `Dernier dépôt il y a ${s.days_since_deposit} j`} tone="text-warning" />
                  <Tile icon={Landmark} label="À la banque (validé)" value={formatCFA(s.bank_balance)} detail={s.pending_validation ? `${s.pending_validation} opération(s) à valider` : "Tout est validé"} />
                  <Tile icon={Banknote} label={`Cotisé en ${monthLabel(view.month)}`} value={formatCFA(s.month_contributions)} tone="text-success" />
                  <Tile icon={CheckCircle2} label="Versé aux membres" value={formatCFA(s.month_payouts)} detail={`Déposé ce mois : ${formatCFA(s.month_deposits)}`} />
                </div>
                {s.rotation && <RotationCard rotation={s.rotation} />}
                <Tabs defaultValue="day">
                  <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="day">Cotisations du jour</TabsTrigger>
                    <TabsTrigger value="members">Membres</TabsTrigger>
                    <TabsTrigger value="operations">
                      Opérations{s.pending_validation ? <Badge className="ml-2 bg-highlight px-1.5 text-highlight-foreground">{s.pending_validation}</Badge> : null}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="day"><DaySheet groupId={groupId} onSaved={load} /></TabsContent>
                  <TabsContent value="members"><MembersPanel group={view.group} role={view.role} members={view.members ?? []} onChange={load} /></TabsContent>
                  <TabsContent value="operations">
                    <OperationsPanel group={view.group} role={view.role} userId={user.id} members={view.members ?? []} operations={view.operations ?? []} onChange={load} />
                  </TabsContent>
                </Tabs>
              </>
            ) : view.me ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Tile icon={Banknote} label={`Cotisé en ${monthLabel(view.month)}`} value={formatCFA(view.me.contributed)} tone="text-success"
                    detail={`${view.me.paid_count} versement(s) sur ${view.me.expected_count} attendu(s)`} />
                  <Tile icon={AlertTriangle} label="En retard" value={view.me.late ? formatCFA(view.me.late) : "Rien"} tone="text-warning" />
                  {view.group.kind === "savings" ? (
                    <Tile icon={Wallet} label="À recevoir pour ce mois" value={formatCFA(view.me.to_receive ?? 0)} detail="Ce que vous avez versé ce mois" />
                  ) : (
                    <Tile icon={RotateCw} label="Votre rang" value={view.me.rotation_order ? `${view.me.rotation_order}` : "—"} />
                  )}
                  <Tile icon={Landmark} label="Total versé depuis le début" value={formatCFA(view.me.total_contributed)} detail={`Reçu : ${formatCFA(view.me.total_received)}`} />
                </div>
                {view.rotation && <RotationCard rotation={view.rotation} highlight={view.me.id} />}
                <Card className="shadow-sm">
                  <CardContent className="p-4 md:p-6">
                    <h2 className="mb-2 font-semibold text-foreground">Mes opérations</h2>
                    {(view.my_operations ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune opération enregistrée pour vous.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {view.my_operations!.map((o) => (
                          <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                            <span className="text-foreground">{KIND_LABELS[o.kind]} · {dayLabel(o.op_date)} · {o.method_label}</span>
                            <span className={cn("tabular-nums font-semibold", o.kind === "contribution" ? "text-success" : "text-foreground")}>{formatCFA(o.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">Une cotisation manque ? Montrez cet écran à votre trésorier : il peut la corriger, et chaque correction est inscrite au journal.</p>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
