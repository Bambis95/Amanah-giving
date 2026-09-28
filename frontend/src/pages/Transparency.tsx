import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Eye, FolderOpen, Heart, TrendingUp, Users } from "lucide-react";
import { api, Project } from "@/api";
import { formatAmount, formatNumber, plural, usePublicStats } from "@/hooks/use-public-stats";
import { categoryLabel } from "@/lib/categories";
import { BRAND_SHORT } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { softTone, Tone } from "@/lib/tones";

const statusLabels: Record<string, string> = { active: "En cours", completed: "Terminé" };

// Public accountability page: platform totals and, for each public project, collected vs goal
export default function TransparencyPage() {
  const { stats, failed } = usePublicStats();
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    api
      .getProjects()
      .then((res) => setProjects(res.items.filter((p) => p.status !== "paused")))
      .catch(() => setProjects([]));
  }, []);

  const figures: { icon: React.ElementType; value: string; label: string; tone: Tone }[] = [
    { icon: Heart, value: `${formatAmount(stats?.total_raised ?? 0)} FCFA`, label: "Collectés en ligne", tone: "highlight" },
    { icon: Users, value: formatNumber(stats?.donors ?? 0), label: plural(stats?.donors ?? 0, "Donateur", "Donateurs"), tone: "primary" },
    { icon: FolderOpen, value: formatNumber(stats?.active_projects ?? 0), label: plural(stats?.active_projects ?? 0, "Projet en cours", "Projets en cours"), tone: "info" },
    { icon: TrendingUp, value: formatNumber(stats?.funded_projects ?? 0), label: plural(stats?.funded_projects ?? 0, "Projet financé", "Projets financés"), tone: "destructive" },
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
            chaque projet soutenu par la {BRAND_SHORT}.
          </p>
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
          <h2 className="mb-2 text-2xl font-bold text-foreground">Avancement des projets</h2>
          <p className="mb-6 text-muted-foreground">
            Montant collecté par rapport à l'objectif de chaque projet, mis à jour à chaque don confirmé.
          </p>

          {projects === null ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted/60" aria-busy="true" />
          ) : projects.length === 0 ? (
            <p className="rounded-xl bg-muted/60 p-6 text-center text-muted-foreground">Aucun projet publié pour le moment.</p>
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
              <li>Chaque don est affecté au projet ou à la cause choisis par le donateur ; les dons généraux sont répartis par le club selon les besoins.</li>
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
