import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { textTone, Tone } from "@/lib/tones";
import { formatAmount, formatNumber, usePublicStats } from "@/hooks/use-public-stats";
import { useI18n } from "@/i18n";
import {
  BRAND_NAME,
  CARRIER_NAME,
  CARRIER_RECEIPT,
  CARRIER_SHORT,
  PARTNER_LEGAL,
  PARTNER_NAME,
} from "@/lib/brand";
import { CATEGORIES } from "@/lib/categories";
import { telHref } from "@/lib/contact";
import { useSiteSettings } from "@/hooks/use-site-settings";
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  FileSearch,
  Heart,
  Megaphone,
  Route,
  Target,
  Users,
} from "lucide-react";

// Wording from SENJAPO's own presentation text (i18n: about.*)
const COMMITMENT_ICONS = [FileSearch, Route, Eye, Megaphone];

export default function AboutPage() {
  const site = useSiteSettings();
  const { t: dict } = useI18n();
  const t = dict.about;
  const { stats, failed: statsFailed } = usePublicStats();
  const figures = [
    { value: formatNumber(stats?.donors ?? 0), label: t.contributors(stats?.donors ?? 0), tone: "primary" as Tone },
    { value: formatNumber(stats?.active_projects ?? 0), label: dict.home.active(stats?.active_projects ?? 0), tone: "highlight" as Tone },
    { value: formatAmount(stats?.total_raised ?? 0), label: dict.home.raised, tone: "info" as Tone },
  ];
  const commitments = t.commitments.map((c, i) => ({ ...c, icon: COMMITMENT_ICONS[i] }));
  const milestones = t.milestones.map((event, i) => ({ year: `0${i + 1}`, event }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="surface-brand px-4 pb-16 pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-6 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white">
            {t.badge(BRAND_NAME)}
          </span>
          <h1 className="mb-4 text-4xl font-bold tracking-wide md:text-6xl">{BRAND_NAME}</h1>
          <p className="mx-auto mb-6 max-w-2xl text-lg font-medium text-white/90 md:text-xl">{dict.brand.descriptor}</p>
          <p className="mx-auto max-w-2xl text-lg italic text-white/75">« {dict.brand.slogan} »</p>
        </div>
      </section>

      {/* Who we are */}
      <section className="px-4 py-20">
        <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <span className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-primary">
              {t.whoBadge}
            </span>
            <h2 className="mb-6 text-3xl font-bold text-foreground">{t.whoTitle(CARRIER_SHORT)}</h2>
            <div className="space-y-4 leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">{BRAND_NAME} – {dict.brand.descriptor}</strong>{" "}
                {t.whoP1(CARRIER_NAME, CARRIER_SHORT, PARTNER_NAME)}
              </p>
              <p>
                {t.whoP2(BRAND_NAME)}
              </p>
              <p>
                {t.whoP3(CARRIER_SHORT)}{" "}
                <Link to="/proposer" className="font-medium text-primary hover:underline">
                  {t.propose}
                </Link>
              </p>
            </div>
            {/* Real figures; hidden if they cannot be loaded rather than showing wrong ones */}
            {!statsFailed && (
              <div className="mt-8 flex flex-wrap items-center gap-6">
                {figures.map((f, i) => (
                  <div key={f.label} className="flex items-center gap-6">
                    {i > 0 && <div className="h-12 w-px bg-muted" />}
                    <div className="text-center">
                      <p className={cn("text-3xl font-bold tabular-nums", textTone[f.tone])}>{stats ? f.value : "…"}</p>
                      <p className="text-sm text-muted-foreground">{f.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Identity card: who is legally behind the platform */}
          <Card className="overflow-hidden shadow-sm lg:col-span-2">
            <div className="flex justify-center bg-white p-6">
              <img src="/logo-senjapo.jpg" alt={`Logo ${BRAND_NAME}`} className="h-56 w-auto" loading="lazy" />
            </div>
            <CardContent className="space-y-4 border-t p-6">
              <div className="flex items-center gap-3">
                <img src="/partners/cces.jpg" alt={`Logo ${CARRIER_SHORT}`} className="h-14 w-auto rounded-lg bg-white p-1 ring-1 ring-black/5" loading="lazy" />
                <img src="/partners/diaayma-local.jpg" alt={`Logo ${PARTNER_NAME}`} className="h-14 w-auto rounded-lg bg-white p-1 ring-1 ring-black/5" loading="lazy" />
              </div>
              <h3 className="flex items-center gap-2 font-bold text-foreground">
                <BadgeCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                {t.identity}
              </h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t.carrier}</dt>
                  <dd className="font-medium text-foreground">{CARRIER_NAME} ({CARRIER_SHORT})</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t.partner}</dt>
                  <dd className="font-medium text-foreground">{PARTNER_LEGAL.fullName}</dd>
                  <dd className="text-xs text-muted-foreground">
                    RCCM {PARTNER_LEGAL.rccm} · NINEA {PARTNER_LEGAL.ninea} · {PARTNER_LEGAL.seat}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t.receipt(CARRIER_SHORT)}</dt>
                  <dd className="font-medium text-foreground">{CARRIER_RECEIPT}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t.contacts}</dt>
                  <dd className="font-medium text-foreground">
                    {site.contact_phones.map((p, i) => (
                      <span key={p}>
                        {i > 0 && " / "}
                        <a href={telHref(p)} className="hover:text-primary">{p}</a>
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t.email}</dt>
                  <dd className="break-all font-medium text-foreground">
                    <a href={`mailto:${site.contact_email}`} className="hover:text-primary">{site.contact_email}</a>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Objective */}
      <section className="bg-muted/60 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full bg-highlight/15 px-4 py-1.5 text-sm font-semibold text-warning">
              <Target className="mr-1 inline h-4 w-4" aria-hidden="true" />
              {t.goalBadge}
            </span>
            <h2 className="mb-4 text-3xl font-bold text-foreground">{t.goalTitle}</h2>
            <p className="leading-relaxed text-muted-foreground">
              {t.goalText(BRAND_NAME)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <div key={c.value} className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <c.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold text-foreground">{dict.categories[c.value] ?? c.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-3 font-bold text-foreground">{t.fundedTitle}</h3>
              <ul className="flex flex-wrap gap-2">
                {t.funded.map((item) => (
                  <li key={item} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground/80">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 font-bold text-foreground">{t.whoCanTitle}</h3>
              <ul className="flex flex-wrap gap-2">
                {t.whoCan.map((item) => (
                  <li key={item} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground/80">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-primary">
              {t.processBadge}
            </span>
            <h2 className="text-3xl font-bold text-foreground">{t.processTitle}</h2>
          </div>

          <div className="space-y-6">
            {milestones.map((m, i) => (
              <div key={m.year} className="group flex items-center gap-6">
                <div className="w-12 text-right sm:w-20">
                  <span className="text-lg font-bold text-primary">{m.year}</span>
                </div>
                <div className="relative flex flex-col items-center">
                  <div className="h-4 w-4 rounded-full border-4 border-accent bg-primary transition-transform motion-safe:group-hover:scale-125" />
                  {i < milestones.length - 1 && <div className="h-8 w-0.5 bg-primary/20" />}
                </div>
                <Card className="flex-1 border-0 shadow-sm transition-shadow group-hover:shadow-md">
                  <CardContent className="p-4">
                    <p className="font-medium text-foreground/80">{m.event}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commitment */}
      <section className="bg-muted/60 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-primary">
              {t.commitBadge}
            </span>
            <h2 className="mb-4 text-3xl font-bold text-foreground">{t.commitTitle}</h2>
            <p className="leading-relaxed text-muted-foreground">
              {t.commitText(BRAND_NAME)}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {commitments.map((c) => (
              <div key={c.title} className="flex gap-4 rounded-xl bg-card p-5 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <c.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{c.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm">
            <Link to="/transparence" className="font-medium text-primary hover:underline">
              {t.transparency}
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="surface-hero px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Users className="mx-auto mb-6 h-12 w-12 text-primary" aria-hidden="true" />
          <h2 className="mb-4 text-3xl font-bold">« {dict.brand.slogan} »</h2>
          <p className="mx-auto mb-8 max-w-xl text-white/70">
            {stats && stats.donors > 0 ? t.joinCount(stats.donors, formatNumber(stats.donors)) : t.beFirst}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-xl bg-primary px-8 font-semibold text-primary-foreground hover:bg-primary/90">
              <Link to="/donate">
                <Heart className="mr-2 h-5 w-5" />
                {dict.nav.donate}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-xl border-2 border-white/30 !bg-transparent px-8 font-semibold text-white hover:!bg-white/10"
            >
              <Link to="/proposer">
                {dict.nav.propose}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
