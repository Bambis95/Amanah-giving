import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCheck, FileImage, Loader2, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { tontineApi, TontineGroup, TontineMemberRow, TontineMethod, TontineOperation, TontineRole } from "@/api";
import { formatCFA } from "@/components/admin/format";
import { dayLabel, KIND_LABELS, METHOD_LABELS, todayIso } from "./labels";
import { cn } from "@/lib/utils";

type Kind = TontineOperation["kind"];

function OperationDialog({ group, members, open, onClose, onSaved }: {
  group: TontineGroup; members: TontineMemberRow[]; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [kind, setKind] = useState<Kind>("deposit");
  const [memberId, setMemberId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<TontineMethod>("bank_transfer");
  const [source, setSource] = useState<"cash" | "bank">("bank");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const document_id = file ? (await tontineApi.uploadSlip(group.id, file)).id : null;
      await tontineApi.record(group.id, {
        kind, member_id: kind === "deposit" ? null : Number(memberId), op_date: date, amount: Number(amount), method,
        source: kind === "payout" ? source : null, reference: reference || null, document_id,
      });
      toast.success(kind === "contribution" ? "Cotisation enregistrée" : "Enregistré : à valider par une autre personne");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle opération</DialogTitle>
          <DialogDescription>Les dépôts et versements comptent dès qu'une deuxième personne (président ou trésorier) les valide.</DialogDescription>
        </DialogHeader>
        <form id="op-form" onSubmit={submit} className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => { setKind(v as Kind); setMethod(v === "contribution" ? "cash" : "bank_transfer"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABELS) as Kind[]).map((k) => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {kind !== "deposit" && (
            <div className="space-y-1.5">
              <Label>Membre</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="op-date">Date</Label><Input id="op-date" type="date" max={todayIso()} required value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="op-amount">Montant (FCFA)</Label><Input id="op-amount" type="number" inputMode="numeric" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Moyen</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as TontineMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(METHOD_LABELS) as TontineMethod[]).map((m) => <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {kind === "payout" && (
            <div className="space-y-1.5">
              <Label>L'argent sort de</Label>
              <Select value={source} onValueChange={(v) => setSource(v as "cash" | "bank")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Le compte bancaire de l'association</SelectItem>
                  <SelectItem value="cash">La caisse du trésorier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {kind !== "contribution" && (
            <>
              <div className="space-y-1.5"><Label htmlFor="op-ref">Référence (n° de bordereau, de transaction)</Label><Input id="op-ref" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label htmlFor="op-file">Photo du bordereau ou du reçu</Label>
                <Input id="op-file" type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="op-form" disabled={busy || (kind !== "deposit" && !memberId)}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The month's ledger: who recorded what, what waits for a second person, what was cancelled and why */
export default function OperationsPanel({ group, role, userId, members, operations, onChange }: {
  group: TontineGroup; role: TontineRole; userId: string; members: TontineMemberRow[]; operations: TontineOperation[]; onChange: () => void;
}) {
  const leader = role === "admin" || role === "president";
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<TontineOperation | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const act = async (id: number, action: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await action();
      toast.success(done);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-3 p-4 md:p-6">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />Nouvelle opération</Button>
        </div>
        {operations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucune opération ce mois-ci.</p>
        ) : (
          <ul className="divide-y divide-border">
            {operations.map((o) => (
              <li key={o.id} className={cn("flex flex-wrap items-center gap-3 py-3", o.cancelled_at && "opacity-60")}>
                <div className="min-w-0 flex-1 basis-56">
                  <p className={cn("font-medium text-foreground", o.cancelled_at && "line-through")}>
                    {KIND_LABELS[o.kind]}{o.member_name ? ` · ${o.member_name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dayLabel(o.op_date)} · {o.method_label}
                    {o.source ? ` · depuis ${o.source === "bank" ? "la banque" : "la caisse"}` : ""}
                    {o.reference ? ` · réf. ${o.reference}` : ""} · saisi par {o.recorded_by_name ?? "?"}
                    {o.validated_by_name ? ` · validé par ${o.validated_by_name}` : ""}
                  </p>
                  {o.cancelled_at && <p className="text-xs text-destructive">Annulé : {o.cancel_reason}</p>}
                </div>
                <span className={cn("tabular-nums font-semibold", o.kind === "contribution" ? "text-success" : "text-foreground")}>
                  {o.kind === "contribution" ? "+" : "−"} {formatCFA(o.amount)}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {o.needs_validation && <Badge className="bg-highlight text-highlight-foreground">À valider</Badge>}
                  {o.document_id && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Voir le bordereau"
                      onClick={() => tontineApi.openSlip(group.id, o.document_id!).catch((e) => toast.error(e.message))}>
                      <FileImage className="h-4 w-4" />
                    </Button>
                  )}
                  {o.needs_validation && o.recorded_by !== userId && (
                    <Button size="sm" variant="outline" className="h-8" disabled={busy === o.id}
                      onClick={() => act(o.id, () => tontineApi.validate(group.id, o.id), "Opération validée")}>
                      <CheckCheck className="mr-1 h-4 w-4" />Valider
                    </Button>
                  )}
                  {!o.cancelled_at && (leader || (o.recorded_by === userId && !o.validated_at)) && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Annuler l'opération" onClick={() => { setCancelling(o); setReason(""); }}>
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {adding && <OperationDialog group={group} members={members} open onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChange(); }} />}
      <Dialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Annuler cette opération ?</DialogTitle>
            <DialogDescription>Elle reste visible, barrée, avec le motif. Rien ne s'efface : c'est inscrit au journal.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder="Motif : erreur de montant, doublon…" aria-label="Motif" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>Retour</Button>
            <Button variant="destructive" disabled={reason.trim().length < 3 || busy === cancelling?.id}
              onClick={() => { const o = cancelling!; setCancelling(null); act(o.id, () => tontineApi.cancel(group.id, o.id, reason.trim()), "Opération annulée"); }}>
              Annuler l'opération
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
