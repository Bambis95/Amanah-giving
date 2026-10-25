import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BadgeCheck, Ban, Crown, ExternalLink, Loader2, MoreHorizontal, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { TontineAdminRow, tontineApi } from "@/api";
import { formatCFA, formatDate } from "./format";

const KINDS = { savings: "Épargne", rotating: "Natt tournante", mbootaay: "Mbootaay" } as const;
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR");

/**
 * Every tontine and mbootaay created on SENJAPO: Premium (activated after the payment received by
 * Wave / Orange Money), the "verified" badge (after checking the president's papers) and suspension.
 * Club president and admins; every action is sealed in the journal. Reports land in Santé du système.
 */
export default function AssociationsTab() {
  const [rows, setRows] = useState<TontineAdminRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [suspending, setSuspending] = useState<TontineAdminRow | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    tontineApi.all().then(setRows).catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));
  }, []);
  useEffect(load, [load]);

  const act = async (row: TontineAdminRow, action: () => Promise<unknown>, done: string) => {
    setBusy(row.id);
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => !q || [r.name, r.president_name, r.president_contact, r.created_by_name].some((v) => v?.toLowerCase().includes(q)));
  }, [rows, query]);

  if (!rows) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const premiumCount = rows.filter((r) => r.premium).length;

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground md:p-6">
          <p className="text-foreground">
            <strong>{rows.length}</strong> association(s), dont <strong>{premiumCount}</strong> en Premium
            ({formatCFA(rows[0]?.premium_price ?? 10000)} par mois, soit {formatCFA(premiumCount * (rows[0]?.premium_price ?? 10000))} par mois).
          </p>
          <p>
            Premium : activez-le après avoir reçu le paiement (Wave / Orange Money au numéro officiel). Badge « vérifiée » : après avoir vu la
            pièce d'identité de la présidence et un justificatif de l'association. Les signalements des membres arrivent dans Santé du système.
          </p>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une association, une présidente, un téléphone…" className="pl-9" aria-label="Rechercher" />
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucune association.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id}>
              <Card className="shadow-sm">
                <CardContent className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="font-semibold text-foreground">{r.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {KINDS[r.kind]} · {formatCFA(r.amount)} · {r.members} membre(s) · créée le {formatDate(r.created_at)}
                      {r.created_by_name ? ` par ${r.created_by_name}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">Présidence : {r.president_name ?? "?"}{r.president_contact ? ` · ${r.president_contact}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.premium ? (
                        <Badge className="gap-1 bg-highlight text-highlight-foreground"><Crown className="h-3 w-3" />Premium jusqu'au {day(r.premium_until!)}</Badge>
                      ) : (
                        <Badge variant="outline">Gratuit{r.premium_until ? ` (Premium fini le ${day(r.premium_until)})` : ""}</Badge>
                      )}
                      {r.verified
                        ? <Badge variant="outline" className="gap-1 border-success/50 text-success"><BadgeCheck className="h-3 w-3" />Vérifiée</Badge>
                        : <Badge variant="outline" className="gap-1 text-muted-foreground"><ShieldAlert className="h-3 w-3" />Non vérifiée</Badge>}
                      {r.suspended && <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" />Suspendue : {r.suspended_reason}</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button asChild variant="ghost" size="sm" className="h-8">
                      <Link to={`/tontines/${r.id}`}><ExternalLink className="mr-1 h-4 w-4" />Ouvrir</Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={busy === r.id} aria-label={`Actions pour ${r.name}`}>
                          {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuItem onClick={() => act(r, () => tontineApi.setPremium(r.id, 1), "Premium : 1 mois ajouté")}>
                          <Crown className="mr-2 h-4 w-4" />Premium + 1 mois
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => act(r, () => tontineApi.setPremium(r.id, 12), "Premium : 12 mois ajoutés")}>
                          <Crown className="mr-2 h-4 w-4" />Premium + 12 mois
                        </DropdownMenuItem>
                        {r.premium && (
                          <DropdownMenuItem onClick={() => act(r, () => tontineApi.setPremium(r.id, -1), "Premium arrêté")}>
                            <RotateCcw className="mr-2 h-4 w-4" />Arrêter le Premium
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={!r.premium && !r.verified}
                          onClick={() => act(r, () => tontineApi.verify(r.id, !r.verified), r.verified ? "Badge retiré" : "Association vérifiée")}>
                          <BadgeCheck className="mr-2 h-4 w-4" />{r.verified ? "Retirer le badge « vérifiée »" : "Marquer « vérifiée » (Premium)"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {r.suspended ? (
                          <DropdownMenuItem onClick={() => act(r, () => tontineApi.suspend(r.id, false), "Association rétablie")}>
                            <RotateCcw className="mr-2 h-4 w-4" />Rétablir l'association
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="text-destructive" onClick={() => { setSuspending(r); setReason(""); }}>
                            <Ban className="mr-2 h-4 w-4" />Suspendre…
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!suspending} onOpenChange={(o) => !o && setSuspending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Suspendre {suspending?.name} ?</DialogTitle>
            <DialogDescription>
              Plus aucune opération ne pourra être enregistrée. Les membres voient toujours leur compte et le motif. Vous pourrez la rétablir.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder="Motif (visible par les membres) : plaintes, vérification en cours…" aria-label="Motif" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspending(null)}>Annuler</Button>
            <Button variant="destructive" disabled={reason.trim().length < 5}
              onClick={() => { const r = suspending!; setSuspending(null); act(r, () => tontineApi.suspend(r.id, true, reason.trim()), "Association suspendue"); }}>
              Suspendre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
