import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCheck, FileImage, Loader2, MessageCircle, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { tontineApi, TontineAid, TontineGroup, TontineMemberRow, TontineMethod, TontineOperation, TontineRole } from "@/api";
import { formatCFA } from "@/components/admin/format";
import { useTontineText } from "@/i18n/tontine";
import { opLabel, todayIso, whatsappLink } from "./labels";
import { cn } from "@/lib/utils";

type Kind = TontineOperation["kind"];
const METHODS: TontineMethod[] = ["cash", "wave", "orange_money", "free_money", "bank_transfer"];
const AIDS: TontineAid[] = ["birth", "wedding", "death", "illness", "other"];

function OperationDialog({ group, members, onClose, onSaved }: {
  group: TontineGroup; members: TontineMemberRow[]; onClose: () => void; onSaved: () => void;
}) {
  const { tt } = useTontineText();
  const [kind, setKind] = useState<Kind>(group.kind === "mbootaay" ? "payout" : "deposit");
  const [memberId, setMemberId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<TontineMethod>(group.kind === "mbootaay" ? "cash" : "bank_transfer");
  const [source, setSource] = useState<"cash" | "bank">(group.kind === "mbootaay" ? "cash" : "bank");
  const [category, setCategory] = useState<TontineAid | "">("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const aid = kind === "payout" && group.kind === "mbootaay";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const document_id = file ? (await tontineApi.uploadSlip(group.id, file)).id : null;
      await tontineApi.record(group.id, {
        kind, member_id: kind === "deposit" ? null : Number(memberId), op_date: date, amount: Number(amount), method,
        source: kind === "payout" ? source : null, reference: reference || null, document_id,
        category: aid ? (category as TontineAid) : null, note: note || null,
      });
      toast.success(kind === "contribution" ? tt.savedContribution : tt.savedPending);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt.actionError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tt.newOp}</DialogTitle>
          <DialogDescription>{tt.opHelp}</DialogDescription>
        </DialogHeader>
        <form id="op-form" onSubmit={submit} className="grid gap-3">
          <div className="space-y-1.5">
            <Label>{tt.type}</Label>
            <Select value={kind} onValueChange={(v) => { setKind(v as Kind); if (v === "contribution") setMethod("cash"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["contribution", "deposit", "payout"] as Kind[]).map((k) => <SelectItem key={k} value={k}>{opLabel(tt, k, group)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {kind !== "deposit" && (
            <div className="space-y-1.5">
              <Label>{tt.member}</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder={tt.choose} /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {aid && (
            <div className="space-y-1.5">
              <Label>{tt.event}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TontineAid)}>
                <SelectTrigger><SelectValue placeholder={tt.choose} /></SelectTrigger>
                <SelectContent>{AIDS.map((a) => <SelectItem key={a} value={a}>{tt.aids[a]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="op-date">{tt.date}</Label><Input id="op-date" type="date" max={todayIso()} required value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="op-amount">{tt.amount}</Label><Input id="op-amount" type="number" inputMode="numeric" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>{tt.method}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as TontineMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{tt.methods[m]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {kind === "payout" && (
            <div className="space-y-1.5">
              <Label>{tt.source}</Label>
              <Select value={source} onValueChange={(v) => setSource(v as "cash" | "bank")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">{tt.sourceBank}</SelectItem>
                  <SelectItem value="cash">{tt.sourceCash}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {kind === "payout" && (
            <div className="space-y-1.5"><Label htmlFor="op-note">{tt.note}</Label><Input id="op-note" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          )}
          {kind !== "contribution" && (
            <>
              <div className="space-y-1.5"><Label htmlFor="op-ref">{tt.reference}</Label><Input id="op-ref" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label htmlFor="op-file">{tt.photo}</Label>
                <Input id="op-file" type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{tt.cancel}</Button>
          <Button type="submit" form="op-form" disabled={busy || (kind !== "deposit" && !memberId) || (aid && !category)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tt.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The month's ledger: who recorded what, what waits for a second person, what was cancelled and why */
export default function OperationsPanel({ group, role, userId, members, operations, onChange }: {
  group: TontineGroup; role: TontineRole; userId: string; members: TontineMemberRow[]; operations: TontineOperation[]; onChange: () => void;
}) {
  const { tt, dayName } = useTontineText();
  const leader = role === "admin" || role === "president";
  const phones = new Map(members.map((m) => [m.id, m.phone]));
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
      toast.error(e instanceof Error ? e.message : tt.actionError);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-3 p-4 md:p-6">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />{tt.newOp}</Button>
        </div>
        {operations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{tt.noOpsMonth}</p>
        ) : (
          <ul className="divide-y divide-border">
            {operations.map((o) => {
              const phone = o.member_id ? phones.get(o.member_id) : null;
              const receipt = o.kind === "contribution" && !o.cancelled_at && phone && o.member_name
                ? whatsappLink(phone, tt.receiptText(o.member_name, group.name, formatCFA(o.amount), dayName(o.op_date))) : null;
              return (
                <li key={o.id} className={cn("flex flex-wrap items-center gap-3 py-3", o.cancelled_at && "opacity-60")}>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className={cn("font-medium text-foreground", o.cancelled_at && "line-through")}>
                      {opLabel(tt, o.kind, group)}{o.member_name ? ` · ${o.member_name}` : ""}{o.category ? ` · ${tt.aids[o.category]}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dayName(o.op_date)} · {tt.methods[o.method]}
                      {o.source ? ` · ${o.source === "bank" ? tt.fromBank : tt.fromCash}` : ""}
                      {o.reference ? ` · ${tt.ref} ${o.reference}` : ""} · {tt.recordedBy} {o.recorded_by_name ?? "?"}
                      {o.validated_by_name ? ` · ${tt.validatedBy} ${o.validated_by_name}` : ""}
                    </p>
                    {o.note && <p className="text-xs text-muted-foreground">{o.note}</p>}
                    {o.cancelled_at && <p className="text-xs text-destructive">{tt.cancelled} : {o.cancel_reason}</p>}
                  </div>
                  <span className={cn("tabular-nums font-semibold", o.kind === "contribution" ? "text-success" : "text-foreground")}>
                    {o.kind === "contribution" ? "+" : "−"} {formatCFA(o.amount)}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {o.needs_validation && <Badge className="bg-highlight text-highlight-foreground">{tt.pending}</Badge>}
                    {receipt && (
                      <a href={receipt} target="_blank" rel="noopener noreferrer" aria-label={`${tt.receiptsTitle} · ${o.member_name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-success hover:bg-muted">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                    {o.document_id && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={tt.viewSlip}
                        onClick={() => tontineApi.openSlip(group.id, o.document_id!).catch((e) => toast.error(e.message))}>
                        <FileImage className="h-4 w-4" />
                      </Button>
                    )}
                    {o.needs_validation && o.recorded_by !== userId && (
                      <Button size="sm" variant="outline" className="h-8" disabled={busy === o.id}
                        onClick={() => act(o.id, () => tontineApi.validate(group.id, o.id), tt.validated)}>
                        <CheckCheck className="mr-1 h-4 w-4" />{tt.validate}
                      </Button>
                    )}
                    {!o.cancelled_at && (leader || (o.recorded_by === userId && !o.validated_at)) && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={tt.cancelOp} onClick={() => { setCancelling(o); setReason(""); }}>
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {adding && <OperationDialog group={group} members={members} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChange(); }} />}
      <Dialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tt.cancelTitle}</DialogTitle>
            <DialogDescription>{tt.cancelHelp}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder={tt.reason} aria-label={tt.reason} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>{tt.backBtn}</Button>
            <Button variant="destructive" disabled={reason.trim().length < 3 || busy === cancelling?.id}
              onClick={() => { const o = cancelling!; setCancelling(null); act(o.id, () => tontineApi.cancel(group.id, o.id, reason.trim()), tt.cancelledOk); }}>
              {tt.cancelOp}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
