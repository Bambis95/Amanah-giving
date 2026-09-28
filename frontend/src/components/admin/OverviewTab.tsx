import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle, Inbox, QrCode } from "lucide-react";
import { ContactMessage, Donation, Project } from "@/api";
import { categoryLabel, formatCFA, formatDate, MESSAGE_KINDS, paymentMethodLabels } from "./format";
import { cn } from "@/lib/utils";

export type OverviewTarget = { section: "donations" } | { section: "messages"; kind: string } | { section: "projects" };

interface OverviewTabProps {
  donations: Donation[];
  messages: ContactMessage[];
  projects: Project[];
  /** President / admin: sees the to-do list (deposits, requests) */
  canManage: boolean;
  onGo: (target: OverviewTarget) => void;
}

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="p-4 sm:p-5">
        <h3 className="mb-4 font-semibold text-foreground">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

export default function OverviewTab({ donations, messages, projects, canManage, onGo }: OverviewTabProps) {
  const paid = useMemo(() => donations.filter((d) => d.payment_status === "paid"), [donations]);

  // Paid amount per month, last 6 months (months without donations shown as 0)
  const monthly = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
    return months.map((m) => {
      const total = paid
        .filter((d) => {
          if (!d.created_at) return false;
          const t = new Date(d.created_at);
          return t.getFullYear() === m.getFullYear() && t.getMonth() === m.getMonth();
        })
        .reduce((sum, d) => sum + d.amount, 0);
      return { month: monthLabel.format(m), total };
    });
  }, [paid]);

  const byMethod = useMemo(() => {
    const totals = new Map<string, number>();
    for (const d of paid) {
      const key = paymentMethodLabels[d.payment_method] ?? d.payment_method;
      totals.set(key, (totals.get(key) ?? 0) + d.amount);
    }
    const grand = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([label, total]) => ({ label, total, share: grand ? total / grand : 0 }));
  }, [paid]);

  const campaigns = useMemo(
    () =>
      projects
        .filter((p) => !p.status || p.status === "active")
        .map((p) => ({ ...p, pct: p.goal > 0 ? Math.round((p.raised / p.goal) * 100) : 0 }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5),
    [projects]
  );

  const pendingDeposits = donations.filter((d) => d.payment_provider === "mobile_qr" && d.payment_status === "pending");
  const todo = canManage
    ? [
        ...(pendingDeposits.length
          ? [{
              key: "deposits",
              icon: QrCode,
              label: "Dépôts QR à confirmer",
              count: pendingDeposits.length,
              detail: formatCFA(pendingDeposits.reduce((s, d) => s + d.amount, 0)),
              go: { section: "donations" } as OverviewTarget,
            }]
          : []),
        ...MESSAGE_KINDS.map((k) => {
          const unread = messages.filter((m) => !m.is_read && k.subjects.includes(m.subject ?? "")).length;
          return { key: k.id, icon: Inbox, label: `${k.label} non lues`, count: unread, detail: "", go: { section: "messages", kind: k.id } as OverviewTarget };
        }).filter((t) => t.count > 0),
      ]
    : [];

  const recent = paid.slice().sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 5);
  const hasChartData = monthly.some((m) => m.total > 0);

  return (
    <div className="space-y-4">
      {canManage && (
        <Panel title="À traiter">
          {todo.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              Rien en attente : tout est à jour.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {todo.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onGo(t.go)}
                  className="group flex items-center gap-3 rounded-xl border border-highlight/40 bg-highlight/10 p-3 text-left transition-colors hover:border-highlight"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-highlight text-highlight-foreground">
                    <t.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {t.count} · {t.label}
                    </span>
                    {t.detail && <span className="block text-xs text-muted-foreground">{t.detail}</span>}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Montants collectés par mois (6 derniers mois)" className="xl:col-span-2">
          {hasChartData ? (
            <div className="h-64" role="img" aria-label={monthly.map((m) => `${m.month} : ${formatCFA(m.total)}`).join(", ")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v: number) => compact.format(v)}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    formatter={(v: number) => [formatCFA(v), "Collecté"]}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">Aucun don confirmé sur les 6 derniers mois.</p>
          )}
        </Panel>

        <Panel title="Répartition par moyen de paiement">
          {byMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun don confirmé pour le moment.</p>
          ) : (
            <ul className="space-y-3">
              {byMethod.map((m) => (
                <li key={m.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-foreground">{m.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCFA(m.total)} · {Math.round(m.share * 100)} %
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, m.share * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Avancement des campagnes en cours">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune campagne en cours.</p>
          ) : (
            <ul className="space-y-3">
              {campaigns.map((p) => (
                <li key={p.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-foreground">{p.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{p.pct} %</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-highlight" style={{ width: `${Math.min(100, p.pct)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCFA(p.raised)} sur {formatCFA(p.goal)} · {categoryLabel(p.category)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => onGo({ section: "projects" })} className="mt-4 text-sm font-medium text-primary hover:underline">
            Toutes les campagnes
          </button>
        </Panel>

        <Panel title="Dernières contributions confirmées">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune contribution confirmée pour le moment.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {[d.donor_first_name, d.donor_last_name].filter(Boolean).join(" ") || "Anonyme"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {categoryLabel(d.cause)} · {paymentMethodLabels[d.payment_method] ?? d.payment_method} · {formatDate(d.created_at)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatCFA(d.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => onGo({ section: "donations" })} className="mt-4 text-sm font-medium text-primary hover:underline">
            Tous les dons
          </button>
        </Panel>
      </div>
    </div>
  );
}
