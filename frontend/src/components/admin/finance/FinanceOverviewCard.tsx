import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ClipboardCheck, Landmark, Scale } from "lucide-react";
import { financeApi, FinanceSummary } from "@/api";
import { formatCFA } from "../format";
import { cn } from "@/lib/utils";

const YEAR = new Date().getFullYear();

/** Key figures of the accounts on the dashboard home, for the treasurer, the president and admins */
export default function FinanceOverviewCard({ onOpen }: { onOpen: () => void }) {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    financeApi
      .summary(YEAR)
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  const income = data ? data.donations.total + data.other_income : 0;
  const pending = data?.reconciliation.pending_count ?? 0;
  const figures = [
    { icon: ArrowUpRight, label: "Recettes", value: formatCFA(income), detail: "dons en ligne et autres recettes" },
    { icon: ArrowDownRight, label: "Dépenses", value: formatCFA(data?.expenses ?? 0), detail: "écritures validées" },
    {
      icon: Scale,
      label: "Solde",
      value: formatCFA(data?.balance ?? 0),
      detail: "recettes − dépenses",
      negative: (data?.balance ?? 0) < 0,
    },
    {
      icon: ClipboardCheck,
      label: "Dons à pointer",
      value: String(pending),
      detail: pending ? formatCFA(data?.reconciliation.pending_total ?? 0) : "tout est pointé",
      alert: pending > 0,
    },
  ];

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <Landmark className="h-4 w-4 text-primary" aria-hidden="true" />
            Finances {YEAR}
          </h3>
          <button type="button" onClick={onOpen} className="group flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Ouvrir les finances
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={!data}>
          {figures.map((f) => (
            <div
              key={f.label}
              className={cn("rounded-xl border p-3", f.alert ? "border-highlight/40 bg-highlight/10" : "border-border bg-muted/30")}
            >
              <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <f.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {f.label}
              </p>
              <p className={cn("truncate text-lg font-bold tabular-nums", f.negative ? "text-destructive" : "text-foreground")}>
                {data ? f.value : "…"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{data ? f.detail : ""}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
