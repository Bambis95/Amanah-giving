import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { financeApi, Project } from "@/api";

const ALL = "all";

/** Financial report (PDF) for partners and authorities: one campaign or the whole platform */
export default function ReportCard({ year, projects }: { year: number | null; projects: Project[] }) {
  const [scope, setScope] = useState(ALL);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await financeApi.downloadReport(scope === ALL ? null : Number(scope), year);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rapport indisponible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-foreground">Rapport financier (PDF)</p>
          <p className="text-muted-foreground">
            Recettes, dépenses détaillées, budget et signatures : à remettre aux partenaires ou à la mairie
            {year ? ` (année ${year})` : ""}.
          </p>
        </div>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="sm:w-64" aria-label="Campagne du rapport"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toute la plateforme</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={download} disabled={busy} className="shrink-0">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
          Télécharger
        </Button>
      </CardContent>
    </Card>
  );
}
