import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Eye, FolderOpen, Heart, TrendingUp, Users } from "lucide-react";
import { api, getPublicSpending, Project, PublicSpending } from "@/api";
import { formatAmount, formatNumber, plural, usePublicStats } from "@/hooks/use-public-stats";
import { categoryLabel } from "@/lib/categories";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { softTone, Tone } from "@/lib/tones";
import { useSiteStatus } from "@/hooks/use-site-status";

const statusLabels: Record<string, string> = { active: "En cours", completed: "Terminé" };

// Public accountability page: platform totals and, for each public project, collected vs goal
export default function TransparencyPage() {
  const { stats, failed } = usePublicStats();
  const { platformFee } = useSiteStatus();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [spending, setSpending] = useState<PublicSpending | null>(null);

  useEffect(() => {
    api
      .getProjects()
      .then((res) => setProjects(res.items.filter((p) => p.status !== "paused")))
      .catch(() => setProjects([]));
    getPublicSpending()
      .then(setSpending)
      .catch(() => setSpending(null));
  }, []);

  const spendingOf = (id: number) => spending?.projects.find((s) => s.project_id === id);
  const spentCategories = Object.entries(spending?.by_category ?? {});
  const maxCategory = Math.max(1, ...spentCategories.map(([, v]) => v));

  const figures: { icon: React.ElementType; value: string; label: string; tone: Tone }[] = [
    { icon: Heart, value: `${formatAmount(stats?.total_raised ?? 0)} FCFA`, label: "Collectés en ligne", tone: "highlight" },
    { icon: Users, value: formatNumber(stats?.donors ?? 0), label: plural(stats?.donors ?? 0, "Donateur", "Donateurs"), tone: "primary" },
    { icon: FolderOpen, value: formatNumber(stats?.active_projects ?? 0), label: plural(stats?.active_projects ?? 0, "Campagne en cours", "Campagnes en cours"), tone: "info" },
    { icon: TrendingUp, value: formatNumber(stats?.funded_projects ?? 0), label: plural(stats?.funded_projects ?? 0, "Campagne financée", "Campagnes financées"), tone: "destructive" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="surface-brand px-4 pb-16 pt-24 sm:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold">
            <Eye className="h-4 w-4" aria-hidden="true" />
            Transparence
          </span>
          <h1 className="mb-4 text-3xl font-bold md:text-4xl">Où Vont les Dons ?</h1>
          <p className="mx-auto max-w-2xl text-white/80">
            La confiance se mérite. Voici, en temps réel, les montants collectés sur la plateforme et l'avancement de
            chaque campagne publiée sur {BRAND_NAME}.
          </p>
          {platformFee && (
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70">
              Frais de plateforme : {platformFee} % de chaque don finance le développement, l'hébergement et la maintenance
              de {BRAND_NAME} ; le reste va à la campagne choisie.
            </p>
          )}
        </div>
      </section>

      {!failed && (
        <section className="relative z-10 mx-auto -mt-8 max-w-6xl px-4" aria-label="Chiffres clés">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {figures.map((f) => (
              <Card key={f.label} className="shadow-sm">
                <CardContent className="p-4 text-center sm:p-6">
                  <div className={cn("mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl", softTone[f.tone])}>
                    <f.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">{stats ? f.value : "…"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          {spending && spending.total_spent > 0 && (
            <div className="mb-12">
              <h2 className="mb-2 text-2xl font-bold text-foreground">Utilisation des fonds</h2>
              <p className="mb-6 text-muted-foreground">
                <strong className="text-foreground">{formatNumber(spending.total_spent)} FCFA</strong> déjà dépensés pour les
                campagnes, justificatifs à l'appui, répartis ainsi :
              </p>
              <Card className="shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <ul className="space-y-3">
                    {spentCategories.map(([label, amount]) => (
                      <li key={label}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="text-foreground">{label}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatNumber(amount)} FCFA · {Math.round((amount / spending.total_spent) * 100)} %
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (amount / maxCategory) * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          <h2 className="mb-2 text-2xl font-bold text-foreground">Avancement des campagnes</h2>
          <p className="mb-6 text-muted-foreground">
            Montant collecté par rapport à l'objectif de chaque campagne, mis à jour à chaque don confirmé.
          </p>

          {projects === null ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted/60" aria-busy="true" />
          ) : projects.length === 0 ? (
            <p className="rounded-xl bg-muted/60 p-6 text-center text-muted-foreground">Aucune campagne publiée pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => {
                const pct = p.goal > 0 ? Math.round((p.raised / p.goal) * 100) : 0;
                return (
                  <Card key={p.id} className="shadow-sm">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                        <h3 className="font-semibold text-foreground">{p.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {[categoryLabel(p.category), p.location, statusLabels[p.status ?? "active"]].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div
                        className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={Math.min(pct, 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${p.title} : ${pct} % de l'objectif`}
                      >
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm tabular-nums">
                        <span className="text-foreground/80">
                          <strong className="text-foreground">{formatNumber(p.raised)} FCFA</strong> sur {formatNumber(p.goal)} FCFA
                        </span>
                        <span className="text-muted-foreground">
                          {pct} % · {formatNumber(p.donors ?? 0)} {plural(p.donors ?? 0, "donateur", "donateurs")}
                        </span>
                      </div>
                      {(() => {
                        const s = spendingOf(p.id);
                        if (!s || (!s.spent && !s.other_income && !s.budget)) return null;
                        const categories = Object.entries(s.by_category);
                        return (
                          <div className="mt-3 border-t border-border pt-3 text-sm">
                            <p className="text-foreground/80">
                              <strong className="text-foreground">{formatNumber(s.spent)} FCFA dépensés</strong>
                              {s.budget > 0 && <> sur un budget de {formatNumber(s.budget)} FCFA</>}
                              {s.other_income > 0 && <> · {formatNumber(s.other_income)} FCFA d'autres financements</>}
                            </p>
                            {categories.length > 0 && (
                              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Dépenses par catégorie">
                                {categories.map(([label, amount]) => (
                                  <li key={label} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/80">
                                    {label} : <span className="tabular-nums">{formatNumber(amount)} FCFA</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-10 rounded-xl border border-border p-6 text-sm leading-relaxed text-muted-foreground">
            <h2 className="mb-2 text-base font-semibold text-foreground">Nos règles</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Seuls les paiements confirmés par nos prestataires (Wave, Orange Money, carte) sont comptés.</li>
              <li>Chaque campagne est vérifiée et validée avant sa publication.</li>
              <li>Chaque dépense est enregistrée par la trésorerie avec son justificatif, et publiée ici par grande catégorie.</li>
              <li>Chaque don est affecté à la campagne ou à la cause choisie par le contributeur ; les dons généraux sont répartis selon les besoins.</li>
              <li>
                Les règles complètes figurent dans nos <Link to="/conditions" className="text-primary hover:underline">conditions d'utilisation</Link>.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
