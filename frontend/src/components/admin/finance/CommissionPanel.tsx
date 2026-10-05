import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Loader2, Percent } from "lucide-react";
import { toast } from "sonner";
import { commissionApi, CommissionStatement } from "@/api";
import { formatCFA } from "../format";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
};
const frDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR");

/**
 * The provider's agreed share of the donations: what is owed month by month (each donation at the rate
 * of its day), what the client has paid (expenses "Commission de la plateforme"), and the balance.
 * President and admins see everything; only admins set the rate, which applies from today on.
 */
export default function CommissionPanel({ year, canSet }: { year: number | null; canSet: boolean }) {
  const [data, setData] = useState<CommissionStatement | null>(null);
  const [percent, setPercent] = useState("");
  const [payee, setPayee] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    commissionApi
      .get(year)
      .then((d) => {
        setData(d);
        setPercent(d.percent === "0" ? "" : d.percent);
        setPayee(d.payee);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));
  }, [year]);

  useEffect(load, [load]);

  const save = async () => {
    setConfirm(false);
    setBusy(true);
    try {
      await commissionApi.setRate(percent.replace(",", ".") || "0", payee.trim());
      toast.success("Taux enregistré : il s'applique aux dons à partir d'aujourd'hui");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      await commissionApi.downloadStatement(year);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Relevé indisponible");
    }
  };

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const period = year ? `en ${year}` : "depuis le lancement";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: `Commission due ${period}`, value: data.owed },
          { label: "Déjà réglé", value: data.paid },
          { label: "Reste à régler", value: data.balance, strong: true },
        ].map((k) => (
          <Card key={k.label} className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${k.strong ? "text-primary" : "text-foreground"}`}>{formatCFA(k.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-foreground">
                <Percent className="h-4 w-4 text-primary" aria-hidden="true" />
                Taux convenu : {data.percent} %{data.payee && <span className="font-normal text-muted-foreground"> · {data.payee}</span>}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Calculé sur chaque don payé (en ligne et dépôts Wave / Orange Money confirmés), hors cotisations, au taux en
                vigueur le jour du don. Le taux est affiché aux donateurs ; chaque changement est inscrit au Journal et
                envoyé par email aux administrateurs. Un règlement se saisit dans Recettes & dépenses, catégorie
                « Commission de la plateforme ».
              </p>
              {data.history.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Historique : {data.history.map((h) => `${h.percent} % depuis le ${frDate(h.since)}`).join(" · ")}
                </p>
              )}
            </div>
            <Button variant="outline" onClick={download} className="shrink-0">
              <FileDown className="mr-2 h-4 w-4" />
              Relevé PDF
            </Button>
          </div>

          {canSet && (
            <form
              className="grid gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                setConfirm(true);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="commission-rate">Taux (%)</Label>
                <Input id="commission-rate" inputMode="decimal" placeholder="ex. 5" value={percent} onChange={(e) => setPercent(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commission-payee">Bénéficiaire (tel qu'il figure au contrat)</Label>
                <Input id="commission-payee" maxLength={120} placeholder="ex. Khadim BA" value={payee} onChange={(e) => setPayee(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4 md:p-6">
          <h3 className="mb-3 font-semibold text-foreground">Détail par mois</h3>
          {data.months.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun don payé {period}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">Dons</TableHead>
                  <TableHead className="text-right">Montant collecté</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.months.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="capitalize">{monthLabel(m.month)}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.donations}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCFA(m.collected)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCFA(m.owed)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Commission à {percent || "0"} % à partir d'aujourd'hui ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les dons déjà reçus gardent leur taux. Le nouveau taux est affiché aux donateurs, inscrit au Journal et
              annoncé par email à tous les administrateurs. Il doit correspondre au contrat signé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={save}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
