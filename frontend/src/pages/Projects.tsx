import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProjectCard from "@/components/ProjectCard";
import {
  GraduationCap,
  Stethoscope,
  Droplets,
  UtensilsCrossed,
  Home,
  Filter,
} from "lucide-react";
import { api, Project } from "@/api";

type Category = "all" | "education" | "health" | "water" | "food" | "housing";

const categories: { value: Category; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "Tous", icon: Filter },
  { value: "education", label: "Éducation", icon: GraduationCap },
  { value: "health", label: "Santé", icon: Stethoscope },
  { value: "water", label: "Eau", icon: Droplets },
  { value: "food", label: "Alimentation", icon: UtensilsCrossed },
  { value: "housing", label: "Logement", icon: Home },
];

export default function ProjectsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
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
            {total} Projets Actifs
          </span>
          <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Nos Projets & Causes</h1>
          <p className="mx-auto max-w-xl text-white/75">
            Découvrez tous nos projets en cours et choisissez celui qui vous inspire le plus.
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
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8" aria-busy="true" aria-label="Chargement des projets">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[26rem] animate-pulse rounded-xl border border-border bg-muted/60" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">Aucun projet trouvé dans cette catégorie.</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}