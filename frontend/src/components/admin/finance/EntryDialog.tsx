import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownRight, ArrowUpRight, FileCheck2, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { EntryKind, financeApi, FinanceEntry, FinanceEntryInput, FinanceMeta, Project } from "@/api";
import { cn } from "@/lib/utils";

const NO_PROJECT = "none";
const today = () => new Date().toISOString().slice(0, 10);

function emptyForm(kind: EntryKind): FinanceEntryInput {
  return {
    kind,
    entry_date: today(),
    amount: 0,
    category: kind === "income" ? "donation_offline" : "equipment",
    label: "",
    project_id: null,
    payment_method: "cash",
    reference: null,
    document_id: null,
  };
}

interface EntryDialogProps {
  open: boolean;
  entry: FinanceEntry | null; // null = new entry
  meta: FinanceMeta;
  projects: Project[];
  onOpenChange: (open: boolean) => void;
  onSaved: (entry: FinanceEntry) => void;
}

export default function EntryDialog({ open, entry, meta, projects, onOpenChange, onSaved }: EntryDialogProps) {
  const [form, setForm] = useState<FinanceEntryInput>(emptyForm("expense"));
  const [amountText, setAmountText] = useState("");
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const start = entry ? { ...entry } : emptyForm("expense");
    setForm(start);
    setAmountText(entry ? String(entry.amount) : "");
    setDocumentName(entry?.document_id ? "Justificatif joint" : null);
  }, [open, entry]);

  const set = <K extends keyof FinanceEntryInput>(key: K, value: FinanceEntryInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const categories = form.kind === "income" ? meta.income_categories : meta.expense_categories;

  const switchKind = (kind: EntryKind) => {
    setForm((f) => ({ ...f, kind, category: kind === "income" ? "donation_offline" : "equipment" }));
  };

  const attach = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const doc = await financeApi.uploadDocument(file);
      set("document_id", doc.id);
      setDocumentName(doc.filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'envoi du justificatif a échoué");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(amountText.replace(/\s/g, ""), 10);
    if (!(amount > 0)) {
      toast.error("Le montant doit être supérieur à 0");
      return;
    }
    if (!form.label.trim()) {
      toast.error("Indiquez un libellé");
      return;
    }
    const data: FinanceEntryInput = { ...form, amount, label: form.label.trim(), reference: form.reference?.trim() || null };
    setSaving(true);
    try {
      const saved = entry ? await financeApi.updateEntry(entry.id, data) : await financeApi.createEntry(data);
      onSaved(saved);
      toast.success(entry ? "Écriture modifiée" : form.kind === "income" ? "Recette enregistrée" : "Dépense enregistrée");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const activeProjects = projects.filter((p) => p.status !== "paused" || p.id === form.project_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{entry ? "Modifier l'écriture" : "Nouvelle écriture"}</DialogTitle>
            <DialogDescription>Les dons en ligne sont comptés automatiquement : saisissez ici tout le reste.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type d'écriture">
            {(["expense", "income"] as EntryKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={form.kind === k}
                onClick={() => switchKind(k)}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors",
                  form.kind === k ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {k === "income" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {k === "income" ? "Recette" : "Dépense"}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry-amount">Montant (FCFA) *</Label>
              <Input
                id="entry-amount"
                inputMode="numeric"
                placeholder="150 000"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/[^\d\s]/g, ""))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-date">Date *</Label>
              <Input id="entry-date" type="date" max={today()} value={form.entry_date} onChange={(e) => set("entry_date", e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-label">Libellé *</Label>
            <Input
              id="entry-label"
              maxLength={255}
              placeholder={form.kind === "income" ? "Ex. : Subvention de la mairie de Thiès" : "Ex. : Achat de 40 tables-bancs"}
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry-category">Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger id="entry-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categories).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-method">Moyen de paiement</Label>
              <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                <SelectTrigger id="entry-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(meta.payment_methods).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry-project">Campagne</Label>
              <Select
                value={form.project_id ? String(form.project_id) : NO_PROJECT}
                onValueChange={(v) => set("project_id", v === NO_PROJECT ? null : Number(v))}
              >
                <SelectTrigger id="entry-project"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>Aucune (frais généraux)</SelectItem>
                  {activeProjects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-reference">N° de facture / reçu / transaction</Label>
              <Input id="entry-reference" maxLength={100} value={form.reference ?? ""} onChange={(e) => set("reference", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Justificatif</Label>
            <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
            {form.document_id ? (
              <div className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
                <FileCheck2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{documentName}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => { set("document_id", null); setDocumentName(null); }} aria-label="Retirer le justificatif">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                Joindre une facture ou un reçu (PDF ou photo)
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
