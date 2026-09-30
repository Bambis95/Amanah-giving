import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Heart, Loader2, Scale } from "lucide-react";
import { financeApi, FinanceMeta, FinanceSummary } from "@/api";
import { formatCFA, paymentMethodLabels } from "../format";
import { cn } from "@/lib/utils";
import type { FinanceView } from "./FinanceTab";

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function Tile({ icon: Icon, label, value, detail, emphasis }: { icon: React.ElementType; label: string; value: string; detail: string; emphasis?: "negative" }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </div>
        <p className={cn("truncate text-xl font-bold tabular-nums sm:text-2xl", emphasis === "negative" ? "text-destructive" : "text-foreground")}>{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

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

export default function SummaryPanel({ year, meta, onGo }: { year: number | null; meta: FinanceMeta; onGo: (view: FinanceView) => void }) {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    financeApi
      .summary(year)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Chargement impossible"));
  }, [year]);

  if (error) return <p className="py-12 text-center text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Chargement de la synthèse">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const income = data.donations.total + data.other_income;
  const chart = data.months.map((m) => ({ month: MONTHS[m.month - 1], recettes: m.donations + m.other_income, depenses: m.expenses }));
  const hasChart = chart.some((m) => m.recettes || m.depenses);
  const expenseRows = Object.entries(data.by_category.expense).sort((a, b) => b[1] - a[1]);
  const incomeRows = Object.entries(data.by_category.income).sort((a, b) => b[1] - a[1]);
  const projects = data.projects.filter((p) => p.received || p.spent || p.budget);
  const period = year ? `en ${year}` : "depuis le début";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Tile icon={Heart} label="Dons en ligne" value={formatCFA(data.donations.total)} detail={`${data.donations.count} don${data.donations.count > 1 ? "s" : ""} payé${data.donations.count > 1 ? "s" : ""} ${period}`} />
        <Tile icon={ArrowUpRight} label="Autres recettes" value={formatCFA(data.other_income)} detail="subventions, cotisations, espèces…" />
        <Tile icon={ArrowDownRight} label="Dépenses" value={formatCFA(data.expenses)} detail={`${expenseRows.length} catégorie${expenseRows.length > 1 ? "s" : ""}`} />
        <Tile
          icon={Scale}
          label="Solde"
          value={formatCFA(data.balance)}
          detail={`recettes ${formatCFA(income)} − dépenses`}
          emphasis={data.balance < 0 ? "negative" : undefined}
        />
      </div>

      {data.reconciliation.pending_count > 0 ? (
        <button
          type="button"
          onClick={() => onGo("reconciliation")}
          className="group flex w-full items-center gap-3 rounded-xl border border-highlight/40 bg-highlight/10 p-4 text-left transition-colors hover:border-highlight"
        >
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold text-foreground">
              {data.reconciliation.pending_count} don{data.reconciliation.pending_count > 1 ? "s" : ""} à pointer ·{" "}
              {formatCFA(data.reconciliation.pending_total)}
            </span>
            <span className="text-muted-foreground">Vérifiez-les sur les relevés PayTech, Wave ou Orange Money.</span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      ) : (
        data.donations.count > 0 && (
          <p className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
            Tous les dons en ligne {period} sont pointés.
          </p>
        )
      )}

      {year && (
        <Panel title={`Recettes et dépenses par mois (${year})`}>
          {hasChart ? (
            <>
              <div className="mb-3 flex gap-4 text-sm text-muted-foreground" aria-hidden="true">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: "var(--chart-income)" }} />Recettes</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: "var(--chart-expense)" }} />Dépenses</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => compact.format(v)} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      formatter={(v: number, name: string) => [formatCFA(v), name === "recettes" ? "Recettes" : "Dépenses"]}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }}
                    />
                    <Bar dataKey="recettes" fill="var(--chart-income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="depenses" fill="var(--chart-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-primary">Voir les chiffres</summary>
                <table className="mt-2 w-full text-left tabular-nums">
                  <thead className="text-muted-foreground">
                    <tr><th className="py-1 font-medium">Mois</th><th className="py-1 text-right font-medium">Recettes</th><th className="py-1 text-right font-medium">Dépenses</th></tr>
                  </thead>
                  <tbody>
                    {chart.map((m) => (
                      <tr key={m.month} className="border-t border-border">
                        <td className="py-1">{m.month}</td>
                        <td className="py-1 text-right">{formatCFA(m.recettes)}</td>
                        <td className="py-1 text-right">{formatCFA(m.depenses)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">Aucun mouvement en {year}.</p>
          )}
        </Panel>
      )}

      <Panel title="Par campagne">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun mouvement rattaché à une campagne {period}.</p>
        ) : (
          <ul className="space-y-4">
            {projects.map((p) => {
              const used = p.budget > 0 ? Math.min(p.spent / p.budget, 1) : 0;
              return (
                <li key={p.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-medium text-foreground">{p.title}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      reçu {formatCFA(p.received)} · dépensé {formatCFA(p.spent)} ·{" "}
                      <span className={cn("font-semibold", p.available < 0 ? "text-destructive" : "text-foreground")}>disponible {formatCFA(p.available)}</span>
                    </span>
                  </div>
                  {p.budget > 0 ? (
                    <>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(used * 100)}
                        aria-label={`${p.title} : ${Math.round(used * 100)} % du budget dépensé`}
                      >
                        <div className={cn("h-full rounded-full", p.spent > p.budget ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.max(used * 100, used ? 2 : 0)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Math.round((p.spent / p.budget) * 100)} % du budget de {formatCFA(p.budget)}
                        {p.spent > p.budget && " : budget dépassé"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Pas encore de budget : ajoutez-le dans l'onglet Budgets.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Dépenses par catégorie">
          <CategoryBars rows={expenseRows} labels={meta.expense_categories} empty={`Aucune dépense ${period}.`} />
        </Panel>
        <Panel title="Recettes par origine">
          <CategoryBars
            rows={[
              ...Object.entries(data.donations.by_method).map(([m, v]) => [`online:${m}`, v] as [string, number]),
              ...incomeRows,
            ].sort((a, b) => b[1] - a[1])}
            labels={{
              ...meta.income_categories,
              ...Object.fromEntries(Object.keys(data.donations.by_method).map((m) => [`online:${m}`, `Dons en ligne · ${paymentMethodLabels[m] ?? m}`])),
            }}
            empty={`Aucune recette ${period}.`}
          />
        </Panel>
      </div>
    </div>
  );
}

function CategoryBars({ rows, labels, empty }: { rows: [string, number][]; labels: Record<string, string>; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r[1]));
  return (
    <ul className="space-y-3">
      {rows.map(([key, value]) => (
        <li key={key}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-foreground">{labels[key] ?? key}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatCFA(value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
