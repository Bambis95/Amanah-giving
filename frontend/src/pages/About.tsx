import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { textTone, Tone } from "@/lib/tones";
import { formatAmount, formatNumber, plural, usePublicStats } from "@/hooks/use-public-stats";
import {
  BRAND_DESCRIPTOR,
  BRAND_NAME,
  BRAND_SLOGAN,
  CARRIER_NAME,
  CARRIER_RECEIPT,
  CARRIER_SHORT,
  PARTNER_NAME,
} from "@/lib/brand";
import { CATEGORIES } from "@/lib/categories";
import { CONTACT_EMAIL, CONTACT_PHONES, telHref } from "@/lib/contact";
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

// Wording from SENJAPO's own presentation text
const fundedItems = [
  "Formations",
  "Équipements",
  "Matières premières",
  "Démarrage d'activités économiques",
  "Développement d'activités",
  "Initiatives d'autonomisation et d'insertion",
];

const contributors = ["Citoyens", "Diaspora", "Entreprises", "Associations", "Fondations", "Partenaires"];

const commitments = [
  { icon: FileSearch, title: "Vérification des campagnes", text: "Chaque campagne est vérifiée et validée avant d'être publiée." },
  { icon: Route, title: "Suivi des collectes", text: "L'avancement de chaque collecte est suivi et affiché sur la plateforme." },
  { icon: Eye, title: "Traçabilité des contributions", text: "Chaque contribution est enregistrée et rattachée à sa campagne." },
  { icon: Megaphone, title: "Communication sur les résultats", text: "Utilisation des fonds et réalisations sont communiquées aux contributeurs." },
];

// How a campaign goes from a proposal to its results
const milestones = [
  { year: "01", event: "Proposition : une campagne est initiée par le CCES ou proposée par une association, un groupement ou un porteur de projet." },
  { year: "02", event: "Vérification : la campagne est examinée et validée avant sa publication." },
  { year: "03", event: "Collecte : citoyens, diaspora, entreprises et partenaires contribuent en ligne, en toute sécurité." },
  { year: "04", event: "Suivi : l'utilisation des fonds et les réalisations sont communiquées." },
];

export default function AboutPage() {
  const { stats, failed: statsFailed } = usePublicStats();
  const figures = [
    { value: formatNumber(stats?.donors ?? 0), label: plural(stats?.donors ?? 0, "Contributeur", "Contributeurs"), tone: "primary" as Tone },
    { value: formatNumber(stats?.active_projects ?? 0), label: plural(stats?.active_projects ?? 0, "Campagne active", "Campagnes actives"), tone: "highlight" as Tone },
    { value: formatAmount(stats?.total_raised ?? 0), label: "FCFA collectés", tone: "info" as Tone },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="surface-brand px-4 pb-16 pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-6 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white">
            À propos de {BRAND_NAME}
          </span>
          <h1 className="mb-4 text-4xl font-bold tracking-wide md:text-6xl">{BRAND_NAME}</h1>
          <p className="mx-auto mb-6 max-w-2xl text-lg font-medium text-white/90 md:text-xl">{BRAND_DESCRIPTOR}</p>
          <p className="mx-auto max-w-2xl text-lg italic text-white/75">« {BRAND_SLOGAN} »</p>
        </div>
      </section>

      {/* Who we are */}
      <section className="px-4 py-20">
        <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <span className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-primary">
              Qui sommes-nous
            </span>
            <h2 className="mb-6 text-3xl font-bold text-foreground">Une initiative du {CARRIER_SHORT}</h2>
            <div className="space-y-4 leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">{BRAND_NAME} – {BRAND_DESCRIPTOR}</strong> est une initiative portée
                par le {CARRIER_NAME} ({CARRIER_SHORT}), en partenariat avec {PARTNER_NAME}.
              </p>
              <p>
                {BRAND_NAME} est née de la volonté de créer un outil numérique de mobilisation permettant de rassembler
                des contributions autour de projets à impact social, économique, éducatif et communautaire.
              </p>
              <p>
                La plateforme ne se limite pas à une seule collecte. Elle a vocation à accueillir plusieurs campagnes,
                initiées par le {CARRIER_SHORT} ou proposées par des associations, groupements, organisations et autres
                porteurs de projets, après vérification et validation.{" "}
                <Link to="/proposer" className="font-medium text-primary hover:underline">
                  Proposer une campagne
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
          <Card className="shadow-sm lg:col-span-2">
            <CardContent className="space-y-4 p-6">
              <h3 className="flex items-center gap-2 font-bold text-foreground">
                <BadgeCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                Fiche d'identité
              </h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Porteur</dt>
                  <dd className="font-medium text-foreground">{CARRIER_NAME} ({CARRIER_SHORT})</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Partenaire</dt>
                  <dd className="font-medium text-foreground">{PARTNER_NAME}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Récépissé {CARRIER_SHORT}</dt>
                  <dd className="font-medium text-foreground">{CARRIER_RECEIPT}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Contacts</dt>
                  <dd className="font-medium text-foreground">
                    {CONTACT_PHONES.map((p, i) => (
                      <span key={p}>
                        {i > 0 && " / "}
                        <a href={telHref(p)} className="hover:text-primary">{p}</a>
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">E-mail</dt>
                  <dd className="break-all font-medium text-foreground">
                    <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-primary">{CONTACT_EMAIL}</a>
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
              Notre objectif
            </span>
            <h2 className="mb-4 text-3xl font-bold text-foreground">Relier la solidarité à des besoins concrets</h2>
            <p className="leading-relaxed text-muted-foreground">
              L'objectif principal de {BRAND_NAME} est de mettre en relation la solidarité avec des besoins et projets
              concrets, en facilitant la mobilisation de ressources pour soutenir notamment :
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <div key={c.value} className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <c.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold text-foreground">{c.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-3 font-bold text-foreground">Ce que les collectes peuvent financer</h3>
              <ul className="flex flex-wrap gap-2">
                {fundedItems.map((item) => (
                  <li key={item} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground/80">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 font-bold text-foreground">Qui peut contribuer</h3>
              <ul className="flex flex-wrap gap-2">
                {contributors.map((item) => (
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
              Notre démarche
            </span>
            <h2 className="text-3xl font-bold text-foreground">De la Proposition aux Réalisations</h2>
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
              Notre engagement
            </span>
            <h2 className="mb-4 text-3xl font-bold text-foreground">La confiance au cœur de la plateforme</h2>
            <p className="leading-relaxed text-muted-foreground">
              {BRAND_NAME} entend mettre en place des mécanismes de vérification des campagnes, de suivi des collectes,
              de traçabilité des contributions et de communication sur l'utilisation des fonds et les réalisations.
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
              Voir la page Transparence
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="surface-hero px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Users className="mx-auto mb-6 h-12 w-12 text-primary" aria-hidden="true" />
          <h2 className="mb-4 text-3xl font-bold">« {BRAND_SLOGAN} »</h2>
          <p className="mx-auto mb-8 max-w-xl text-white/70">
            {stats && stats.donors > 0
              ? `Rejoignez ${plural(stats.donors, "le contributeur qui fait", `les ${formatNumber(stats.donors)} contributeurs qui font`)} déjà la différence.`
              : "Soyez parmi les premiers à faire la différence."}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-xl bg-primary px-8 font-semibold text-primary-foreground hover:bg-primary/90">
              <Link to="/donate">
                <Heart className="mr-2 h-5 w-5" />
                Faire un Don
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-xl border-2 border-white/30 !bg-transparent px-8 font-semibold text-white hover:!bg-white/10"
            >
              <Link to="/proposer">
                Proposer une Campagne
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
