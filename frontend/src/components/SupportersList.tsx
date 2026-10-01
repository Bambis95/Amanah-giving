import { useEffect, useState } from "react";
import { HandHeart } from "lucide-react";
import { getSupporters, Supporter } from "@/api";
import { dateLocale, useI18n } from "@/i18n";

const formatCFA = (amount: number) => new Intl.NumberFormat("fr-FR").format(amount);

/** "3 days ago" in the current language */
function ago(iso: string | null, locale: string): string {
  if (!iso) return "";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutes > -60) return rtf.format(Math.min(minutes, 0), "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (days > -30) return rtf.format(days, "day");
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
}

/** Latest supporters of a campaign (inside its dialog): names only for donors who chose to appear */
export default function SupportersList({ projectId }: { projectId: number }) {
  const { lang, t: dict } = useI18n();
  const t = dict.supporters;
  const [data, setData] = useState<{ total: number; items: Supporter[] } | null>(null);

  useEffect(() => {
    getSupporters(projectId)
      .then(setData)
      .catch(() => setData(null));
  }, [projectId]);

  if (!data) return null;
  const locale = dateLocale(lang);

  return (
    <section aria-labelledby={`supporters-${projectId}`} className="border-t border-border pt-4">
      <h3 id={`supporters-${projectId}`} className="mb-3 flex items-center justify-between gap-2 font-semibold text-foreground">
        <span className="flex items-center gap-2">
          <HandHeart className="h-4 w-4 text-primary" aria-hidden="true" />
          {t.title}
        </span>
        {data.total > 0 && <span className="text-sm font-normal text-muted-foreground">{t.count(data.total)}</span>}
      </h3>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.first}</p>
      ) : (
        <ul className="space-y-2">
          {data.items.map((s, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-foreground">{s.name ?? t.anonymous}</span>{" "}
                <span className="text-muted-foreground">{s.amount !== null ? t.gave(formatCFA(s.amount)) : t.donated}</span>
              </span>
              <time dateTime={s.created_at ?? undefined} className="shrink-0 text-xs text-muted-foreground">
                {ago(s.created_at, locale)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
