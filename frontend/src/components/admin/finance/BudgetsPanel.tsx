import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BudgetLine, financeApi, FinanceEntry, FinanceMeta, Project } from "@/api";
import { formatCFA } from "../format";
import { cn } from "@/lib/utils";

interface BudgetsPanelProps {
  meta: FinanceMeta;
  projects: Project[];
  canEdit: boolean;
}

type Row = BudgetLine & { key: number; amountText: string };
let nextKey = 1;
const toRow = (line: BudgetLine): Row => ({ ...line, key: nextKey++, amountText: String(line.planned_amount) });

/** Planned spending of one campaign, line by line, next to what is actually spent in each category */
export default function BudgetsPanel({ meta, projects, canEdit }: BudgetsPanelProps) {
  const [projectId, setProjectId] = useState<number | null>(projects[0]?.id ?? null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setRows(null);
    setDirty(false);
    Promise.all([financeApi.budget(projectId), financeApi.entries(null)])
      .then(([lines, all]) => {
        setRows(lines.map(toRow));
        setEntries(all.filter((e) => e.project_id === projectId && !e.cancelled_at));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));
  }, [projectId]);

  const project = projects.find((p) => p.id === projectId);
  const spentBy = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) if (e.kind === "expense") map[e.category] = (map[e.category] ?? 0) + e.amount;
    return map;
  }, [entries]);

  if (projects.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">Créez d'abord une campagne pour lui donner un budget.</p>;
  }

  const update = (key: number, patch: Partial<Row>) => {
    setRows((list) => (list ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const amountOf = (r: Row) => parseInt(r.amountText.replace(/\s/g, ""), 10) || 0;
  const total = (rows ?? []).reduce((s, r) => s + amountOf(r), 0);
  const spent = Object.values(spentBy).reduce((a, b) => a + b, 0);
  // Spending in a category that has no budget line still counts, shown apart
  const unplanned = Object.entries(spentBy).filter(([c]) => !(rows ?? []).some((r) => r.category === c));

  const save = async () => {
    if (!projectId || !rows) return;
    if (rows.some((r) => !r.label.trim())) {
      toast.error("Chaque ligne a besoin d'un libellé");
      return;
    }
    setSaving(true);
    try {
      const lines = await financeApi.saveBudget(projectId, rows.map((r) => ({ label: r.label.trim(), category: r.category, planned_amount: amountOf(r) })));
      setRows(lines.map(toRow));
      setDirty(false);
      toast.success("Budget enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-5 p-4 md:p-6">
        <div className="space-y-2">
          <Label htmlFor="budget-project">Campagne</Label>
          <Select
            value={projectId ? String(projectId) : undefined}
            onValueChange={(v) => {
              if (dirty && !window.confirm("Le budget modifié n'est pas enregistré. Changer de campagne quand même ?")) return;
              setProjectId(Number(v));
            }}
          >
            <SelectTrigger id="budget-project" className="sm:max-w-md"><SelectValue /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {rows === null ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid gap-3 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-3">
              <p><span className="block text-muted-foreground">Objectif de collecte</span><span className="font-semibold tabular-nums">{project && project.goal > 0 ? formatCFA(project.goal) : "—"}</span></p>
              <p><span className="block text-muted-foreground">Budget prévu</span><span className="font-semibold tabular-nums">{formatCFA(total)}</span></p>
              <p><span className="block text-muted-foreground">Déjà dépensé</span><span className={cn("font-semibold tabular-nums", total > 0 && spent > total && "text-destructive")}>{formatCFA(spent)}{total > 0 && ` (${Math.round((spent / total) * 100)} %)`}</span></p>
            </div>
            {project && project.goal > 0 && total > project.goal && (
              <p className="text-sm text-warning">Le budget prévu dépasse l'objectif de collecte de {formatCFA(total - project.goal)}.</p>
            )}

            {rows.length === 0 && !canEdit ? (
              <p className="py-8 text-center text-muted-foreground">Pas encore de budget pour cette campagne.</p>
            ) : (
              <ul className="space-y-3">
                {rows.map((r) => {
                  const used = spentBy[r.category] ?? 0;
                  const planned = amountOf(r);
                  return (
                    <li key={r.key} className="rounded-lg border border-border p-3">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
                        <Input aria-label="Libellé de la ligne" value={r.label} placeholder="Ex. : Construction des salles" onChange={(e) => update(r.key, { label: e.target.value })} disabled={!canEdit} maxLength={200} />
                        <Select value={r.category} onValueChange={(v) => update(r.key, { category: v })} disabled={!canEdit}>
                          <SelectTrigger aria-label="Catégorie de la ligne"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(meta.expense_categories).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input aria-label="Montant prévu (FCFA)" inputMode="numeric" value={r.amountText} onChange={(e) => update(r.key, { amountText: e.target.value.replace(/[^\d\s]/g, "") })} disabled={!canEdit} className="tabular-nums" />
                        {canEdit && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setRows((list) => (list ?? []).filter((x) => x.key !== r.key)); setDirty(true); }} aria-label={`Supprimer la ligne ${r.label}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", planned && used > planned ? "bg-destructive" : "bg-primary")} style={{ width: `${planned ? Math.min((used / planned) * 100, 100) : 0}%` }} />
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          dépensé {formatCFA(used)}{planned ? ` / ${formatCFA(planned)}` : ""}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {unplanned.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Dépenses hors budget :{" "}
                {unplanned.map(([c, v]) => `${meta.expense_categories[c] ?? c} (${formatCFA(v)})`).join(", ")}
              </p>
            )}

            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { setRows((list) => [...(list ?? []), toRow({ label: "", category: "equipment", planned_amount: 0 })]); setDirty(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter une ligne
                </Button>
                <Button onClick={save} disabled={saving || !dirty}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Enregistrer le budget
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
