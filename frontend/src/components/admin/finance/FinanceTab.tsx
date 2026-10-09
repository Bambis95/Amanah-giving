import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { financeApi, FinanceMeta, Project } from "@/api";
import SummaryPanel from "./SummaryPanel";
import EntriesPanel from "./EntriesPanel";
import BudgetsPanel from "./BudgetsPanel";
import ReconciliationPanel from "./ReconciliationPanel";
import ReportCard from "./ReportCard";
import CommissionPanel from "./CommissionPanel";
import TodoPanel from "./TodoPanel";

interface FinanceTabProps {
  projects: Project[];
  /** Treasurer and admins keep the accounts; the president reads them */
  canEdit: boolean;
  /** Admins set the platform commission rate; the rest of the finance team reads the statement */
  canSetCommission: boolean;
  currentUserId: string;
  /** Accountant and admins close months; only admins reopen one */
  canClose: boolean;
  canReopen: boolean;
}

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 2025 + 1 }, (_, i) => THIS_YEAR - i);

export type FinanceView = "todo" | "summary" | "entries" | "budgets" | "reconciliation" | "commission";

export default function FinanceTab({ projects, canEdit, canSetCommission, currentUserId, canClose, canReopen }: FinanceTabProps) {
  const [meta, setMeta] = useState<FinanceMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(THIS_YEAR);
  // Those who keep the accounts start on their to-do list; the president on the summary
  const [view, setView] = useState<FinanceView>(canEdit ? "todo" : "summary");

  useEffect(() => {
    financeApi
      .meta()
      .then(setMeta)
      .catch((e) => setError(e instanceof Error ? e.message : "Chargement impossible"));
  }, []);

  if (error) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center text-destructive">{error}</CardContent>
      </Card>
    );
  }
  if (!meta) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Chargement des finances">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as FinanceView)} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="scrollbar-hide h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="todo">À faire</TabsTrigger>
          <TabsTrigger value="summary">Synthèse</TabsTrigger>
          <TabsTrigger value="entries">Recettes & dépenses</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="reconciliation">Pointage des dons</TabsTrigger>
          <TabsTrigger value="commission">Commission</TabsTrigger>
        </TabsList>
        {view !== "budgets" && (
          <Select value={year ? String(year) : "all"} onValueChange={(v) => setYear(v === "all" ? null : Number(v))}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Période">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  Année {y}
                </SelectItem>
              ))}
              <SelectItem value="all">Toutes les années</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {!canEdit && (
        <p className="rounded-lg bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
          Lecture seule : les comptes sont tenus par le trésorier et les administrateurs.
        </p>
      )}

      <TabsContent value="todo" className="mt-0">
        <TodoPanel canEdit={canEdit} canClose={canClose} canReopen={canReopen} onGo={setView} />
      </TabsContent>
      <TabsContent value="summary" className="mt-0 space-y-4">
        <ReportCard year={year} projects={projects} />
        <SummaryPanel year={year} meta={meta} onGo={setView} />
      </TabsContent>
      <TabsContent value="entries" className="mt-0">
        <EntriesPanel year={year} meta={meta} projects={projects} canEdit={canEdit} currentUserId={currentUserId} />
      </TabsContent>
      <TabsContent value="budgets" className="mt-0">
        <BudgetsPanel meta={meta} projects={projects} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="reconciliation" className="mt-0">
        <ReconciliationPanel year={year} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="commission" className="mt-0">
        <CommissionPanel year={year} canSet={canSetCommission} />
      </TabsContent>
    </Tabs>
  );
}
