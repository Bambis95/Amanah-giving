import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { tontineApi, TontineMethod } from "@/api";
import { formatCFA } from "@/components/admin/format";
import { METHOD_LABELS, todayIso } from "./labels";

/** The treasurer's daily round: tick who paid today, one tap saves them all */
export default function DaySheet({ groupId, onSaved }: { groupId: number; onSaved: () => void }) {
  const [day, setDay] = useState(todayIso());
  const [method, setMethod] = useState<TontineMethod>("cash");
  const [sheet, setSheet] = useState<Awaited<ReturnType<typeof tontineApi.daySheet>> | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setSheet(null);
    setTicked(new Set());
    tontineApi.daySheet(groupId, day).then(setSheet).catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));
  }, [groupId, day]);
  useEffect(load, [load]);

  const unpaid = sheet?.members.filter((m) => !m.paid) ?? [];
  const toggle = (id: number) => setTicked((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const save = async () => {
    setBusy(true);
    try {
      const { added } = await tontineApi.recordDay(groupId, day, method, [...ticked]);
      toast.success(`${added} cotisation(s) enregistrée(s)`);
      load();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="day">Jour</Label>
            <Input id="day" type="date" max={todayIso()} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Payé en</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as TontineMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(METHOD_LABELS) as TontineMethod[]).filter((m) => m !== "bank_transfer").map((m) => (
                  <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!sheet ? (
          <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-primary" />
        ) : sheet.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun membre actif ce jour-là.</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {sheet.members.length - unpaid.length} / {sheet.members.length} ont payé · {formatCFA(sheet.amount)} chacun
              </span>
              {unpaid.length > 0 && (
                <Button type="button" variant="link" className="h-auto p-0" onClick={() => setTicked(new Set(unpaid.map((m) => m.id)))}>
                  Tout cocher
                </Button>
              )}
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {sheet.members.map((m) => (
                <li key={m.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                    {m.paid ? (
                      <CheckCircle2 className="h-5 w-5 text-success" aria-label="Déjà payé" />
                    ) : (
                      <Checkbox checked={ticked.has(m.id)} onCheckedChange={() => toggle(m.id)} aria-label={`${m.name} a payé`} />
                    )}
                    <span className="flex-1 text-foreground">{m.name}</span>
                    {m.paid ? <span className="text-sm text-success">{formatCFA(m.paid)}</span> : null}
                  </label>
                </li>
              ))}
            </ul>
            <Button className="h-11 w-full" disabled={busy || ticked.size === 0} onClick={save}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer {ticked.size > 0 ? `${ticked.size} cotisation(s) · ${formatCFA(ticked.size * sheet.amount)}` : ""}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
