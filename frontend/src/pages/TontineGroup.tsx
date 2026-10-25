import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, Crown, FileDown, HandHeart, Info, Landmark, Loader2, Lock, RotateCw, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { TontineAid, tontineApi, TontineRotation, TontineSummary, TontineView } from "@/api";
import { formatCFA } from "@/components/admin/format";
import DaySheet from "@/components/tontine/DaySheet";
import MembersPanel from "@/components/tontine/MembersPanel";
import OperationsPanel from "@/components/tontine/OperationsPanel";
import { opLabel } from "@/components/tontine/labels";
import { GroupBadges, PremiumDialog, ReportButton } from "@/components/tontine/GroupStatus";
import { useTontineText } from "@/i18n/tontine";
import { cn } from "@/lib/utils";

function Tile({ icon: Icon, label, value, detail, tone = "text-primary" }: { icon: React.ElementType; label: string; value: string; detail?: string; tone?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Icon className={cn("h-4 w-4 shrink-0", tone)} aria-hidden="true" />{label}</p>
        <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function RotationCard({ rotation, highlight }: { rotation: TontineRotation; highlight?: number | null }) {
  const { tt } = useTontineText();
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-3 p-4 md:p-6">
        <h2 className="flex items-center gap-2 font-semibold text-foreground"><RotateCw className="h-4 w-4 text-primary" aria-hidden="true" />{tt.rotationTitle}</h2>
        <p className="text-sm text-muted-foreground">
          {tt.pot} : <strong className="text-foreground">{formatCFA(rotation.pot)}</strong> · {tt.roundsDone(rotation.rounds_done)}
          {rotation.next ? <> · {tt.next} : <strong className="text-foreground">{rotation.next.name}</strong></> : ""}
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

/** The officers' alerts, in the visitor's language (the server sends their codes) */
function Alerts({ summary, lateCount }: { summary: TontineSummary; lateCount: number }) {
  const { tt } = useTontineText();
  const text = (code: string) => {
    if (code === "cash_dormant") return tt.alertCash(formatCFA(summary.cash_in_hand), summary.days_since_deposit ?? 0);
    if (code === "cash_negative") return tt.alertNegative;
    if (code === "to_validate") return tt.alertValidate(summary.pending_validation);
    if (code === "late") return tt.alertLate(lateCount);
    return code;
  };
  return (
    <>
      {summary.alerts.map((a) => {
        const Icon = ALERT_ICON[a.level];
        return (
          <div key={a.code} className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm text-foreground", ALERT_TONE[a.level])} role={a.level === "info" ? undefined : "alert"}>
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", a.level === "critical" ? "text-destructive" : a.level === "warning" ? "text-warning" : "text-info")} aria-hidden="true" />
            {text(a.code)}
          </div>
        );
      })}
    </>
  );
}

/** One association: the officers' ledger (day sheet, members, operations), or a member's own account */
export default function TontineGroupPage() {
  const { id } = useParams();
  const groupId = Number(id);
  const { user, loading: authLoading } = useAuth();
  const { tt, monthName, dayName } = useTontineText();
  const [month, setMonth] = useState<string | undefined>();
  const [view, setView] = useState<TontineView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [upsell, setUpsell] = useState(false);

  const load = useCallback(() => {
    tontineApi.view(groupId, month).then((v) => { setView(v); setError(null); })
      .catch((e) => { const msg = e instanceof Error ? e.message : tt.loadError; setError(msg); toast.error(msg); });
  }, [groupId, month, tt.loadError]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: `/tontines/${groupId}` }} />;

  const officer = view && view.role !== "member";
  const s = view?.summary;
  const g = view?.group;

  const downloadStatement = async () => {
    if (!view) return;
    if (!view.group.premium) {
      setUpsell(true);
      return;
    }
    setPrinting(true);
    try {
      await tontineApi.downloadStatement(groupId, view.month);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tt.actionError);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6 lg:pt-28">
        <Link to="/tontines" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />{tt.back}
        </Link>
        {error && !view ? (
          <Card className="shadow-sm"><CardContent className="py-12 text-center text-destructive">{error}</CardContent></Card>
        ) : !view || !g ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{g.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                  {tt.kinds[g.kind]} · {formatCFA(g.amount)} {tt.frequency[g.frequency]}
                  <Badge variant="outline" className="border-primary/40 text-primary">{tt.roles[view.role]}</Badge>
                  <GroupBadges group={g} />
                </div>
                {g.bank_name && <p className="mt-1 text-xs text-muted-foreground">{tt.account} : {g.bank_name} {g.bank_account ?? ""}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {officer && !g.premium && (view.role === "president" || view.role === "admin") && (
                  <Button onClick={() => setUpsell(true)}><Crown className="mr-2 h-4 w-4" />{tt.goPremium}</Button>
                )}
                {officer && (
                  <Button variant="outline" onClick={downloadStatement} disabled={printing} title={g.premium ? undefined : tt.premiumFeature}>
                    {printing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : g.premium ? <FileDown className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                    {tt.statement}
                  </Button>
                )}
                {view.role !== "admin" && <ReportButton group={g} />}
                <Select value={view.month} onValueChange={setMonth}>
                  <SelectTrigger className="w-44" aria-label={tt.month}><SelectValue /></SelectTrigger>
                  <SelectContent>{view.months.map((m) => <SelectItem key={m} value={m} className="capitalize">{monthName(m)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {g.suspended && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground" role="alert">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                {tt.suspended(g.suspended_reason ?? "")}
              </div>
            )}
            {!g.verified && view.role === "member" && (
              <p className="text-xs text-muted-foreground">{tt.notVerifiedHelp}</p>
            )}
            <PremiumDialog group={g} open={upsell} onOpenChange={setUpsell} />

            {officer && s ? (
              <>
                <Alerts summary={s} lateCount={(view.members ?? []).filter((m) => m.late > 0).length} />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {g.kind === "mbootaay" ? (
                    <Tile icon={HandHeart} label={tt.fund} value={formatCFA(s.fund ?? 0)} detail={tt.fundDetail} />
                  ) : (
                    <Tile icon={Wallet} label={tt.cash} value={formatCFA(s.cash_in_hand)} tone="text-warning"
                      detail={s.days_since_deposit === null ? tt.noMovement : tt.lastDeposit(s.days_since_deposit)} />
                  )}
                  <Tile icon={Landmark} label={tt.bank} value={formatCFA(s.bank_balance)} detail={s.pending_validation ? tt.toValidate(s.pending_validation) : tt.allValidated} />
                  <Tile icon={Banknote} label={tt.contributedIn(monthName(view.month))} value={formatCFA(s.month_contributions)} tone="text-success" />
                  {g.kind === "mbootaay" ? (
                    <Tile icon={HandHeart} label={tt.aidsMonth} value={formatCFA(s.month_payouts)} tone="text-highlight"
                      detail={Object.entries(s.month_aids ?? {}).filter(([, v]) => v).map(([k, v]) => `${tt.aids[k as TontineAid]} : ${formatCFA(v)}`).join(" · ") || tt.nothing} />
                  ) : (
                    <Tile icon={CheckCircle2} label={tt.paidOut} value={formatCFA(s.month_payouts)} detail={tt.depositedMonth(formatCFA(s.month_deposits))} />
                  )}
                </div>
                {s.rotation && <RotationCard rotation={s.rotation} />}
                <Tabs defaultValue="day">
                  <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="day">{tt.tabDay}</TabsTrigger>
                    <TabsTrigger value="members">{tt.tabMembers}</TabsTrigger>
                    <TabsTrigger value="operations">
                      {tt.tabOps}{s.pending_validation ? <Badge className="ms-2 bg-highlight px-1.5 text-highlight-foreground">{s.pending_validation}</Badge> : null}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="day"><DaySheet groupId={groupId} groupName={g.name} onSaved={load} /></TabsContent>
                  <TabsContent value="members"><MembersPanel group={g} role={view.role} members={view.members ?? []} onChange={load} /></TabsContent>
                  <TabsContent value="operations">
                    <OperationsPanel group={g} role={view.role} userId={user.id} members={view.members ?? []} operations={view.operations ?? []} onChange={load} />
                  </TabsContent>
                </Tabs>
              </>
            ) : view.me ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Tile icon={Banknote} label={tt.contributedIn(monthName(view.month))} value={formatCFA(view.me.contributed)} tone="text-success"
                    detail={tt.payments(view.me.paid_count, view.me.expected_count)} />
                  <Tile icon={AlertTriangle} label={tt.late} value={view.me.late ? formatCFA(view.me.late) : tt.nothing} tone="text-warning" />
                  {g.kind === "savings" ? (
                    <Tile icon={Wallet} label={tt.toReceive} value={formatCFA(view.me.to_receive ?? 0)} detail={tt.toReceiveDetail} />
                  ) : g.kind === "rotating" ? (
                    <Tile icon={RotateCw} label={tt.rank} value={view.me.rotation_order ? `${view.me.rotation_order}` : "—"} />
                  ) : (
                    <Tile icon={HandHeart} label={tt.aidsReceived} value={formatCFA(view.me.total_received)} />
                  )}
                  <Tile icon={Landmark} label={tt.totalPaid} value={formatCFA(view.me.total_contributed)} detail={tt.received(formatCFA(view.me.total_received))} />
                </div>
                {view.rotation && <RotationCard rotation={view.rotation} highlight={view.me.id} />}
                <Card className="shadow-sm">
                  <CardContent className="p-4 md:p-6">
                    <h2 className="mb-2 font-semibold text-foreground">{tt.myOps}</h2>
                    {(view.my_operations ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">{tt.noOps}</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {view.my_operations!.map((o) => (
                          <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                            <span className="text-foreground">
                              {opLabel(tt, o.kind, g)}{o.category ? ` · ${tt.aids[o.category]}` : ""} · {dayName(o.op_date)} · {tt.methods[o.method]}
                            </span>
                            <span className={cn("tabular-nums font-semibold", o.kind === "contribution" ? "text-success" : "text-foreground")}>{formatCFA(o.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">{tt.missing}</p>
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
