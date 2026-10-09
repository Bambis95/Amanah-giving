import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowDownRight, ArrowUpRight, Ban, CheckCheck, Download, Loader2, MessageSquare, Paperclip, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { financeApi, FinanceEntry, FinanceMeta, Project } from "@/api";
import { formatCFA } from "../format";
import { cn } from "@/lib/utils";
import EntryDialog from "./EntryDialog";
import CommentsDialog from "./CommentsDialog";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const formatDay = (iso: string) => dateFormat.format(new Date(`${iso}T12:00:00`));

interface EntriesPanelProps {
  year: number | null;
  meta: FinanceMeta;
  projects: Project[];
  canEdit: boolean;
  /** Who is looking: nobody validates their own entries */
  currentUserId: string;
}

// CSV for Excel (French locale): ";" separator, UTF-8 with BOM so accents display correctly
function exportCsv(rows: FinanceEntry[], meta: FinanceMeta, projectTitle: (id: number | null) => string, year: number | null) {
  const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Date", "Type", "Libellé", "Catégorie", "Campagne", "Moyen", "Référence", "Recette", "Dépense", "Statut", "Saisi par"];
  const lines = rows.map((e) =>
    [
      e.entry_date,
      e.kind === "income" ? "Recette" : "Dépense",
      e.label,
      (e.kind === "income" ? meta.income_categories : meta.expense_categories)[e.category] ?? e.category,
      projectTitle(e.project_id),
      meta.payment_methods[e.payment_method] ?? e.payment_method,
      e.reference,
      e.kind === "income" ? e.amount : "",
      e.kind === "expense" ? e.amount : "",
      e.cancelled_at ? `Annulée : ${e.cancel_reason ?? ""}` : e.validated_at ? `Validée (${e.validated_by_name ?? ""})` : "À valider",
      e.created_by_name,
    ].map(cell).join(";")
  );
  const blob = new Blob(["﻿" + [header.map(cell).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comptes-senjapo-${year ?? "toutes-annees"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EntriesPanel({ year, meta, projects, canEdit, currentUserId }: EntriesPanelProps) {
  const [entries, setEntries] = useState<FinanceEntry[] | null>(null);
  const [kind, setKind] = useState("all");
  const [showCancelled, setShowCancelled] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState<FinanceEntry | null>(null);
  const [reason, setReason] = useState("");
  const [discussing, setDiscussing] = useState<FinanceEntry | null>(null);
  const [validating, setValidating] = useState<number | null>(null);

  const validate = async (e: FinanceEntry) => {
    setValidating(e.id);
    try {
      saved(await financeApi.validateEntry(e.id));
      toast.success("Écriture validée : elle compte maintenant dans les totaux");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validation impossible");
    } finally {
      setValidating(null);
    }
  };

  useEffect(() => {
    setEntries(null);
    financeApi
      .entries(year)
      .then(setEntries)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Chargement impossible");
        setEntries([]);
      });
  }, [year]);

  const projectTitle = (id: number | null) => (id ? projects.find((p) => p.id === id)?.title ?? `Campagne n° ${id}` : "");
  const categoryOf = (e: FinanceEntry) => (e.kind === "income" ? meta.income_categories : meta.expense_categories)[e.category] ?? e.category;

  const visible = useMemo(
    () => (entries ?? []).filter((e) => (kind === "all" || e.kind === kind) && (showCancelled || !e.cancelled_at)),
    [entries, kind, showCancelled]
  );
  // Totals as the reports count them: validated, not cancelled
  const totals = visible.reduce(
    (t, e) => (e.cancelled_at || !e.validated_at ? t : { ...t, [e.kind]: t[e.kind] + e.amount }),
    { income: 0, expense: 0 } as Record<string, number>
  );

  const saved = (entry: FinanceEntry) =>
    setEntries((list) => {
      const rest = (list ?? []).filter((e) => e.id !== entry.id);
      return [entry, ...rest].sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id);
    });

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      saved(await financeApi.cancelEntry(cancelling.id, reason.trim()));
      toast.success("Écriture annulée");
      setCancelling(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Annulation impossible");
    }
  };

  const openDocument = (id: string) => financeApi.openDocument(id).catch((e) => toast.error(e instanceof Error ? e.message : "Justificatif indisponible"));

  const actions = (e: FinanceEntry) => (
    <div className="flex items-center justify-end gap-1">
      {canEdit && !e.cancelled_at && !e.validated_at && e.created_by !== currentUserId && (
        <Button size="sm" variant="outline" className="h-8" disabled={validating === e.id} onClick={() => validate(e)}>
          {validating === e.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1 h-4 w-4" />}
          Valider
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => setDiscussing(e)} aria-label={`Commentaires sur ${e.label}`} title="Commentaires">
        <MessageSquare className="h-4 w-4" />
        {!!e.comments && <span className="ml-1 text-xs tabular-nums">{e.comments}</span>}
      </Button>
      {e.document_id && (
        <Button variant="ghost" size="sm" onClick={() => openDocument(e.document_id!)} aria-label={`Voir le justificatif de ${e.label}`}>
          <Paperclip className="h-4 w-4" />
        </Button>
      )}
      {canEdit && !e.cancelled_at && (
        <>
          <Button variant="ghost" size="sm" onClick={() => { setEditing(e); setDialogOpen(true); }} aria-label={`Modifier ${e.label}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setCancelling(e); setReason(""); }} aria-label={`Annuler ${e.label}`}>
            <Ban className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );

  const amount = (e: FinanceEntry) => (
    <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", e.cancelled_at ? "text-muted-foreground line-through" : "text-foreground")}>
      {e.kind === "income" ? <ArrowUpRight className="h-4 w-4 text-success" aria-label="Recette" /> : <ArrowDownRight className="h-4 w-4 text-destructive" aria-label="Dépense" />}
      {e.kind === "income" ? "+" : "−"} {formatCFA(e.amount)}
    </span>
  );

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {canEdit && (
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle écriture
            </Button>
          )}
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="sm:w-44" aria-label="Type d'écriture"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Recettes et dépenses</SelectItem>
              <SelectItem value="income">Recettes</SelectItem>
              <SelectItem value="expense">Dépenses</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="show-cancelled" checked={showCancelled} onCheckedChange={setShowCancelled} />
            <Label htmlFor="show-cancelled" className="text-sm font-normal">Afficher les écritures annulées</Label>
          </div>
          <Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => exportCsv(visible, meta, projectTitle, year)} disabled={visible.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />
            Exporter (Excel)
          </Button>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          {visible.length} écriture{visible.length > 1 ? "s" : ""} · validées : recettes {formatCFA(totals.income)} · dépenses {formatCFA(totals.expense)}
          <span className="block text-xs">Les dons en ligne n'apparaissent pas ici : ils sont comptés automatiquement dans la synthèse.</span>
        </p>

        {entries === null ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            Aucune écriture{year ? ` en ${year}` : ""}.{canEdit && " Commencez par « Nouvelle écriture »."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((e) => (
              <li key={e.id} className={cn("flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4", e.cancelled_at && "opacity-70")}>
                <div className="w-24 shrink-0 text-sm text-muted-foreground">{formatDay(e.entry_date)}</div>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium text-foreground", e.cancelled_at && "line-through")}>{e.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {[categoryOf(e), projectTitle(e.project_id), meta.payment_methods[e.payment_method], e.reference && `réf. ${e.reference}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {e.cancelled_at ? (
                    <Badge variant="outline" className="mt-1 border-destructive/40 text-destructive">Annulée : {e.cancel_reason}</Badge>
                  ) : e.validated_at ? (
                    <Badge variant="outline" className="mt-1 border-success/40 text-success">
                      Validée{e.validated_by_name ? ` par ${e.validated_by_name}` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1 border-warning/50 text-warning">
                      À valider{e.created_by_name ? ` · saisie par ${e.created_by_name}` : ""}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  {amount(e)}
                  {actions(e)}
                </div>
              </li>
            ))}
          </ul>
        )}

        <CommentsDialog
          entry={discussing}
          canWrite={canEdit}
          onOpenChange={(open) => !open && setDiscussing(null)}
          onCommented={(id) => setEntries((list) => (list ?? []).map((x) => (x.id === id ? { ...x, comments: (x.comments ?? 0) + 1 } : x)))}
        />

        <EntryDialog open={dialogOpen} entry={editing} meta={meta} projects={projects} onOpenChange={setDialogOpen} onSaved={saved} />

        <AlertDialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler « {cancelling?.label} » ?</AlertDialogTitle>
              <AlertDialogDescription>
                L'écriture reste visible dans l'historique mais ne compte plus dans les totaux. Indiquez pourquoi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              aria-label="Motif de l'annulation"
              placeholder="Ex. : saisie en double, mauvais montant…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={255}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Garder</AlertDialogCancel>
              <AlertDialogAction
                onClick={(ev) => { ev.preventDefault(); confirmCancel(); }}
                disabled={reason.trim().length < 3}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Annuler l'écriture
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
