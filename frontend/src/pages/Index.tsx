import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProjectCard from "@/components/ProjectCard";
import NotifyForm from "@/components/NotifyForm";
import LatestNews from "@/components/LatestNews";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { api, Project, PublicStats } from "@/api";
import { formatAmount, formatNumber, usePublicStats } from "@/hooks/use-public-stats";
import { cn } from "@/lib/utils";
import { softTone, solidTone, Tone } from "@/lib/tones";
import { Heart, Users, FolderOpen, TrendingUp, ArrowRight, HandHeart, Lightbulb } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { Dictionary, useI18n } from "@/i18n";

const HERO_IMG = "https://mgx-backend-cdn.metadl.com/generate/images/983496/2026-02-22/20fb421b-e0e3-4aa9-a282-e7aa1dd63cc3.png";

function buildStats(s: PublicStats | null, t: Dictionary["home"]) {
  const show = (value: string) => (s ? value : "…");
  return [
    { icon: Users, value: show(formatNumber(s?.donors ?? 0)), label: t.donors(s?.donors ?? 0), tone: "primary" as Tone },
    { icon: Heart, value: show(formatAmount(s?.total_raised ?? 0)), label: t.raised, tone: "highlight" as Tone },
    { icon: FolderOpen, value: show(formatNumber(s?.active_projects ?? 0)), label: t.active(s?.active_projects ?? 0), tone: "info" as Tone },
    { icon: TrendingUp, value: show(formatNumber(s?.funded_projects ?? 0)), label: t.funded(s?.funded_projects ?? 0), tone: "destructive" as Tone },
  ];
}

const STEP_TONES: Tone[] = ["primary", "highlight", "info"];

// Projects open to donations (paused ones are hidden, completed ones no longer need support)
const isOpen = (p: Project) => !p.status || p.status === "active";

export default function IndexPage() {
  const [featured, setFeatured] = useState<Project[] | null>(null);
  const { stats: platformStats, failed: statsFailed } = usePublicStats();
  const { lang, t: dict } = useI18n();
  const t = dict.home;
  const stats = buildStats(platformStats, t);
  const steps = t.steps.map((s, i) => ({ ...s, step: `0${i + 1}`, tone: STEP_TONES[i] }));
  const site = useSiteSettings();

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
          <AnnouncementBanner text={site.announcement} link={site.announcement_link} />
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
            <HandHeart className="h-4 w-4 text-highlight" aria-hidden="true" />
            <span className="text-sm font-medium">
              {BRAND_NAME} · {dict.brand.descriptor}
            </span>
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            {t.heroTitle}{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
              {t.heroHighlight}
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-white/80 sm:text-xl">
            {(lang === "fr" && site.hero_subtitle) || t.heroSubtitle}
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button asChild size="lg" className="h-14 rounded-xl px-8 text-base font-semibold shadow-lg sm:text-lg">
              <Link to="/donate">
                <Heart className="mr-2 h-5 w-5" />
                {t.donateNow}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-xl border-2 border-white/30 bg-transparent px-8 text-base font-semibold text-white hover:bg-white/10 hover:text-white sm:text-lg"
            >
              <Link to="/projects">
                {t.seeCampaigns}
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
        <section className="relative z-20 mx-auto -mt-14 max-w-6xl px-4" aria-label={t.keyFigures}>
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
              {t.causesBadge}
            </span>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{t.currentTitle}</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              {t.currentText}
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
            <p className="text-center text-muted-foreground">{t.noneCurrent}</p>
          )}

          <div className="mt-10 text-center">
            <Button asChild variant="outline" size="lg" className="rounded-xl border-primary/40 text-primary hover:bg-accent hover:text-accent-foreground">
              <Link to="/projects">
                {t.seeAll}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Latest campaign news (hidden until the first one is published) */}
      <LatestNews />

      {/* How it works */}
      <section className="border-y border-border bg-muted/60 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center sm:mb-14">
            <span className="mb-4 inline-block rounded-full bg-highlight/15 px-4 py-1.5 text-sm font-semibold text-warning">
              {t.howBadge}
            </span>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{t.howTitle}</h2>
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

      {/* Campaigns are open to other project holders, after verification */}
      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10 md:grid-cols-[1fr_auto]">
          <div>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground">
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              {t.holdersBadge}
            </span>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">{t.holdersTitle}</h2>
            <p className="max-w-2xl text-muted-foreground">
              {t.holdersText(BRAND_NAME)}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="h-12 rounded-xl px-8 font-semibold">
              <Link to="/proposer">
                {t.propose}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-8 font-semibold">
              <Link to="/adherer">{t.joinClub}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Keep me informed (phone / WhatsApp first: the way most visitors prefer to be reached) */}
      <section className="px-4 pb-16 sm:pb-20">
        <div className="mx-auto max-w-6xl rounded-2xl bg-muted/60 p-6 sm:p-10">
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">{t.newsTitle}</h2>
          <p className="mb-5 max-w-2xl text-muted-foreground">
            {t.newsText(BRAND_NAME)}
          </p>
          <NotifyForm />
        </div>
      </section>

      {/* Call to action */}
      <section className="surface-brand px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Heart className="mx-auto mb-6 h-12 w-12 fill-highlight text-highlight" aria-hidden="true" />
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">{t.ctaTitle}</h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-white/85">
            {t.ctaText}
          </p>
          <Button
            asChild
            size="lg"
            className="h-14 w-full rounded-xl bg-highlight px-10 text-lg font-bold text-highlight-foreground shadow-lg hover:bg-highlight/90 sm:w-auto"
          >
            <Link to="/donate">
              {t.donateNow}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
