import { useEffect, useState } from "react";
import { api, PublicStats } from "@/api";

export const formatNumber = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

// Millions read better compacted ("1,2 M"); smaller amounts stay exact. Callers add the unit.
export function formatAmount(amount: number) {
  if (amount < 1_000_000) return formatNumber(amount);
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

// French: 0 and 1 take the singular ("0 donateur", "1 donateur")
export const plural = (count: number, singular: string, pluralForm: string) =>
  count <= 1 ? singular : pluralForm;

/** Real platform figures; `failed` lets pages hide them rather than show wrong numbers. */
export function usePublicStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch((error) => {
        console.error("Failed to fetch stats:", error);
        setFailed(true);
      });
  }, []);

  return { stats, failed };
}
