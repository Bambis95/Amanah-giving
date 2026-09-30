import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { financeApi, ReconciliationRow } from "@/api";
import { formatCFA, formatDate, paymentMethodLabels } from "../format";

type State = "pending" | "done" | "all";

/** Tick each paid online donation once it is found on the operator's statement */
export default function ReconciliationPanel({ year, canEdit }: { year: number | null; canEdit: boolean }) {
  const [state, setState] = useState<State>("pending");
  const [rows, setRows] = useState<ReconciliationRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    setRows(null);
    financeApi
      .reconciliation(state, year)
      .then(setRows)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Chargement impossible");
        setRows([]);
      });
  }, [state, year]);

  const toggle = async (row: ReconciliationRow) => {
    setBusy(row.id);
    try {
      const result = await financeApi.reconcile(row.id, !row.reconciled_at);
      setRows((list) =>
        (list ?? [])
          .map((r) => (r.id === row.id ? { ...r, reconciled_at: result.reconciled_at, reconciled_by_name: result.reconciled_at ? "vous" : null } : r))
          // In a filtered view the ticked row leaves the list
          .filter((r) => state === "all" || (state === "pending" ? !r.reconciled_at : !!r.reconciled_at))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Modification impossible");
    } finally {
      setBusy(null);
    }
  };

  const byMethod = (rows ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.payment_method]: (acc[r.payment_method] ?? 0) + r.amount }), {});

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-muted-foreground">
            Ouvrez le relevé PayTech (ou Wave, Orange Money) et cochez chaque don que vous y retrouvez, même montant et même
            référence. Un don qui ne figure pas sur le relevé doit être signalé à un administrateur.
          </p>
          <Select value={state} onValueChange={(v) => setState(v as State)}>
            <SelectTrigger className="sm:w-44" aria-label="Dons affichés"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">À pointer</SelectItem>
              <SelectItem value="done">Pointés</SelectItem>
              <SelectItem value="all">Tous les dons payés</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {rows && rows.length > 0 && (
          <p className="mb-3 text-sm text-muted-foreground">
            {rows.length} don{rows.length > 1 ? "s" : ""} · {formatCFA(rows.reduce((s, r) => s + r.amount, 0))}
            {" "}(
            {Object.entries(byMethod).map(([m, v]) => `${paymentMethodLabels[m] ?? m} ${formatCFA(v)}`).join(" · ")})
          </p>
        )}

        {rows === null ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            {state === "pending" && <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />}
            {state === "pending" ? "Tous les dons payés sont pointés." : "Aucun don dans cette liste."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {formatCFA(r.amount)} · {paymentMethodLabels[r.payment_method] ?? r.payment_method}
                    <span className="font-normal text-muted-foreground"> · don n° {r.id}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[formatDate(r.created_at), r.donor_name ?? "Anonyme", r.project_title, r.payment_reference && `réf. ${r.payment_reference}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {r.reconciled_at && (
                    <p className="text-xs text-success">Pointé le {formatDate(r.reconciled_at)}{r.reconciled_by_name && ` par ${r.reconciled_by_name}`}</p>
                  )}
                </div>
                {canEdit ? (
                  <Button
                    variant={r.reconciled_at ? "outline" : "default"}
                    size="sm"
                    onClick={() => toggle(r)}
                    disabled={busy === r.id}
                    aria-pressed={!!r.reconciled_at}
                    className="shrink-0"
                  >
                    {busy === r.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : r.reconciled_at ? <Circle className="mr-1.5 h-4 w-4" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                    {r.reconciled_at ? "Dépointer" : "Pointer"}
                  </Button>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">{r.reconciled_at ? "Pointé" : "À pointer"}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
