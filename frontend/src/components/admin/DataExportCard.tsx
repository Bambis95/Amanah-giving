import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatabaseBackup, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadDataExport } from "@/api";

/** Full backup of the platform's data, for safekeeping or a hand-over (administrators only) */
export default function DataExportCard() {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await downloadDataExport();
      toast.success("Export téléchargé. Conservez-le en lieu sûr : il contient des données personnelles.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-6">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <DatabaseBackup className="h-4 w-4 text-primary" aria-hidden="true" />
            Sauvegarde des données
          </h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            Un fichier ZIP avec les campagnes, dons, comptes, finances, abonnés, messages et le journal (fichiers CSV lisibles dans Excel), plus
            les photos et justificatifs. Les mots de passe et codes de sécurité n'y figurent jamais. Le téléchargement est inscrit au journal.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={download} disabled={busy} className="h-11 shrink-0">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Télécharger toutes les données
        </Button>
      </CardContent>
    </Card>
  );
}
