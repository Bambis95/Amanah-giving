import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProjectCard from "@/components/ProjectCard";
import { api, Project, PublicStats } from "@/api";
import { formatAmount, formatNumber, plural, usePublicStats } from "@/hooks/use-public-stats";
import { cn } from "@/lib/utils";
import { softTone, solidTone, Tone } from "@/lib/tones";
import { Heart, Users, FolderOpen, TrendingUp, ArrowRight } from "lucide-react";

const HERO_IMG = "https://mgx-backend-cdn.metadl.com/generate/images/983496/2026-02-22/20fb421b-e0e3-4aa9-a282-e7aa1dd63cc3.png";

function buildStats(s: PublicStats | null) {
  const show = (value: string) => (s ? value : "…");
  return [
    { icon: Users, value: show(formatNumber(s?.donors ?? 0)), label: plural(s?.donors ?? 0, "Donateur", "Donateurs"), tone: "primary" as Tone },
    { icon: Heart, value: show(formatAmount(s?.total_raised ?? 0)), label: "FCFA collectés", tone: "highlight" as Tone },
    { icon: FolderOpen, value: show(formatNumber(s?.active_projects ?? 0)), label: plural(s?.active_projects ?? 0, "Projet actif", "Projets actifs"), tone: "info" as Tone },
    { icon: TrendingUp, value: show(formatNumber(s?.funded_projects ?? 0)), label: plural(s?.funded_projects ?? 0, "Projet financé", "Projets financés"), tone: "destructive" as Tone },
  ];
}

const steps: { step: string; title: string; description: string; tone: Tone }[] = [
  {
    step: "01",
    title: "Choisissez une Cause",
    description: "Parcourez nos projets vérifiés et choisissez la cause qui vous tient à cœur.",
    tone: "primary",
  },
  {
    step: "02",
    title: "Faites votre Don",
    description: "Sélectionnez le montant et payez en toute sécurité via Stripe, Orange Money ou Wave.",
    tone: "highlight",
  },
  {
    step: "03",
    title: "Suivez l'Impact",
    description: "Recevez des rapports réguliers sur l'utilisation de vos dons et leur impact réel.",
    tone: "info",
  },
];

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
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero: dark photo veil in both themes, so its text stays white */}
      <section className="relative flex min-h-[92svh] items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
          aria-hidden="true"
        />
        <div className="hero-overlay absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-4xl px-4 pb-24 pt-28 text-center text-white sm:pb-28">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
            <Heart className="h-4 w-4 fill-highlight text-highlight" aria-hidden="true" />
            <span className="text-sm font-medium">Plateforme de dons de confiance</span>
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Chaque Don est une{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">Amanah</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-white/80 sm:text-xl">
            Rejoignez des milliers de donateurs à travers le monde. Ensemble, nous pouvons transformer des vies grâce à
            la générosité et la confiance.
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button asChild size="lg" className="h-14 rounded-xl px-8 text-base font-semibold shadow-lg sm:text-lg">
              <Link to="/donate">
                <Heart className="mr-2 h-5 w-5" />
                Faire un Don Maintenant
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-xl border-2 border-white/30 bg-transparent px-8 text-base font-semibold text-white hover:bg-white/10 hover:text-white sm:text-lg"
            >
              <Link to="/projects">
                Découvrir nos Projets
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Decorative scroll hint: hidden from screen readers, still when motion is reduced */}
        <div className="absolute bottom-24 left-1/2 hidden -translate-x-1/2 motion-safe:animate-bounce sm:block" aria-hidden="true">
          <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-white/30 p-1">
            <div className="h-3 w-1.5 rounded-full bg-white/60" />
          </div>
        </div>
      </section>

      {/* Stats (hidden if the figures cannot be loaded, rather than showing wrong ones) */}
      {!statsFailed && (
        <section className="relative z-20 mx-auto -mt-14 max-w-6xl px-4" aria-label="Chiffres clés">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-4 text-center sm:p-6">
                  <div className={cn("mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl sm:h-12 sm:w-12", softTone[stat.tone])}>
                    <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-foreground md:text-3xl">{stat.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Featured projects */}
      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center sm:mb-14">
            <span className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground">
              Nos Causes
            </span>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Projets en Vedette</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Découvrez les projets qui ont le plus besoin de votre soutien en ce moment.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {featured === null
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="h-[26rem] animate-pulse rounded-xl border border-border bg-muted/60" aria-hidden="true" />
                ))
              : featured.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
          {featured?.length === 0 && (
            <p className="text-center text-muted-foreground">Aucun projet en cours pour le moment.</p>
          )}

          <div className="mt-10 text-center">
            <Button asChild variant="outline" size="lg" className="rounded-xl border-primary/40 text-primary hover:bg-accent hover:text-accent-foreground">
              <Link to="/projects">
                Voir Tous les Projets
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-muted/60 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center sm:mb-14">
            <span className="mb-4 inline-block rounded-full bg-highlight/15 px-4 py-1.5 text-sm font-semibold text-warning">
              Comment ça marche
            </span>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Donner en 3 Étapes Simples</h2>
          </div>

          <ol className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((item) => (
              <li key={item.step} className="group text-center">
                <div
                  className={cn(
                    "mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold shadow-sm transition-transform duration-200 group-hover:-translate-y-1 sm:h-20 sm:w-20 sm:text-2xl",
                    solidTone[item.tone]
                  )}
                  aria-hidden="true"
                >
                  {item.step}
                </div>
                <h3 className="mb-3 text-xl font-bold text-foreground">{item.title}</h3>
                <p className="mx-auto max-w-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Call to action */}
      <section className="surface-brand px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Heart className="mx-auto mb-6 h-12 w-12 fill-highlight text-highlight" aria-hidden="true" />
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Prêt à Faire la Différence ?</h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-white/85">
            Chaque contribution, aussi petite soit-elle, peut transformer une vie. Rejoignez notre communauté de
            donateurs aujourd'hui.
          </p>
          <Button
            asChild
            size="lg"
            className="h-14 w-full rounded-xl bg-highlight px-10 text-lg font-bold text-highlight-foreground shadow-lg hover:bg-highlight/90 sm:w-auto"
          >
            <Link to="/donate">
              Faire un Don Maintenant
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
