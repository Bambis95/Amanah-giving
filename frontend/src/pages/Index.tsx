import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProjectCard from "@/components/ProjectCard";
import { api, Project, PublicStats } from "@/api";
import { formatAmount, formatNumber, plural, usePublicStats } from "@/hooks/use-public-stats";
import {
  Heart,
  Users,
  FolderOpen,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

const HERO_IMG = "https://mgx-backend-cdn.metadl.com/generate/images/983496/2026-02-22/20fb421b-e0e3-4aa9-a282-e7aa1dd63cc3.png";

function buildStats(s: PublicStats | null) {
  const show = (value: string) => (s ? value : "…");
  return [
    { icon: Users, value: show(formatNumber(s?.donors ?? 0)), label: plural(s?.donors ?? 0, "Donateur", "Donateurs"), color: "#0D7C66" },
    { icon: Heart, value: show(formatAmount(s?.total_raised ?? 0)), label: "FCFA collectés", color: "#F59E0B" },
    { icon: FolderOpen, value: show(formatNumber(s?.active_projects ?? 0)), label: plural(s?.active_projects ?? 0, "Projet actif", "Projets actifs"), color: "#3B82F6" },
    { icon: TrendingUp, value: show(formatNumber(s?.funded_projects ?? 0)), label: plural(s?.funded_projects ?? 0, "Projet financé", "Projets financés"), color: "#EF4444" },
  ];
}

// Projects open to donations (paused ones are hidden, completed ones no longer need support)
const isOpen = (p: Project) => !p.status || p.status === "active";

export default function IndexPage() {
  const [featured, setFeatured] = useState<Project[] | null>(null);
  const { stats: platformStats, failed: statsFailed } = usePublicStats();
  const stats = buildStats(platformStats);

  useEffect(() => {
    async function loadFeatured() {
      try {
        let projects = (await api.getFeaturedProjects()).items.filter(isOpen);
        // Nothing featured: fall back to the latest open projects so the section is never empty
        if (projects.length === 0) projects = (await api.getProjects()).items.filter(isOpen);
        setFeatured(projects.slice(0, 3));
      } catch (error) {
        console.error("Failed to fetch featured projects:", error);
        setFeatured([]);
      }
    }
    loadFeatured();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A1A2E]/80 via-[#1A1A2E]/60 to-[#1A1A2E]/90" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white pt-16">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-8 border border-white/20">
            <Heart className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
            <span className="text-sm font-medium">Plateforme de dons de confiance</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            Chaque Don est une{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D7C66] to-[#10B981]">
              Amanah
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Rejoignez des milliers de donateurs à travers le monde. Ensemble, nous pouvons transformer des vies grâce à la générosité et la confiance.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/donate">
              <Button
                size="lg"
                className="bg-[#0D7C66] hover:bg-[#095C4B] text-white rounded-xl px-8 py-6 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all"
              >
                <Heart className="w-5 h-5 mr-2" />
                Faire un Don Maintenant
              </Button>
            </Link>
            <Link to="/projects">
              <Button
                size="lg"
                variant="outline"
                className="!bg-transparent border-2 border-white/30 text-white !hover:bg-white/10 rounded-xl px-8 py-6 text-lg font-semibold transition-all"
              >
                Découvrir nos Projets
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-1">
            <div className="w-1.5 h-3 bg-white/60 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Stats Section (hidden if the figures cannot be loaded, rather than showing wrong ones) */}
      {!statsFailed && (
      <section className="relative -mt-16 z-20 max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow"
            >
              <CardContent className="p-6 text-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: stat.color + "15" }}
                >
                  <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
                </div>
                <p className="text-2xl md:text-3xl font-bold text-[#1A1A2E] tabular-nums">{stat.value}</p>
                <p className="text-sm text-[#6B7280] mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      )}

      {/* Featured Causes */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-[#E8F5F0] text-[#0D7C66] text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              Nos Causes
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1A1A2E] mb-4">
              Projets en Vedette
            </h2>
            <p className="text-[#6B7280] max-w-xl mx-auto">
              Découvrez les projets qui ont le plus besoin de votre soutien en ce moment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featured === null
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="h-[26rem] rounded-xl bg-white shadow-md animate-pulse" />
                ))
              : featured.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
          {featured?.length === 0 && (
            <p className="text-center text-[#6B7280]">Aucun projet en cours pour le moment.</p>
          )}

          <div className="text-center mt-10">
            <Link to="/projects">
              <Button variant="outline" size="lg" className="rounded-xl border-[#0D7C66] text-[#0D7C66] hover:bg-[#E8F5F0]">
                Voir Tous les Projets
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-[#F3F4F6]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-[#FEF3C7] text-[#F59E0B] text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              Comment ça marche
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1A1A2E] mb-4">
              Donner en 3 Étapes Simples
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Choisissez une Cause",
                description: "Parcourez nos projets vérifiés et choisissez la cause qui vous tient à cœur.",
                color: "#0D7C66",
              },
              {
                step: "02",
                title: "Faites votre Don",
                description: "Sélectionnez le montant et payez en toute sécurité via Stripe, Orange Money ou Wave.",
                color: "#F59E0B",
              },
              {
                step: "03",
                title: "Suivez l'Impact",
                description: "Recevez des rapports réguliers sur l'utilisation de vos dons et leur impact réel.",
                color: "#3B82F6",
              },
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: item.color }}
                >
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-[#1A1A2E] mb-3">{item.title}</h3>
                <p className="text-[#6B7280] leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#0D7C66] to-[#095C4B]">
        <div className="max-w-3xl mx-auto text-center text-white">
          <Heart className="w-12 h-12 mx-auto mb-6 text-[#F59E0B] fill-[#F59E0B]" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Prêt à Faire la Différence ?
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
            Chaque contribution, aussi petite soit-elle, peut transformer une vie. Rejoignez notre communauté de donateurs aujourd'hui.
          </p>
          <Link to="/donate">
            <Button
              size="lg"
              className="bg-[#F59E0B] hover:bg-[#D97706] text-[#1A1A2E] rounded-xl px-10 py-6 text-lg font-bold shadow-xl hover:shadow-2xl transition-all"
            >
              Faire un Don Maintenant
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}