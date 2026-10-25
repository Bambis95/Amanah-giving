import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { tontineApi, TontineMethod } from "@/api";
import { formatCFA } from "@/components/admin/format";
import { useTontineText } from "@/i18n/tontine";
import { todayIso, whatsappLink } from "./labels";

type Sheet = Awaited<ReturnType<typeof tontineApi.daySheet>>;
const METHODS: TontineMethod[] = ["cash", "wave", "orange_money", "free_money"];

/** The treasurer's daily round: tick who paid, one tap saves them all, then WhatsApp receipts */
export default function DaySheet({ groupId, groupName, onSaved }: { groupId: number; groupName: string; onSaved: () => void }) {
  const { tt, dayName } = useTontineText();
  const [day, setDay] = useState(todayIso());
  const [method, setMethod] = useState<TontineMethod>("cash");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [justPaid, setJustPaid] = useState<Sheet["members"]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setSheet(null);
    setTicked(new Set());
    tontineApi.daySheet(groupId, day).then(setSheet).catch((e) => toast.error(e instanceof Error ? e.message : tt.loadError));
  }, [groupId, day, tt.loadError]);
  useEffect(load, [load]);

  const unpaid = sheet?.members.filter((m) => !m.paid) ?? [];
  const toggle = (id: number) => setTicked((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const save = async () => {
    if (!sheet) return;
    setBusy(true);
    try {
      const { added, receipts } = await tontineApi.recordDay(groupId, day, method, [...ticked]);
      toast.success(tt.savedDay(added, receipts));
      setJustPaid(sheet.members.filter((m) => ticked.has(m.id) && m.phone));
      load();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tt.actionError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="day">{tt.day}</Label>
              <Input id="day" type="date" max={todayIso()} value={day} onChange={(e) => { if (e.target.value) { setDay(e.target.value); setJustPaid([]); } }} />
            </div>
            <div className="space-y-1.5">
              <Label>{tt.paidWith}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as TontineMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{tt.methods[m]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {!sheet ? (
            <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-primary" />
          ) : sheet.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tt.noneActive}</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{tt.paidCount(sheet.members.length - unpaid.length, sheet.members.length, formatCFA(sheet.amount))}</span>
                {unpaid.length > 0 && (
                  <Button type="button" variant="link" className="h-auto p-0" onClick={() => setTicked(new Set(unpaid.map((m) => m.id)))}>{tt.tickAll}</Button>
                )}
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {sheet.members.map((m) => (
                  <li key={m.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                      {m.paid ? (
                        <CheckCircle2 className="h-5 w-5 text-success" aria-label={tt.alreadyPaid} />
                      ) : (
                        <Checkbox checked={ticked.has(m.id)} onCheckedChange={() => toggle(m.id)} aria-label={tt.hasPaid(m.name)} />
                      )}
                      <span className="flex-1 text-foreground">{m.name}</span>
                      {m.paid ? <span className="text-sm text-success">{formatCFA(m.paid)}</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
              <Button className="h-11 w-full" disabled={busy || ticked.size === 0} onClick={save}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tt.saveDay(ticked.size, formatCFA(ticked.size * sheet.amount))}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {justPaid.length > 0 && sheet && (
        <Card className="border-l-4 border-l-success shadow-sm">
          <CardContent className="space-y-3 p-4 md:p-6">
            <h3 className="flex items-center gap-2 font-semibold text-foreground"><MessageCircle className="h-4 w-4 text-success" aria-hidden="true" />{tt.receiptsTitle}</h3>
            <p className="text-xs text-muted-foreground">{tt.receiptsHelp}</p>
            <ul className="divide-y divide-border">
              {justPaid.map((m) => {
                const link = whatsappLink(m.phone!, tt.receiptText(m.name, groupName, formatCFA(sheet.amount), dayName(day)));
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-foreground">{m.name}</span>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-sm font-medium text-success-foreground">
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />{tt.sendWhatsApp}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
