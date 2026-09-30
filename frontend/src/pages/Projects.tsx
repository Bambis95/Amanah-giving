import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProjectCard from "@/components/ProjectCard";
import { useSearchParams } from "react-router-dom";
import { Filter, MapPin, X } from "lucide-react";
import { api, Project } from "@/api";
import { CATEGORIES } from "@/lib/categories";
import { REGIONS, regionOf } from "@/lib/regions";
import { cn } from "@/lib/utils";

const categories: { value: string; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "Tous", icon: Filter },
  ...CATEGORIES,
];

export default function ProjectsPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [projects, setProjects] = useState<Project[]>([]);
  // Region filter lives in the URL, so a link such as /projects?region=Thiès can be shared
  const [params, setParams] = useSearchParams();
  const activeRegion = REGIONS.find((r) => r === params.get("region")) ?? null;
  const setRegion = (region: string | null) => {
    const next = new URLSearchParams(params);
    if (region) next.set("region", region);
    else next.delete("region");
    setParams(next, { replace: true });
  };
  const countByRegion = new Map<string, number>();
  for (const p of projects) {
    const r = regionOf(p.location);
    if (r) countByRegion.set(r, (countByRegion.get(r) ?? 0) + 1);
  }
  const visible = activeRegion ? projects.filter((p) => regionOf(p.location) === activeRegion) : projects;
  // A shared link (/projects?campagne=ID, from the WhatsApp preview) opens that campaign
  const sharedId = Number(params.get("campagne")) || null;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading && sharedId) document.getElementById(`campagne-${sharedId}`)?.scrollIntoView({ block: "center" });
  }, [loading, sharedId]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      try {
        const response = await api.getProjects(activeCategory);
        // Paused projects are hidden from the public site
        setProjects(response.items.filter((p) => p.status !== "paused"));
        setTotal(response.items.filter((p) => !p.status || p.status === "active").length);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [activeCategory]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="surface-hero px-4 pb-12 pt-24 sm:pt-28">
        <div className="mx-auto max-w-6xl text-center">
          <span className="mb-4 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold">
            {total} {total > 1 ? "Campagnes actives" : "Campagne active"}
          </span>
          <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Nos Campagnes</h1>
          <p className="mx-auto max-w-xl text-white/75">
            Des campagnes vérifiées et validées, partout au Sénégal : choisissez celle qui vous inspire le plus.
          </p>
        </div>
      </section>

      {/* Filters: sticky under the header, horizontally scrollable on small screens */}
      <section className="sticky top-16 z-30 border-b border-border bg-background/85 px-4 py-4 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl">
          <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filtrer par catégorie">
            {categories.map((cat) => {
              const active = activeCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setActiveCategory(cat.value)}
                  aria-pressed={active}
                  className={`flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-foreground/80 hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  <cat.icon className="h-4 w-4" aria-hidden="true" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Projects grid */}
      <section className="px-4 py-10 sm:py-12">
        <div className="mx-auto max-w-6xl">
          {/* Projects by region: the count per region, a click filters the list */}
          <div className="mb-10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                Campagnes par région
              </h2>
              {activeRegion && (
                <button type="button" onClick={() => setRegion(null)} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  <X className="h-4 w-4" aria-hidden="true" />
                  Toutes les régions
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" role="group" aria-label="Filtrer par région">
              {REGIONS.map((region) => {
                const count = countByRegion.get(region) ?? 0;
                const active = activeRegion === region;
                return (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setRegion(active ? null : region)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : count > 0
                          ? "border-border bg-card text-foreground hover:border-primary/50"
                          : "border-border/60 bg-muted/40 text-muted-foreground hover:border-border"
                    )}
                  >
                    <span className="truncate font-medium">{region}</span>
                    <span className={cn("shrink-0 tabular-nums", active ? "text-primary-foreground" : count > 0 ? "font-semibold text-primary" : "")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8" aria-busy="true" aria-label="Chargement des projets">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[26rem] animate-pulse rounded-xl border border-border bg-muted/60" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {visible.map((project) => (
                <ProjectCard key={project.id} project={project} autoOpen={project.id === sharedId} />
              ))}
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">
                {activeRegion
                  ? `Aucune campagne pour le moment dans la région de ${activeRegion}.`
                  : "Aucune campagne pour cette cause pour le moment."}
              </p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}