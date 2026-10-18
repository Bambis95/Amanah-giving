import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { AlertTriangle, CircleDot, HeartHandshake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { donationSwitchApi, DonationSwitchState } from "@/api";
import { formatDate } from "./format";
import { cn } from "@/lib/utils";

/**
 * Opens or closes online donations at once, without going through Render. Closing always works (emergency);
 * opening needs the payment provider in production with its keys. Every change is emailed to all admins.
 */
export default function DonationSwitchCard({ canSwitch }: { canSwitch: boolean }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<DonationSwitchState | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    donationSwitchApi.get().then(setState).catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));
  }, []);
  useEffect(load, [load]);

  if (!state) return null;
  const next = !state.open;

  const apply = async () => {
    setBusy(true);
    try {
      const updated = await donationSwitchApi.set(next, reason.trim());
      setState(updated);
      setConfirm(false);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["site-status"] });
      toast.success(updated.open ? "Les dons en ligne sont ouverts" : "Les dons en ligne sont fermés");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Changement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cn("border-l-4 shadow-sm", state.open ? "border-l-success" : "border-l-warning")}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-6">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <HeartHandshake className="h-4 w-4 text-primary" aria-hidden="true" />
            Dons en ligne
            <span className={cn("ml-1 flex items-center gap-1 text-sm font-medium", state.open ? "text-success" : "text-warning")}>
              <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
              {state.open ? "Ouverts" : "Fermés"}
            </span>
          </h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            {state.open
              ? `Les visiteurs peuvent donner en ligne (${state.provider}, mode ${state.mode}).`
              : "La page Faire un don affiche « Les dons en ligne arrivent bientôt ». Les paiements déjà commencés sont tout de même confirmés."}
          </p>
          <p className="text-xs text-muted-foreground">
            {state.source === "admin"
              ? `Changé le ${formatDate(state.changed_at)} par ${state.changed_by ?? "?"}${state.reason ? ` : ${state.reason}` : ""}.`
              : "Réglé pour l'instant par DONATIONS_ENABLED dans Render ; ce bouton le remplace dès qu'il est utilisé."}
          </p>
          {!state.open && !state.can_open && (
            <ul className="mt-2 space-y-1 text-xs text-warning">
              {state.blockers.map((b) => (
                <li key={b} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
        {canSwitch && (
          <Button
            type="button"
            variant={state.open ? "outline" : "default"}
            className="h-11 shrink-0"
            disabled={busy || (!state.open && !state.can_open)}
            onClick={() => setConfirm(true)}
          >
            {state.open ? "Fermer les dons" : "Ouvrir les dons"}
          </Button>
        )}
      </CardContent>

      <AlertDialog open={confirm} onOpenChange={(open) => !busy && setConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{next ? "Ouvrir les dons en ligne ?" : "Fermer les dons en ligne ?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {next
                ? `Les visiteurs pourront donner tout de suite par ${state.provider}. Faites ensuite un vrai petit don (500 FCFA) pour vérifier.`
                : "Plus aucun nouveau don en ligne ne sera possible jusqu'à la réouverture. Les QR codes Wave / Orange Money restent affichés."}{" "}
              Tous les administrateurs sont prévenus par email et le changement est inscrit au Journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder={next ? "Motif (facultatif) : lancement officiel…" : "Motif (facultatif) : panne chez PayTech…"}
            aria-label="Motif"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); apply(); }} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {next ? "Ouvrir les dons" : "Fermer les dons"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
