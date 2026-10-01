import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { CampaignNews, getCampaignNews } from "@/api";
import { dateLocale, useI18n } from "@/i18n";

/** News of one campaign, newest first, as a small timeline (inside the campaign dialog) */
export default function CampaignNewsList({ projectId }: { projectId: number }) {
  const [items, setItems] = useState<CampaignNews[]>([]);
  const { lang, t } = useI18n();
  const dateFormat = new Intl.DateTimeFormat(dateLocale(lang), { dateStyle: "long" });

  useEffect(() => {
    getCampaignNews(20, projectId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [projectId]);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby={`news-${projectId}`} className="border-t border-border pt-4">
      <h3 id={`news-${projectId}`} className="mb-3 flex items-center gap-2 font-semibold text-foreground">
        <Newspaper className="h-4 w-4 text-primary" aria-hidden="true" />
        {t.news.campaign}
      </h3>
      <ol className="space-y-4 border-l-2 border-accent pl-4">
        {items.map((n) => (
          <li key={n.id} className="relative">
            <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
            <time dateTime={n.published_at} className="text-xs text-muted-foreground">{dateFormat.format(new Date(n.published_at))}</time>
            <p dir="auto" className="font-medium text-foreground">{n.title}</p>
            {n.image && <img src={n.image} alt="" loading="lazy" className="my-2 max-h-56 w-full rounded-lg object-cover" />}
            <p dir="auto" className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">{n.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
