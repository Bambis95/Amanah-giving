import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCheck, Clock, FileWarning, Loader2, Lock, LockOpen, Receipt } from "lucide-react";
import { toast } from "sonner";
import { financeApi, FinanceClosure, FinanceTodo, FinanceTodoItem } from "@/api";
import { formatCFA } from "../format";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR");

/** The six finished months before this one, newest first ("2026-09", ...) */
function recentMonths(): string[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

interface TodoPanelProps {
  canEdit: boolean;
  /** Accountant and admins close months */
  canClose: boolean;
  /** Only admins reopen a closed month */
  canReopen: boolean;
  onGo: (view: "entries" | "reconciliation") => void;
}

function List({ items, empty, action }: { items: FinanceTodoItem[]; empty: string; action?: (i: FinanceTodoItem) => React.ReactNode }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((i) => (
        <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="font-medium text-foreground">{i.label}</span>
            <span className="text-muted-foreground"> · {day(i.entry_date)} · {i.kind === "income" ? "+" : "−"} {formatCFA(i.amount)}</span>
          </span>
          {action?.(i)}
        </li>
      ))}
    </ul>
  );
}

/** Shared to-do of the treasurer and the accountant, and the monthly close */
export default function TodoPanel({ canEdit, canClose, canReopen, onGo }: TodoPanelProps) {
  const [todo, setTodo] = useState<FinanceTodo | null>(null);
  const [closures, setClosures] = useState<FinanceClosure[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmMonth, setConfirmMonth] = useState<string | null>(null);

  const load = useCallback(() => {
    financeApi.todo().then(setTodo).catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));
    financeApi.closures().then(setClosures).catch(() => setClosures([]));
  }, []);
  useEffect(load, [load]);

  const act = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(done);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(null);
    }
  };

  if (!todo) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const closed = new Map(closures.map((c) => [c.month, c]));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardContent className="space-y-3 p-4 md:p-6">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <CheckCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              À valider par vous ({todo.to_validate.length})
            </h3>
            <p className="text-xs text-muted-foreground">Saisies par une autre personne : vérifiez le montant et le justificatif.</p>
            <List
              items={todo.to_validate}
              empty="Rien à valider."
              action={canEdit ? (i) => (
                <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={busy === `v${i.id}`}
                  onClick={() => act(`v${i.id}`, () => financeApi.validateEntry(i.id), "Écriture validée")}>
                  {busy === `v${i.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider"}
                </Button>
              ) : undefined}
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="space-y-3 p-4 md:p-6">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
              Vos saisies en attente ({todo.waiting_for_others.length})
            </h3>
            <p className="text-xs text-muted-foreground">Elles comptent dès que l'autre personne les a validées.</p>
            <List items={todo.waiting_for_others} empty="Aucune saisie en attente." />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="space-y-3 p-4 md:p-6">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <FileWarning className="h-4 w-4 text-destructive" aria-hidden="true" />
              Dépenses sans justificatif ({todo.missing_receipts.length})
            </h3>
            <List items={todo.missing_receipts} empty="Toutes les dépenses ont leur justificatif." />
            {todo.missing_receipts.length > 0 && (
              <Button variant="link" className="h-auto p-0" onClick={() => onGo("entries")}>Ajouter les justificatifs</Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="space-y-3 p-4 md:p-6">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
              Dons à pointer
            </h3>
            <p className="text-sm text-muted-foreground">
              {todo.donations_to_tick.count === 0
                ? "Tous les dons payés sont pointés sur les relevés."
                : `${todo.donations_to_tick.count} don(s) payé(s), ${formatCFA(todo.donations_to_tick.total)}, à retrouver sur les relevés Wave / Orange Money / PayTech.`}
            </p>
            {todo.donations_to_tick.count > 0 && (
              <Button variant="link" className="h-auto p-0" onClick={() => onGo("reconciliation")}>Pointer les dons</Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="space-y-3 p-4 md:p-6">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <Lock className="h-4 w-4 text-primary" aria-hidden="true" />
            Clôture des mois
          </h3>
          <p className="text-sm text-muted-foreground">
            Le comptable clôture un mois terminé quand toutes ses écritures sont validées : ses chiffres ne peuvent plus
            changer. Une erreur se corrige alors par une écriture dans un mois ouvert.
          </p>
          <ul className="divide-y divide-border">
            {recentMonths().map((m) => {
              const c = closed.get(m);
              return (
                <li key={m} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="capitalize text-foreground">{monthLabel(m)}</span>
                  {c ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Clôturé le {new Date(c.closed_at).toLocaleDateString("fr-FR")}{c.closed_by_name ? ` par ${c.closed_by_name}` : ""}
                      {canReopen && (
                        <Button size="sm" variant="ghost" className="h-8" disabled={busy === `r${m}`}
                          onClick={() => act(`r${m}`, () => financeApi.reopenMonth(m), "Mois rouvert (inscrit au Journal)")}>
                          <LockOpen className="mr-1 h-4 w-4" />
                          Rouvrir
                        </Button>
                      )}
                    </span>
                  ) : canClose ? (
                    <Button size="sm" variant="outline" className="h-8" disabled={busy === `c${m}`} onClick={() => setConfirmMonth(m)}>
                      Clôturer
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">Ouvert</span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <AlertDialog open={confirmMonth !== null} onOpenChange={(open) => !open && setConfirmMonth(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer {confirmMonth && monthLabel(confirmMonth)} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Plus aucune écriture de ce mois ne pourra être ajoutée, modifiée ou annulée. Seul un administrateur peut rouvrir
              un mois, et cela reste inscrit au Journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const m = confirmMonth!;
                setConfirmMonth(null);
                act(`c${m}`, () => financeApi.closeMonth(m), `Mois clôturé : ${monthLabel(m)}`);
              }}
            >
              Clôturer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
