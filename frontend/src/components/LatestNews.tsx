import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Newspaper } from "lucide-react";
import { CampaignNews, getCampaignNews } from "@/api";
import { dateLocale, useI18n } from "@/i18n";

/** Home page: the latest campaign news (hidden until there is at least one) */
export default function LatestNews() {
  const [items, setItems] = useState<CampaignNews[]>([]);
  const { lang, t: dict } = useI18n();
  const t = dict.news;
  const dateFormat = new Intl.DateTimeFormat(dateLocale(lang), { dateStyle: "long" });

  useEffect(() => {
    getCampaignNews(3)
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="px-4 pb-16 sm:pb-20" aria-labelledby="latest-news">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-highlight">
              <Newspaper className="h-4 w-4" aria-hidden="true" />
              {t.badge}
            </p>
            <h2 id="latest-news" className="text-2xl font-bold text-foreground sm:text-3xl">{t.title}</h2>
          </div>
          <Link to="/projects" className="group flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            {t.all}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((n) => (
            <Card key={n.id} className="overflow-hidden shadow-sm">
              {n.image && <img src={n.image} alt="" loading="lazy" className="h-44 w-full object-cover" />}
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">
                  <time dateTime={n.published_at}>{dateFormat.format(new Date(n.published_at))}</time>
                  {n.project_title && <> · {n.project_title}</>}
                </p>
                <h3 dir="auto" className="mt-1 font-semibold text-foreground">{n.title}</h3>
                <p dir="auto" className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{n.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
