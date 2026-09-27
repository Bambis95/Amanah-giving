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
  Loader2,
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
    <div className="min-h-screen bg-[#FAFAF8]">
      <Navbar />

      {/* Header */}
      <section className="pt-24 pb-12 px-4 bg-gradient-to-br from-[#1A1A2E] to-[#2D2D4E] text-white">
        <div className="max-w-6xl mx-auto text-center">
          <span className="inline-block bg-white/10 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-4 border border-white/20">
            {total} Projets Actifs
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Nos Projets & Causes</h1>
          <p className="text-white/70 max-w-xl mx-auto">
            Découvrez tous nos projets en cours et choisissez celui qui vous inspire le plus.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-6 px-4 border-b bg-white sticky top-16 z-30">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.value
                    ? "bg-[#0D7C66] text-white shadow-md"
                    : "bg-gray-100 text-[#374151] hover:bg-gray-200"
                }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#0D7C66] animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="text-center py-20">
              <p className="text-[#6B7280] text-lg">Aucun projet trouvé dans cette catégorie.</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}